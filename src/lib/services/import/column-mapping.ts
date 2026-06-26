import type { ColumnMapping, ImportRow } from "@/types";
import { inferMappingFromContent, scoreColumn } from "@/lib/parsers/column-inference";

const INTERNAL_COLUMNS = new Set(["__sourceSheet"]);

/** Headers that likely hold an email — including multi-tab variants like "Work Email". */
export function isEmailColumnHeader(header: string): boolean {
  const h = header.trim().toLowerCase();
  if (!h || INTERNAL_COLUMNS.has(h)) return false;

  if (/e-?mail/i.test(h)) return true;
  if (/\b(email|e-mail)\b/i.test(h)) return true;
  if (/^(work|primary|business|contact|personal|corp|company)\s*(e-?)?mail/i.test(h)) {
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

/**
 * Merge header-name mapping with content heuristics so paste imports
 * rarely need manual column mapping.
 */
export function suggestColumnMappingFromData(
  headers: string[],
  rows: Record<string, string>[],
): ColumnMapping {
  const fromHeaders = suggestColumnMapping(headers);
  const fromContent = inferMappingFromContent(headers, rows);
  const merged: ColumnMapping = { ...fromContent };

  for (const header of headers) {
    if (fromHeaders[header]) {
      merged[header] = fromHeaders[header];
    }
  }

  if (!Object.values(merged).includes("email")) {
    for (const header of headers) {
      const values = rows.map((r) => r[header] ?? "");
      const { type, confidence } = scoreColumn(values);
      if (type === "email" && confidence >= 0.25) {
        merged[header] = "email";
      }
    }
  }

  return merged;
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

  return merged;
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
