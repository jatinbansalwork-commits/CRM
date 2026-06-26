import { prisma } from "@/lib/db";
import {
  normalizeEmail,
  isValidEmail,
  extractDomain,
  isRowEmpty,
  normalizeCompanyName,
  stringifyTags,
} from "@/lib/utils/contact";
import { mergeContactData } from "./merge-engine";
import { enrichRowCompany } from "@/lib/utils/company-enrichment";
import { mapRow } from "./row-mapper";
import { expandRowsWithMultipleEmails } from "@/lib/universal-import/quality-analyzer";
import { IMPORT_BATCH_SIZE } from "@/lib/constants/import";
import type { ColumnMapping, ImportRow, ImportSummary, ContactWithCompany } from "@/types";
import type { ImportSource } from "@/lib/constants";

type CompanyRef = { id: string; name: string };

class CompanyCache {
  private byName = new Map<string, CompanyRef>();
  private byDomain = new Map<string, CompanyRef>();

  seed(companies: Array<{ id: string; name: string; domain: string | null }>) {
    for (const company of companies) {
      const nameKey = normalizeCompanyName(company.name).toLowerCase();
      this.byName.set(nameKey, { id: company.id, name: company.name });
      if (company.domain) {
        this.byDomain.set(company.domain.toLowerCase(), {
          id: company.id,
          name: company.name,
        });
      }
    }
  }

  get(name: string, domain?: string | null): CompanyRef | undefined {
    const nameKey = normalizeCompanyName(name).toLowerCase();
    if (nameKey && this.byName.has(nameKey)) return this.byName.get(nameKey);
    if (domain) return this.byDomain.get(domain.toLowerCase());
    return undefined;
  }

  set(name: string, domain: string | null | undefined, ref: CompanyRef) {
    const nameKey = normalizeCompanyName(name).toLowerCase();
    if (nameKey) this.byName.set(nameKey, ref);
    if (domain) this.byDomain.set(domain.toLowerCase(), ref);
  }
}

type ExistingContact = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  department: string | null;
  linkedin: string | null;
  website: string | null;
  sourceFile: string | null;
  sourceSheet: string | null;
  sourceRow: number | null;
  priority: string;
  status: string;
  companyId: string | null;
  company: { id: string; name: string; domain: string | null } | null;
  notes: { body: string }[];
};

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

    const mappedRows: (ImportRow & { email: string })[] = [];

    const expandedRows = expandRowsWithMultipleEmails(params.rows, params.mapping);
    const rowOffset = (params.batchIndex ?? 0) * IMPORT_BATCH_SIZE;

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
        row.sourceSheet ?? raw.__sourceSheet ?? params.sheetName;

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

    if (mappedRows.length === 0) {
      await this.finalizeImportRecord(
        importRecord,
        summary,
        existingMeta,
        params,
      );
      return summary;
    }

    const companyCache = new CompanyCache();
    await this.warmCompanyCache(mappedRows, companyCache);
    await this.preResolveCompanies(mappedRows, companyCache);

    const emails = mappedRows.map((r) => r.email);
    const existingContacts = await prisma.contact.findMany({
      where: { email: { in: emails } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        linkedin: true,
        website: true,
        sourceFile: true,
        sourceSheet: true,
        sourceRow: true,
        priority: true,
        status: true,
        companyId: true,
        company: { select: { id: true, name: true, domain: true } },
      },
    });
    const existingByEmail = new Map<string, ExistingContact>(
      existingContacts.map((c) => [c.email, { ...c, notes: [] } as ExistingContact]),
    );

    const noteCreates: { contactId: string; body: string }[] = [];

    for (const row of mappedRows) {
      try {
        await this.upsertContactRowFast({
          row,
          importId: importRecord.id,
          summary,
          companyNames,
          companyCache,
          existingByEmail,
          noteCreates,
        });
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

    if (noteCreates.length > 0) {
      await prisma.contactNote.createMany({ data: noteCreates });
    }

    summary.duplicateCompanies = Array.from(companyNames.values()).filter(
      (c) => c > 1,
    ).length;

    await this.finalizeImportRecord(
      importRecord,
      summary,
      existingMeta,
      params,
    );

    return summary;
  }

  private async warmCompanyCache(
    rows: (ImportRow & { email: string })[],
    cache: CompanyCache,
  ) {
    const names = new Set<string>();
    const domains = new Set<string>();

    for (const row of rows) {
      const enriched = enrichRowCompany(row);
      const company = enriched.company ?? row.company;
      if (company) {
        const normalized = normalizeCompanyName(company);
        if (normalized) names.add(normalized);
      }
      const domain = extractDomain(row.email);
      if (domain) domains.add(domain);
    }

    if (names.size === 0 && domains.size === 0) return;

    const existing = await prisma.company.findMany({
      where: {
        OR: [
          ...(names.size
            ? [{ name: { in: Array.from(names) } }]
            : []),
          ...(domains.size
            ? [{ domain: { in: Array.from(domains) } }]
            : []),
        ],
      },
      select: { id: true, name: true, domain: true },
    });
    cache.seed(existing);
  }

  /** Resolve unique companies once per batch so the row loop stays to contact writes only. */
  private async preResolveCompanies(
    rows: (ImportRow & { email: string })[],
    cache: CompanyCache,
  ) {
    const pending = new Map<string, { name: string; domain: string | null }>();

    for (const row of rows) {
      const enriched = enrichRowCompany(row);
      const company = enriched.company ?? row.company;
      if (!company) continue;

      const normalized = normalizeCompanyName(company);
      if (!normalized) continue;

      const domain = extractDomain(row.email);
      if (cache.get(normalized, domain)) continue;

      const key = `${normalized.toLowerCase()}|${domain ?? ""}`;
      if (!pending.has(key)) {
        pending.set(key, { name: normalized, domain });
      }
    }

    for (const { name, domain } of pending.values()) {
      await this.resolveCompany(name, domain, cache);
    }
  }

  private async resolveCompany(
    name: string,
    domain: string | null | undefined,
    cache: CompanyCache,
  ): Promise<CompanyRef | null> {
    const normalized = normalizeCompanyName(name);
    if (!normalized) return null;

    const cached = cache.get(normalized, domain);
    if (cached) return cached;

    if (domain) {
      const byDomain = await prisma.company.findFirst({ where: { domain } });
      if (byDomain) {
        const ref = { id: byDomain.id, name: byDomain.name };
        cache.set(normalized, domain, ref);
        return ref;
      }
    }

    const existing = await prisma.company.findFirst({
      where: { name: { equals: normalized } },
    });
    if (existing) {
      const ref = { id: existing.id, name: existing.name };
      cache.set(normalized, domain, ref);
      return ref;
    }

    const created = await prisma.company.create({
      data: { name: normalized, domain: domain ?? null },
      select: { id: true, name: true },
    });
    const ref = { id: created.id, name: created.name };
    cache.set(normalized, domain, ref);
    return ref;
  }

  private async upsertContactRowFast(params: {
    row: ImportRow & { email: string };
    importId: string;
    summary: ImportSummary;
    companyNames: Map<string, number>;
    companyCache: CompanyCache;
    existingByEmail: Map<string, ExistingContact>;
    noteCreates: { contactId: string; body: string }[];
  }): Promise<void> {
    const { row, importId, summary, companyNames, companyCache, existingByEmail, noteCreates } =
      params;

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
      const company = companyCache.get(effectiveRow.company, domain) ??
        (await this.resolveCompany(effectiveRow.company, domain, companyCache));
      companyId = company?.id ?? null;
    } else {
      summary.missingCompany++;
    }

    const existing = existingByEmail.get(effectiveRow.email);

    if (existing) {
      const updates = mergeContactData(existing as ContactWithCompany, effectiveRow);
      if (companyId && !existing.companyId) {
        updates.companyId = companyId;
      }

      const updateData: Record<string, unknown> = { importId };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.role !== undefined) updateData.role = updates.role;
      if (updates.department !== undefined) updateData.department = updates.department;
      if (updates.linkedin !== undefined) updateData.linkedin = updates.linkedin;
      if (updates.website !== undefined) updateData.website = updates.website;
      if (updates.sourceFile !== undefined) updateData.sourceFile = updates.sourceFile;
      if (updates.sourceSheet !== undefined) updateData.sourceSheet = updates.sourceSheet;
      if (updates.sourceRow !== undefined) updateData.sourceRow = updates.sourceRow;
      if (updates.priority) updateData.priority = updates.priority;
      if (updates.companyId !== undefined) updateData.companyId = updates.companyId;
      else if (companyId && !existing.companyId) updateData.companyId = companyId;

      if (Object.keys(updateData).length > 1) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: updateData,
        });
      }

      if (effectiveRow.notes) {
        noteCreates.push({ contactId: existing.id, body: effectiveRow.notes });
      }

      summary.updatedContacts++;
      summary.imported++;
      return;
    }

    const contact = await prisma.contact.create({
      data: {
        name: effectiveRow.name ?? null,
        email: effectiveRow.email,
        role: effectiveRow.role ?? null,
        department: effectiveRow.department ?? null,
        domain: domain ?? effectiveRow.email.split("@")[1] ?? null,
        linkedin: effectiveRow.linkedin ?? null,
        website: effectiveRow.website ?? null,
        sourceFile: effectiveRow.sourceFile ?? null,
        sourceSheet: effectiveRow.sourceSheet ?? null,
        sourceRow: effectiveRow.sourceRow ?? null,
        tags: stringifyTags(effectiveRow.tags ?? []),
        priority: effectiveRow.priority ?? "MEDIUM",
        status: effectiveRow.status ?? "NOT_CONTACTED",
        companyId,
        importId,
      },
      select: { id: true },
    });

    if (effectiveRow.notes) {
      noteCreates.push({ contactId: contact.id, body: effectiveRow.notes });
    }

    summary.newContacts++;
    summary.imported++;
  }

  private async finalizeImportRecord(
    importRecord: { id: string; imported: number; duplicates: number; updated: number; skipped: number },
    summary: ImportSummary,
    existingMeta: Record<string, unknown>,
    params: {
      batchIndex?: number;
      totalBatches?: number;
      sheetName?: string;
      sheetNames?: string[];
    },
  ) {
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

    return reverted;
  }
}

export const importEngine = new ImportEngine();
