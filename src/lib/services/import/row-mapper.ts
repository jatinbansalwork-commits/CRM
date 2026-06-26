import {
  extractEmailFromCell,
  isValidEmail,
  normalizeEmail,
  parseTags,
} from "@/lib/utils/contact";
import { enrichRowCompany } from "@/lib/utils/company-enrichment";
import type { ColumnMapping, ImportRow } from "@/types";

const INTERNAL_COLUMNS = new Set(["__sourceSheet"]);

/** Fields where the first non-empty mapped value wins (multi-tab union headers). */
const COALESCE_FIELDS = new Set<keyof ImportRow>(["email", "name", "company"]);

function setCoalescedField(
  row: ImportRow,
  field: keyof ImportRow,
  value: string,
): void {
  const current = row[field];
  if (current && typeof current === "string" && current.trim()) return;
  (row as Record<string, unknown>)[field] = value;
}

function inferEmailFromRow(
  raw: Record<string, string>,
  mapping: ColumnMapping,
): string | undefined {
  const mappedEmailCols = new Set(
    Object.entries(mapping)
      .filter(([, field]) => field === "email")
      .map(([col]) => col),
  );

  const columns = [
    ...mappedEmailCols,
    ...Object.keys(raw).filter(
      (col) => !INTERNAL_COLUMNS.has(col) && !mappedEmailCols.has(col),
    ),
  ];

  for (const col of columns) {
    const extracted = extractEmailFromCell(raw[col] ?? "");
    if (extracted && isValidEmail(extracted)) {
      return extracted;
    }
  }

  return undefined;
}

export function mapRow(
  raw: Record<string, string>,
  mapping: ColumnMapping,
): ImportRow {
  const row: ImportRow = {};

  for (const [sourceCol, targetField] of Object.entries(mapping)) {
    if (INTERNAL_COLUMNS.has(sourceCol) || !targetField) continue;

    const rawValue = raw[sourceCol]?.trim();
    if (!rawValue) continue;

    if (targetField === "tags") {
      row.tags = parseTags(rawValue);
    } else if (targetField === "priority") {
      row.priority = rawValue.toUpperCase() as ImportRow["priority"];
    } else if (targetField === "status") {
      row.status = rawValue.toUpperCase().replace(/ /g, "_") as ImportRow["status"];
    } else if (targetField === "sourceRow") {
      row.sourceRow = parseInt(rawValue, 10) || undefined;
    } else if (targetField === "email") {
      const email = extractEmailFromCell(rawValue) ?? normalizeEmail(rawValue);
      setCoalescedField(row, "email", email);
    } else if (COALESCE_FIELDS.has(targetField)) {
      setCoalescedField(row, targetField, rawValue);
    } else {
      (row as Record<string, unknown>)[targetField] = rawValue;
    }
  }

  if (!row.email) {
    row.email = inferEmailFromRow(raw, mapping);
  }

  return enrichRowCompany(row);
}
