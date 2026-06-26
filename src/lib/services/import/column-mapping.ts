import type { ColumnMapping, ImportRow } from "@/types";
import {
  inferMappingFromContent,
  scoreColumn,
} from "@/lib/parsers/column-inference";
import {
  extractEmailFromCell,
  isRowEmpty,
  isValidEmail,
} from "@/lib/utils/contact";

const INTERNAL_COLUMNS = new Set(["__sourceSheet"]);

/** Headers that likely hold an email — including multi-tab variants like "Work Email". */
export function isEmailColumnHeader(header: string): boolean {
  const h = header.trim().toLowerCase();
  if (!h || INTERNAL_COLUMNS.has(h)) return false;

  if (/e-?mail/i.test(h)) return true;
  if (/\b(email|e-mail)\b/i.test(h)) return true;
  if (/^(work|primary|business|contact|personal|corp|company|hr)\s*(e-?)?mail/i.test(h)) {
    return true;
  }
  if (/(e-?)?mail[\s_-]*(address|addr|id)?$/i.test(h)) return true;

  return false;
}

function isNameColumnHeader(header: string): boolean {
  const h = header.trim().toLowerCase();
  if (!h || INTERNAL_COLUMNS.has(h)) return false;
  return (
    /^(full\s*)?name|contact(\s*name)?|first\s*name|last\s*name|person|hr\s*name|recruiter(\s*name)?|hiring\s*manager|contact\s*person/i.test(h) ||
    /^(name|recruiter|contact)$/i.test(h)
  );
}

function isCompanyColumnHeader(header: string): boolean {
  const h = header.trim().toLowerCase();
  if (!h || INTERNAL_COLUMNS.has(h)) return false;
  return /^(company|organization|organisation|org|employer|firm|account|client|vendor|customer)(\s*name)?$/i.test(h);
}

function isRoleColumnHeader(header: string): boolean {
  const h = header.trim().toLowerCase();
  if (!h || INTERNAL_COLUMNS.has(h)) return false;
  return /^(role|designation|title|position|job\s*title|job\s*role|department)$/i.test(h);
}

function isLinkedInColumnHeader(header: string): boolean {
  const h = header.trim().toLowerCase();
  return /linkedin(\s*url|\s*profile|\s*link)?|^profile$/i.test(h);
}

function isWebsiteColumnHeader(header: string): boolean {
  const h = header.trim().toLowerCase();
  return /^(website|web\s*site|url|site|homepage|domain|company\s*website)$/i.test(h);
}

type HeaderMatcher = (header: string) => boolean;

function regexHeader(pattern: RegExp): HeaderMatcher {
  return (header) => pattern.test(header.trim());
}

function headerBonus(header: string, field: keyof ImportRow): number {
  const matchers: Partial<Record<keyof ImportRow, HeaderMatcher>> = {
    email: isEmailColumnHeader,
    name: isNameColumnHeader,
    company: isCompanyColumnHeader,
    role: isRoleColumnHeader,
    linkedin: isLinkedInColumnHeader,
    website: isWebsiteColumnHeader,
    department: regexHeader(/^(department|dept|team)$/i),
    notes: regexHeader(/^(notes?|comment)$/i),
    priority: regexHeader(/^(priority)$/i),
    status: regexHeader(/^(status)$/i),
    tags: regexHeader(/^(tags?|labels?)$/i),
  };
  const match = matchers[field];
  return match?.(header) ? 0.28 : 0;
}

const MAPPING_FIELDS: (keyof ImportRow)[] = [
  "email",
  "name",
  "company",
  "role",
  "department",
  "linkedin",
  "website",
  "notes",
  "priority",
  "status",
  "tags",
];

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const patterns: [HeaderMatcher, keyof ImportRow][] = [
    [isNameColumnHeader, "name"],
    [isEmailColumnHeader, "email"],
    [isCompanyColumnHeader, "company"],
    [isRoleColumnHeader, "role"],
    [regexHeader(/^(department|dept|team)$/i), "department"],
    [isLinkedInColumnHeader, "linkedin"],
    [isWebsiteColumnHeader, "website"],
    [regexHeader(/^(notes?|comment)$/i), "notes"],
    [regexHeader(/^(priority)$/i), "priority"],
    [regexHeader(/^(status)$/i), "status"],
    [regexHeader(/^(tags?|labels?)$/i), "tags"],
  ];

  for (const header of headers) {
    if (INTERNAL_COLUMNS.has(header)) continue;
    for (const [match, field] of patterns) {
      if (match(header)) {
        mapping[header] = field;
        break;
      }
    }
  }

  return mapping;
}

function contentTypeMatchesField(
  type: string,
  field: keyof ImportRow,
): boolean {
  if (type === field) return true;
  if (field === "email" && type === "email") return true;
  return false;
}

/**
 * Pick one best column per field. Content scores win over misleading headers
 * (e.g. "Name" column that actually contains emails).
 */
export function sanitizeColumnMapping(
  headers: string[],
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): ColumnMapping {
  const byField = new Map<keyof ImportRow, { header: string; score: number }>();

  for (const [header, field] of Object.entries(mapping)) {
    if (!field || INTERNAL_COLUMNS.has(header)) continue;

    const values = rows.map((r) => r[header] ?? "");
    const { type, confidence } = scoreColumn(values);
    let score = contentTypeMatchesField(type, field) ? confidence : 0;
    score += headerBonus(header, field);

    const existing = byField.get(field);
    if (!existing || score > existing.score) {
      byField.set(field, { header, score });
    }
  }

  const clean: ColumnMapping = {};
  for (const [field, { header }] of byField) {
    clean[header] = field;
  }
  return clean;
}

export function suggestColumnMappingFromData(
  headers: string[],
  rows: Record<string, string>[],
): ColumnMapping {
  if (headers.length === 0 || rows.length === 0) {
    return suggestColumnMapping(headers);
  }

  const mapping: ColumnMapping = {};
  const usedHeaders = new Set<string>();

  for (const field of MAPPING_FIELDS) {
    let bestHeader: string | null = null;
    let bestScore = 0;

    for (const header of headers) {
      if (INTERNAL_COLUMNS.has(header) || usedHeaders.has(header)) continue;

      const values = rows.map((r) => r[header] ?? "");
      const { type, confidence } = scoreColumn(values);
      let score = contentTypeMatchesField(type, field) ? confidence : 0;
      score += headerBonus(header, field);

      const minScore = field === "email" ? 0.22 : 0.3;
      if (score >= minScore && score > bestScore) {
        bestScore = score;
        bestHeader = header;
      }
    }

    if (bestHeader) {
      mapping[bestHeader] = field;
      usedHeaders.add(bestHeader);
    }
  }

  if (!Object.values(mapping).includes("email")) {
    const fallback = inferMappingFromContent(headers, rows);
    for (const [header, field] of Object.entries(fallback)) {
      if (field === "email" && !usedHeaders.has(header)) {
        mapping[header] = "email";
        usedHeaders.add(header);
        break;
      }
    }
  }

  return sanitizeColumnMapping(headers, rows, mapping);
}

/** Keep manual mappings when tabs change; fill gaps with new suggestions. */
export function mergeColumnMapping(
  previous: ColumnMapping,
  headers: string[],
  rows: Record<string, string>[] = [],
): ColumnMapping {
  const suggested =
    rows.length > 0
      ? suggestColumnMappingFromData(headers, rows)
      : suggestColumnMapping(headers);
  const merged: ColumnMapping = { ...suggested };

  for (const header of headers) {
    if (previous[header]) {
      merged[header] = previous[header];
    }
  }

  return sanitizeColumnMapping(headers, rows, merged);
}

export function hasEmailColumnMapped(mapping: ColumnMapping): boolean {
  return Object.values(mapping).includes("email");
}

/** Columns that look like email but aren't mapped yet — helps multi-tab imports. */
export function unmappedLikelyEmailColumns(
  headers: string[],
  mapping: ColumnMapping,
): string[] {
  return headers.filter(
    (h) => isEmailColumnHeader(h) && mapping[h] !== "email",
  );
}

export function rowContainsEmail(raw: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(raw)) {
    if (INTERNAL_COLUMNS.has(key) || key.startsWith("__")) continue;
    const extracted = extractEmailFromCell(value);
    if (extracted && isValidEmail(extracted)) return true;
  }
  return false;
}

/** Drop blank rows, index-only rows, and rows with no email anywhere. */
export function filterImportableContactRows(
  rows: Record<string, string>[],
): { rows: Record<string, string>[]; filtered: number } {
  const kept: Record<string, string>[] = [];
  let filtered = 0;

  for (const row of rows) {
    if (isRowEmpty(row)) {
      filtered++;
      continue;
    }

    const values = Object.entries(row)
      .filter(([k]) => !INTERNAL_COLUMNS.has(k) && !k.startsWith("__"))
      .map(([, v]) => v.trim())
      .filter(Boolean);

    if (values.length === 1 && /^\d{1,5}$/.test(values[0])) {
      filtered++;
      continue;
    }

    if (values.length > 0 && values.every((v) => /^\d{1,5}$/.test(v))) {
      filtered++;
      continue;
    }

    if (!rowContainsEmail(row)) {
      filtered++;
      continue;
    }

    kept.push(row);
  }

  return { rows: kept, filtered };
}
