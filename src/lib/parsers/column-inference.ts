import {
  extractEmailFromCell,
  isValidEmail,
  normalizeEmail,
} from "@/lib/utils/contact";
import type { ColumnMapping, ImportRow } from "@/types";

export type InferredColumnType =
  | keyof ImportRow
  | "phone"
  | "unknown"
  | "skip";

const ROLE_KEYWORDS =
  /\b(manager|engineer|director|vp|ceo|cto|cfo|founder|recruiter|talent|people|hiring|hr|human resources|analyst|designer|developer|lead|head of|president|coordinator|specialist|consultant|associate|partner|intern|sourcer)\b/i;

const COMPANY_SUFFIX = /\b(inc|llc|ltd|corp|gmbh|plc|co\.|company|group|holdings)\b/i;

function cleanSample(value: string): string {
  return value
    .replace(/\uFEFF/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .trim();
}

function isLikelyEmail(value: string): boolean {
  const extracted = extractEmailFromCell(value);
  return extracted !== null && isValidEmail(extracted);
}

function isLikelyLinkedIn(value: string): boolean {
  const v = cleanSample(value).toLowerCase();
  return v.includes("linkedin.com/in/") || v.includes("linkedin.com/company/");
}

function isLikelyUrl(value: string): boolean {
  const v = cleanSample(value);
  if (isLikelyLinkedIn(v)) return false;
  return /^https?:\/\//i.test(v) || /^www\./i.test(v) || /^[a-z0-9-]+\.(com|io|co|org|net)\b/i.test(v);
}

function isLikelyPersonName(value: string): boolean {
  const v = cleanSample(value);
  if (!v || v.length > 80) return false;
  if (/@|https?:\/\//i.test(v)) return false;
  if (/^\d+$/.test(v)) return false;
  if (isLikelyEmail(v) || isLikelyLinkedIn(v)) return false;

  const normalized = v.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;

  const letterRatio =
    normalized.replace(/[^a-zA-ZÀ-ÿ]/g, "").length / normalized.length;
  return letterRatio > 0.7;
}

function isLikelyRole(value: string): boolean {
  const v = cleanSample(value);
  if (!v || v.length > 120) return false;
  if (/@|https?:\/\//i.test(v)) return false;
  return ROLE_KEYWORDS.test(v);
}

function isLikelyCompany(value: string): boolean {
  const v = cleanSample(value);
  if (!v || v.length > 150) return false;
  if (/@|https?:\/\//i.test(v)) return false;
  if (isLikelyPersonName(v) && !COMPANY_SUFFIX.test(v)) return false;
  if (COMPANY_SUFFIX.test(v)) return true;
  if (v.length >= 3 && /^[A-Z0-9][A-Za-z0-9 &.'-]+$/.test(v) && v.split(" ").length <= 8) {
    return true;
  }
  return false;
}

function isLikelyPhone(value: string): boolean {
  const digits = cleanSample(value).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function isHeaderKeyword(value: string): boolean {
  const v = cleanSample(value).toLowerCase();
  return /^(name|email|e-?mail|company|organization|org|title|role|linkedin|website|phone|notes?|status|priority|department|tags?)$/.test(
    v,
  ) || /e-?mail|linkedin|company|name|title|role/.test(v);
}

export function scoreColumn(values: string[]): {
  type: InferredColumnType;
  confidence: number;
} {
  const samples = values.map(cleanSample).filter(Boolean).slice(0, 300);
  if (samples.length === 0) {
    return { type: "unknown", confidence: 0 };
  }

  const n = samples.length;
  const rates = {
    email: samples.filter(isLikelyEmail).length / n,
    linkedin: samples.filter(isLikelyLinkedIn).length / n,
    website: samples.filter(isLikelyUrl).length / n,
    name: samples.filter(isLikelyPersonName).length / n,
    role: samples.filter(isLikelyRole).length / n,
    company: samples.filter(isLikelyCompany).length / n,
    phone: samples.filter(isLikelyPhone).length / n,
  };

  const ranked: [InferredColumnType, number][] = [
    ["email", rates.email],
    ["linkedin", rates.linkedin],
    ["website", rates.website],
    ["role", rates.role],
    ["name", rates.name],
    ["company", rates.company],
    ["phone", rates.phone],
  ];

  ranked.sort((a, b) => b[1] - a[1]);
  const [bestType, bestRate] = ranked[0];

  const thresholds: Partial<Record<InferredColumnType, number>> = {
    email: 0.35,
    linkedin: 0.4,
    website: 0.35,
    role: 0.25,
    name: 0.35,
    company: 0.3,
    phone: 0.5,
  };

  const threshold = thresholds[bestType] ?? 0.4;
  if (bestRate >= threshold) {
    return { type: bestType, confidence: bestRate };
  }

  return { type: "unknown", confidence: bestRate };
}

export function looksLikeHeaderRow(row: string[]): boolean {
  const cells = row.map(cleanSample).filter(Boolean);
  if (cells.length < 2) return false;

  const keywordHits = cells.filter(isHeaderKeyword).length;
  const emailHits = cells.filter(isLikelyEmail).length;

  if (keywordHits >= 2) return true;
  if (keywordHits >= 1 && emailHits === 0) return true;
  if (/^(hr\s*)?(name|email|company)/i.test(cells.join(" ")) && keywordHits >= 1) return true;

  const typed = cells.map((cell) => scoreColumn([cell]).type);
  const headerLike = typed.filter((t) => t === "unknown").length;
  return headerLike / cells.length >= 0.6 && emailHits <= 1;
}

export function inferHeadersFromGrid(
  grid: string[][],
  hasHeaderRow: boolean,
): string[] {
  const dataRows = hasHeaderRow ? grid.slice(1) : grid;
  const colCount = Math.max(...grid.map((r) => r.length), 0);
  const headers: string[] = [];

  const usedTypes = new Map<InferredColumnType, number>();

  for (let col = 0; col < colCount; col++) {
    const columnValues = dataRows.map((row) => row[col] ?? "");
    const { type, confidence } = scoreColumn(columnValues);

    if (type === "unknown" || type === "skip" || confidence < 0.35) {
      headers.push(`Column ${col + 1}`);
      continue;
    }

    const importField = type === "phone" ? "unknown" : type;
    const baseLabel =
      importField === "email"
        ? "Email"
        : importField === "name"
          ? "Name"
          : importField === "company"
            ? "Company"
            : importField === "role"
              ? "Role"
              : importField === "linkedin"
                ? "LinkedIn"
                : importField === "website"
                  ? "Website"
                  : importField === "department"
                    ? "Department"
                    : importField === "notes"
                      ? "Notes"
                      : `Column ${col + 1}`;

    const count = usedTypes.get(type) ?? 0;
    usedTypes.set(type, count + 1);
    headers.push(count === 0 ? baseLabel : `${baseLabel} ${count + 1}`);
  }

  return headers;
}

export function inferMappingFromContent(
  headers: string[],
  rows: Record<string, string>[],
): ColumnMapping {
  const mapping: ColumnMapping = {};
  const assignedFields = new Set<keyof ImportRow>();

  const scored = headers.map((header, index) => {
    const values = rows.map((row) => row[header] ?? "");
    const { type, confidence } = scoreColumn(values);
    return { header, index, type, confidence };
  });

  scored.sort((a, b) => b.confidence - a.confidence);

  for (const { header, type, confidence } of scored) {
    if (type === "unknown" || type === "skip" || type === "phone") continue;
    if (confidence < 0.35) continue;

    if (type === "email") {
      mapping[header] = "email";
      continue;
    }

    if (!assignedFields.has(type)) {
      mapping[header] = type;
      assignedFields.add(type);
    }
  }

  return mapping;
}

export function normalizeHeaderLabel(header: string, index: number): string {
  const cleaned = cleanSample(header)
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ");

  if (!cleaned || /^column\s*\d+$/i.test(cleaned) || /^field\s*\d+$/i.test(cleaned)) {
    return `Column ${index + 1}`;
  }

  return cleaned;
}

export function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = normalizeHeaderLabel(header, index) || `Column ${index + 1}`;
    const count = seen.get(base.toLowerCase()) ?? 0;
    seen.set(base.toLowerCase(), count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

export function gridToRecords(
  headers: string[],
  grid: string[][],
): Record<string, string>[] {
  return grid.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = cleanSample(row[i] ?? "");
    });
    return record;
  });
}
