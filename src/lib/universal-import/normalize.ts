import {
  extractEmailFromCell,
  isValidEmail,
  normalizeEmail,
  normalizeCompanyName,
  extractDomain,
} from "@/lib/utils/contact";
import type { ImportRow } from "@/types";

const HIDDEN_CHARS = /[\uFEFF\u200B-\u200D\u2060]/g;

export function cleanCellValue(value: string): string {
  return value
    .replace(HIDDEN_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeRowRecord(
  row: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("__")) {
      out[key] = value;
      continue;
    }
    out[key] = cleanCellValue(value);
  }
  return out;
}

export function normalizeImportRow(row: ImportRow): ImportRow {
  const normalized: ImportRow = { ...row };

  if (row.email) {
    const extracted = extractEmailFromCell(row.email) ?? row.email;
    normalized.email = isValidEmail(extracted)
      ? normalizeEmail(extracted)
      : normalizeEmail(extracted);
  }

  if (row.name) normalized.name = cleanCellValue(row.name);
  if (row.company) normalized.company = normalizeCompanyName(cleanCellValue(row.company));
  if (row.role) normalized.role = cleanCellValue(row.role);
  if (row.linkedin) normalized.linkedin = cleanCellValue(row.linkedin);
  if (row.website) normalized.website = cleanCellValue(row.website);
  if (row.notes) normalized.notes = cleanCellValue(row.notes);

  if (normalized.email && !normalized.company) {
    const domain = extractDomain(normalized.email);
    if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"].includes(domain)) {
      // domain available for company inference at import time
    }
  }

  return normalized;
}

/** Split comma/semicolon/pipe separated emails in a single cell. */
export function splitEmailsFromCell(value: string): string[] {
  const trimmed = cleanCellValue(value);
  if (!trimmed) return [];

  const parts = trimmed.split(/[,;|]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    const single = extractEmailFromCell(trimmed);
    return single && isValidEmail(single) ? [single] : [];
  }

  const emails: string[] = [];
  for (const part of parts) {
    const extracted = extractEmailFromCell(part);
    if (extracted && isValidEmail(extracted)) {
      emails.push(normalizeEmail(extracted));
    }
  }
  return emails;
}
