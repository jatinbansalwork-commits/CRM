const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_IN_TEXT_REGEX = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Pull an email address out of common spreadsheet cell formats. */
export function extractEmailFromCell(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const mailto = trimmed.match(/^mailto:([^\s?]+)/i);
  if (mailto?.[1]) return normalizeEmail(mailto[1]);

  const angle = trimmed.match(/<([^>]+)>/);
  if (angle?.[1] && EMAIL_IN_TEXT_REGEX.test(angle[1])) {
    return normalizeEmail(angle[1].match(EMAIL_IN_TEXT_REGEX)![0]);
  }

  const match = trimmed.match(EMAIL_IN_TEXT_REGEX);
  if (match?.[0]) return normalizeEmail(match[0]);

  return null;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(normalizeEmail(email));
}

export function extractDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");
  return parts.length === 2 ? parts[1] : null;
}

import { getCompanySlugFromDomain } from "@/lib/utils/company-enrichment";

export function companyFromDomain(domain: string): string {
  return getCompanySlugFromDomain(domain) ?? fallbackCompanyFromDomain(domain);
}

function fallbackCompanyFromDomain(domain: string): string {
  const base = domain.split(".")[0] ?? domain;
  if (!base) return "Unknown";
  return base.length <= 3
    ? base.toUpperCase()
    : base.charAt(0).toUpperCase() + base.slice(1);
}

export function normalizeCompanyName(
  name: string,
  stripSuffixes: string[] = ["LLC", "Inc", "Ltd", "Corp"],
): string {
  let normalized = name.trim();
  for (const suffix of stripSuffixes) {
    const regex = new RegExp(`\\s+${suffix}\\.?$`, "i");
    normalized = normalized.replace(regex, "");
  }
  return normalized.trim();
}

export function parseTags(tags: string | string[] | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
}

export function stringifyTags(tags: string[]): string {
  return JSON.stringify(tags);
}

import { parseClipboardText } from "@/lib/parsers/clipboard-parser";

export function parseDelimitedText(text: string): string[][] {
  const parsed = parseClipboardText(text);
  if (parsed.rowCount === 0) return [];

  const headerRow = parsed.headers;
  return [headerRow, ...parsed.rows.map((row) => headerRow.map((h) => row[h] ?? ""))];
}

export function isRowEmpty(row: Record<string, string>): boolean {
  return Object.values(row).every((v) => !v?.trim());
}

export function detectRoleCategory(role: string | null | undefined): string {
  if (!role) return "Other";
  const lower = role.toLowerCase();
  if (
    lower.includes("recruit") ||
    lower.includes("talent acquisition") ||
    lower.includes("sourcer")
  ) {
    return "Recruiter";
  }
  if (
    lower.includes("hr") ||
    lower.includes("human resources") ||
    lower.includes("people ops") ||
    lower.includes("hrbp")
  ) {
    return "HR";
  }
  if (
    lower.includes("hiring manager") ||
    lower.includes("engineering manager") ||
    lower.includes("director") ||
    lower.includes("vp")
  ) {
    return "Hiring Manager";
  }
  return "Other";
}

export function fuzzyMatch(a: string, b: string): boolean {
  const na = normalizeCompanyName(a).toLowerCase();
  const nb = normalizeCompanyName(b).toLowerCase();
  return na === nb || na.includes(nb) || nb.includes(na);
}
