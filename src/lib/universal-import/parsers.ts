import { parseClipboardText, parseDelimitedGrid } from "@/lib/parsers/clipboard-parser";
import { gridToRecords, dedupeHeaders, inferHeadersFromGrid, looksLikeHeaderRow, normalizeHeaderLabel } from "@/lib/parsers/column-inference";
import { extractEmailFromCell, isValidEmail, companyFromDomain, extractDomain } from "@/lib/utils/contact";
import { extractTableRegion } from "./messy-sheet";
import { detectOrientation, transposeEmailMatrix } from "./orientation";
import { smartMapColumns } from "./smart-mapper";
import { normalizeRowRecord } from "./normalize";
import type { ImportInput, ParserCandidate, UniversalParser } from "./types";

function textFromInput(input: ImportInput): string | null {
  if (input.kind === "text") return input.text;
  return null;
}

function gridFromDelimitedText(text: string, delimiter: string): string[][] {
  return parseDelimitedGrid(text, delimiter);
}

function buildCandidate(
  parserId: string,
  parserName: string,
  sheetType: ParserCandidate["sheetType"],
  orientation: ParserCandidate["orientation"],
  headers: string[],
  rows: Record<string, string>[],
  rowsIgnored = 0,
  baseConfidence = 0.5,
): ParserCandidate | null {
  if (rows.length === 0) return null;

  const normalized = rows.map(normalizeRowRecord);
  const { mapping, detections, confidence: mapConf } = smartMapColumns(headers, normalized);

  const hasEmail = Object.values(mapping).includes("email");
  let confidence = baseConfidence * 0.5 + mapConf * 0.5;
  if (!hasEmail) confidence *= 0.4;
  if (rows.length >= 5 && hasEmail) confidence = Math.min(0.99, confidence + 0.1);

  const issues: ParserCandidate["issues"] = [];
  const suggestedFixes: string[] = [];

  if (!hasEmail) {
    issues.push({
      severity: "error",
      message: "No email column detected",
      suggestion: "Map a column containing @ addresses to Email",
    });
    suggestedFixes.push("Manually map the email column on the next screen");
  }

  if (confidence < 0.8) {
    suggestedFixes.push("Review column mapping before importing");
  }

  return {
    parserId,
    parserName,
    confidence: Math.round(confidence * 100) / 100,
    sheetType,
    orientation,
    headers,
    rows: normalized,
    mapping,
    columnDetections: detections,
    issues,
    suggestedFixes,
    rowsIgnored,
  };
}

/** Google Sheets / Excel clipboard TSV + CSV tables */
export const delimitedTableParser: UniversalParser = {
  id: "delimited-table",
  name: "Delimited Table (TSV/CSV)",
  canHandle: (input) => input.kind === "text" && input.text.trim().length > 0,
  parse(input) {
    const text = textFromInput(input);
    if (!text) return null;

    const parsed = parseClipboardText(text);
    if (parsed.rowCount === 0) return null;

    const orientation =
      parsed.columnCount <= 1 ? "single-column" : "vertical-table";

    return buildCandidate(
      "delimited-table",
      "Delimited Table",
      "standard-table",
      orientation,
      parsed.headers,
      parsed.rows,
      0,
      parsed.columnCount >= 2 ? 0.92 : 0.5,
    );
  },
};

/** Strips titles, separators, notes — then parses table */
export const messySpreadsheetParser: UniversalParser = {
  id: "messy-spreadsheet",
  name: "Messy Spreadsheet",
  canHandle: (input) => input.kind === "text" && input.text.includes("\n"),
  parse(input) {
    const text = textFromInput(input);
    if (!text) return null;

    const { text: cleaned, rowsIgnored } = extractTableRegion(text);
    if (!cleaned.trim()) return null;

    const parsed = parseClipboardText(cleaned);
    if (parsed.rowCount === 0) return null;

    return buildCandidate(
      "messy-spreadsheet",
      "Messy Spreadsheet",
      "messy-spreadsheet",
      "vertical-table",
      parsed.headers,
      parsed.rows,
      rowsIgnored,
      rowsIgnored >= 2 ? 0.98 : 0.7,
    );
  },
};

/** Vertical email list — one email per line */
export const emailListParser: UniversalParser = {
  id: "email-list",
  name: "Email List (Vertical)",
  canHandle: (input) => input.kind === "text",
  parse(input) {
    const text = textFromInput(input);
    if (!text) return null;

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const emailLines = lines.filter((l) => {
      const e = extractEmailFromCell(l);
      return e !== null && isValidEmail(e) && !l.includes("\t") && (l.match(/,/g) ?? []).length < 2;
    });

    if (emailLines.length < Math.max(1, lines.length * 0.6)) return null;

    const rows = emailLines.map((line) => {
      const email = extractEmailFromCell(line)!;
      const domain = extractDomain(email);
      return {
        Email: email,
        Company: domain ? companyFromDomain(domain) : "",
      };
    });

    return buildCandidate(
      "email-list",
      "Email List",
      "email-list",
      "email-list-vertical",
      ["Email", "Company"],
      rows,
      lines.length - emailLines.length,
      0.9,
    );
  },
};

/** Horizontal email matrix — transpose to contacts */
export const emailMatrixParser: UniversalParser = {
  id: "email-matrix",
  name: "Email Matrix (Horizontal)",
  canHandle: (input) => input.kind === "text",
  parse(input) {
    const text = textFromInput(input);
    if (!text) return null;

    const grid =
      text.includes("\t")
        ? gridFromDelimitedText(text, "\t")
        : gridFromDelimitedText(text, ",");

    const orientation = detectOrientation(grid);
    if (orientation !== "horizontal-matrix") return null;

    const transposed = transposeEmailMatrix(grid);
    const rows = transposed.map(([email]) => {
      const domain = extractDomain(email);
      return {
        Email: email,
        Company: domain ? companyFromDomain(domain) : "",
      };
    });

    if (rows.length === 0) return null;

    return buildCandidate(
      "email-matrix",
      "Email Matrix",
      "email-matrix",
      "horizontal-matrix",
      ["Email", "Company"],
      rows,
      0,
      0.94,
    );
  },
};

/** Headerless rows — infer columns from content */
export const headerlessParser: UniversalParser = {
  id: "headerless",
  name: "Headerless Table",
  canHandle: (input) => input.kind === "text",
  parse(input) {
    const text = textFromInput(input);
    if (!text) return null;

    const grid = gridFromDelimitedText(
      text,
      text.includes("\t") ? "\t" : ",",
    ).filter((r) => r.some((c) => c.trim()));

    if (grid.length < 2) return null;
    if (looksLikeHeaderRow(grid[0])) return null;

    const headers = inferHeadersFromGrid(grid, false);
    const records = gridToRecords(headers, grid);

    if (records.length === 0) return null;

    return buildCandidate(
      "headerless",
      "Headerless Table",
      "headerless",
      "vertical-table",
      headers,
      records,
      0,
      0.82,
    );
  },
};

/** Free-text blocks with mixed fields per row (tab or multi-space separated) */
export const freeTextParser: UniversalParser = {
  id: "free-text",
  name: "Free Text / Mixed",
  canHandle: (input) => input.kind === "text",
  parse(input) {
    const text = textFromInput(input);
    if (!text) return null;

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: Record<string, string>[] = [];

    for (const line of lines) {
      const parts = line.includes("\t")
        ? line.split("\t").map((p) => p.trim())
        : line.split(/\s{2,}/).map((p) => p.trim());

      if (parts.length < 2) continue;

      const record: Record<string, string> = {};
      parts.forEach((part, i) => {
        record[`Field ${i + 1}`] = part;
      });
      rows.push(record);
    }

    if (rows.length < 2) return null;

    const headers = Object.keys(rows[0] ?? {});
    return buildCandidate(
      "free-text",
      "Mixed Data",
      "headerless",
      "mixed",
      headers,
      rows,
      0,
      0.65,
    );
  },
};

export const ALL_PARSERS: UniversalParser[] = [
  delimitedTableParser,
  messySpreadsheetParser,
  emailMatrixParser,
  emailListParser,
  headerlessParser,
  freeTextParser,
];
