import { prisma } from "@/lib/db";
import { contactRepository, companyRepository } from "@/lib/repositories";
import { activityService } from "@/lib/services/activity/activity-service";
import {
  normalizeEmail,
  isValidEmail,
  extractDomain,
  isRowEmpty,
} from "@/lib/utils/contact";
import { mergeContactData } from "./merge-engine";
import { enrichRowCompany } from "@/lib/utils/company-enrichment";
import { mapRow } from "./row-mapper";
import { expandRowsWithMultipleEmails } from "@/lib/universal-import/quality-analyzer";
import type { ColumnMapping, ImportRow, ImportSummary } from "@/types";
import type { ImportSource } from "@/lib/constants";

export class ImportEngine {
  async process(params: {
    rows: Record<string, string>[];
    mapping: ColumnMapping;
    source: ImportSource;
    filename?: string;
    sheetName?: string;
    sheetNames?: string[];
    importId?: string;
    batchIndex?: number;
    totalBatches?: number;
  }): Promise<ImportSummary> {
    const summary: ImportSummary = {
      importId: params.importId ?? "",
      imported: 0,
      newContacts: 0,
      updatedContacts: 0,
      duplicateEmails: 0,
      duplicateCompanies: 0,
      invalidEmails: 0,
      missingCompany: 0,
      missingEmail: 0,
      companiesEnriched: 0,
      skippedRows: 0,
      errors: [],
    };

    const seenEmails = new Set<string>();
    const companyNames = new Map<string, number>();

    let importRecord;
    let existingMeta: Record<string, unknown> = {};

    if (params.importId) {
      importRecord = await prisma.import.findUnique({
        where: { id: params.importId },
      });
      if (!importRecord) {
        throw new Error(`Import session not found: ${params.importId}`);
      }
      summary.importId = importRecord.id;
      try {
        existingMeta = JSON.parse(importRecord.metadata || "{}");
      } catch {
        existingMeta = {};
      }
    } else {
      importRecord = await prisma.import.create({
        data: {
          filename: params.filename ?? null,
          source: params.source,
          metadata: JSON.stringify({
            sheetName: params.sheetName,
            sheetNames: params.sheetNames,
            totalBatches: params.totalBatches,
          }),
        },
      });
      summary.importId = importRecord.id;
    }

    const batchSize = 100;
    const mappedRows: (ImportRow & { email: string })[] = [];

    const expandedRows = expandRowsWithMultipleEmails(params.rows, params.mapping);
    const rowOffset = (params.batchIndex ?? 0) * 500;

    for (let i = 0; i < expandedRows.length; i++) {
      const raw = expandedRows[i];
      if (!raw || isRowEmpty(raw)) {
        summary.skippedRows++;
        continue;
      }

      const row = mapRow(raw, params.mapping);
      row.sourceRow = row.sourceRow ?? rowOffset + i + 1;
      row.sourceFile = row.sourceFile ?? params.filename;
      row.sourceSheet =
        row.sourceSheet ??
        raw.__sourceSheet ??
        params.sheetName;

      if (!row.email) {
        summary.missingEmail++;
        continue;
      }

      const email = normalizeEmail(row.email);
      if (!isValidEmail(email)) {
        summary.invalidEmails++;
        continue;
      }

      if (seenEmails.has(email)) {
        summary.duplicateEmails++;
        continue;
      }
      seenEmails.add(email);
      mappedRows.push({ ...row, email });
    }

    console.log("[import-engine] mapped", {
      importId: summary.importId,
      batchIndex: params.batchIndex,
      received: params.rows.length,
      expanded: expandedRows.length,
      toWrite: mappedRows.length,
      skipped: summary.skippedRows,
      missingEmail: summary.missingEmail,
      invalid: summary.invalidEmails,
      dupes: summary.duplicateEmails,
    });

    for (let i = 0; i < mappedRows.length; i += batchSize) {
      const batch = mappedRows.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalDbBatches = Math.ceil(mappedRows.length / batchSize);

      for (const row of batch) {
        try {
          await this.upsertContactRow(
            row,
            importRecord!.id,
            summary,
            companyNames,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          if (msg.includes("Unique constraint") || msg.includes("UNIQUE")) {
            summary.duplicateEmails++;
          } else {
            summary.errors.push(`Row ${row.sourceRow}: ${msg}`);
          }
          console.warn("[import-engine] row error:", row.sourceRow, msg);
        }
      }

      if (batchNum % 5 === 0 || batchNum === totalDbBatches) {
        console.log("[import-engine] db progress", {
          importId: summary.importId,
          dbBatch: `${batchNum}/${totalDbBatches}`,
          imported: summary.imported,
        });
      }
    }

    summary.duplicateCompanies = Array.from(companyNames.values()).filter(
      (c) => c > 1,
    ).length;

    const prevImported = (existingMeta.imported as number) ?? importRecord.imported;
    const prevDuplicates = (existingMeta.duplicateEmails as number) ?? importRecord.duplicates;
    const prevUpdated = (existingMeta.updatedContacts as number) ?? importRecord.updated;
    const prevSkipped = (existingMeta.skippedRows as number) ?? importRecord.skipped;

    const cumulative = {
      imported: prevImported + summary.imported,
      duplicates: prevDuplicates + summary.duplicateEmails,
      updated: prevUpdated + summary.updatedContacts,
      skipped: prevSkipped + summary.skippedRows,
      newContacts: ((existingMeta.newContacts as number) ?? 0) + summary.newContacts,
      invalidEmails: ((existingMeta.invalidEmails as number) ?? 0) + summary.invalidEmails,
      missingCompany: ((existingMeta.missingCompany as number) ?? 0) + summary.missingCompany,
      missingEmail: ((existingMeta.missingEmail as number) ?? 0) + summary.missingEmail,
      companiesEnriched:
        ((existingMeta.companiesEnriched as number) ?? 0) + summary.companiesEnriched,
      errors: [
        ...((existingMeta.errors as string[]) ?? []),
        ...summary.errors,
      ].slice(0, 100),
    };

    await prisma.import.update({
      where: { id: importRecord.id },
      data: {
        imported: cumulative.imported,
        duplicates: cumulative.duplicates,
        updated: cumulative.updated,
        skipped: cumulative.skipped,
        metadata: JSON.stringify({
          ...existingMeta,
          sheetName: params.sheetName ?? existingMeta.sheetName,
          sheetNames: params.sheetNames ?? existingMeta.sheetNames,
          ...cumulative,
          lastBatchIndex: params.batchIndex,
          totalBatches: params.totalBatches,
        }),
      },
    });

    return {
      ...summary,
      imported: summary.imported,
      duplicateEmails: summary.duplicateEmails,
      updatedContacts: summary.updatedContacts,
      skippedRows: summary.skippedRows,
      newContacts: summary.newContacts,
      errors: summary.errors,
    };
  }

  private async upsertContactRow(
    row: ImportRow & { email: string },
    importId: string,
    summary: ImportSummary,
    companyNames: Map<string, number>,
  ): Promise<void> {
    const enriched = enrichRowCompany(row);
    const effectiveRow = { ...row, company: enriched.company ?? row.company };

    if (enriched.companyEnriched) {
      summary.companiesEnriched++;
    }

    const domain = extractDomain(effectiveRow.email);
    let companyId: string | null = null;

    if (effectiveRow.company) {
      const companyKey = effectiveRow.company.toLowerCase();
      companyNames.set(companyKey, (companyNames.get(companyKey) ?? 0) + 1);
      const company = await companyRepository.findOrCreate(
        effectiveRow.company,
        domain,
      );
      companyId = company.id;
    } else {
      summary.missingCompany++;
    }

    const existing = await contactRepository.findByEmail(effectiveRow.email);

    if (existing) {
      const updates = mergeContactData(existing, effectiveRow);
      if (companyId && !existing.companyId) {
        updates.companyId = companyId;
      }
      if (Object.keys(updates).length > 0) {
        await contactRepository.update(existing.id, updates);
      }
      if (effectiveRow.notes) {
        await prisma.contactNote.create({
          data: { contactId: existing.id, body: effectiveRow.notes },
        });
      }
      await prisma.contact.update({
        where: { id: existing.id },
        data: { importId },
      });
      summary.updatedContacts++;
      await activityService.log("IMPORTED", existing.id, {
        importId,
        updated: true,
      });
    } else {
      const contact = await contactRepository.create({
        name: effectiveRow.name,
        email: effectiveRow.email,
        role: effectiveRow.role,
        department: effectiveRow.department,
        linkedin: effectiveRow.linkedin,
        website: effectiveRow.website,
        sourceFile: effectiveRow.sourceFile,
        sourceSheet: effectiveRow.sourceSheet,
        sourceRow: effectiveRow.sourceRow,
        tags: effectiveRow.tags,
        priority: effectiveRow.priority,
        status: effectiveRow.status,
        companyId,
        note: effectiveRow.notes,
        domain: domain ?? undefined,
        importId,
      });
      summary.newContacts++;
      await activityService.log("IMPORTED", contact.id, { importId });
    }

    summary.imported++;
  }

  async undo(importId: string): Promise<number> {
    const contacts = await prisma.contact.findMany({
      where: { importId },
      select: { id: true, createdAt: true, updatedAt: true },
    });

    let reverted = 0;
    for (const contact of contacts) {
      const wasNew =
        contact.createdAt.getTime() === contact.updatedAt.getTime();
      if (wasNew) {
        await prisma.contact.delete({ where: { id: contact.id } });
        reverted++;
      } else {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { importId: null },
        });
      }
    }

    await activityService.log("RESTORED", undefined, { importId, reverted });
    return reverted;
  }
}

export const importEngine = new ImportEngine();
