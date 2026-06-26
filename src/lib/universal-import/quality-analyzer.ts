import {
  extractEmailFromCell,
  isValidEmail,
  normalizeEmail,
  isRowEmpty,
  extractDomain,
  companyFromDomain,
} from "@/lib/utils/contact";
import { mapRow } from "@/lib/services/import/row-mapper";
import { enrichRowCompany } from "@/lib/utils/company-enrichment";
import { splitEmailsFromCell } from "./normalize";
import type { ColumnMapping } from "@/types";
import type { QualityReport } from "./types";

/** If table is one row of emails across columns, expand to one contact per email. */
export function expandHorizontalEmailRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): Record<string, string>[] {
  if (rows.length !== 1) return rows;

  const row = rows[0];
  const emailHeaders = Object.entries(mapping)
    .filter(([, field]) => field === "email")
    .map(([header]) => header);

  if (emailHeaders.length < 2) return rows;

  const allEmails = emailHeaders.every((h) => {
    const v = row[h] ?? "";
    const e = extractEmailFromCell(v);
    return e !== null && isValidEmail(e);
  });

  if (!allEmails) return rows;

  return emailHeaders.map((header) => {
    const email = extractEmailFromCell(row[header] ?? "")!;
    const domain = extractDomain(email);
    return {
      Email: email,
      Company: domain ? companyFromDomain(domain) : "",
      ...Object.fromEntries(
        Object.entries(row).filter(([k]) => k !== header),
      ),
    };
  });
}
export function expandRowsWithMultipleEmails(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): Record<string, string>[] {
  const horizontal = expandHorizontalEmailRows(rows, mapping);
  const emailHeaders = Object.entries(mapping)
    .filter(([, field]) => field === "email")
    .map(([header]) => header);

  if (emailHeaders.length === 0) return horizontal;

  const expanded: Record<string, string>[] = [];

  for (const row of horizontal) {
    let split = false;
    for (const header of emailHeaders) {
      const cell = row[header] ?? "";
      const emails = splitEmailsFromCell(cell);
      if (emails.length > 1) {
        split = true;
        for (const email of emails) {
          expanded.push({ ...row, [header]: email });
        }
        break;
      }
    }
    if (!split) expanded.push(row);
  }

  return expanded;
}

export function analyzeQuality(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  rowsIgnored = 0,
): QualityReport {
  const report: QualityReport = {
    totalRows: rows.length,
    validContacts: 0,
    duplicateEmails: 0,
    duplicateCompanies: 0,
    missingEmail: 0,
    missingCompany: 0,
    missingName: 0,
    invalidEmails: 0,
    emptyRows: 0,
    rowsIgnored,
    multiEmailRows: 0,
    companiesEnriched: 0,
  };

  const seenEmails = new Set<string>();
  const companyCounts = new Map<string, number>();

  const emailHeaders = Object.entries(mapping)
    .filter(([, field]) => field === "email")
    .map(([header]) => header);

  for (const raw of rows) {
    if (isRowEmpty(raw)) {
      report.emptyRows++;
      continue;
    }

    let multi = false;
    for (const header of emailHeaders) {
      if (splitEmailsFromCell(raw[header] ?? "").length > 1) {
        multi = true;
        break;
      }
    }
    if (multi) report.multiEmailRows++;

    const mapped = enrichRowCompany(mapRow(raw, mapping));

    if (!mapped.email) {
      report.missingEmail++;
      continue;
    }

    if (mapped.companyEnriched) {
      report.companiesEnriched++;
    }

    const email = normalizeEmail(
      extractEmailFromCell(mapped.email) ?? mapped.email,
    );

    if (!isValidEmail(email)) {
      report.invalidEmails++;
      continue;
    }

    if (seenEmails.has(email)) {
      report.duplicateEmails++;
      continue;
    }
    seenEmails.add(email);
    report.validContacts++;

    if (!mapped.name?.trim()) report.missingName++;
    if (!mapped.company?.trim()) report.missingCompany++;
    else {
      const key = mapped.company.toLowerCase();
      companyCounts.set(key, (companyCounts.get(key) ?? 0) + 1);
    }
  }

  report.duplicateCompanies = Array.from(companyCounts.values()).filter(
    (c) => c > 1,
  ).length;

  return report;
}
