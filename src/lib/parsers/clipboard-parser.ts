import {
  dedupeHeaders,
  gridToRecords,
  inferHeadersFromGrid,
  looksLikeHeaderRow,
  normalizeHeaderLabel,
} from "./column-inference";
import { suggestColumnMappingFromData } from "@/lib/services/import/column-mapping";
import type { ColumnMapping } from "@/types";

export type ClipboardFormat = "tsv" | "csv" | "semicolon" | "whitespace";

export type ParsedClipboard = {
  format: ClipboardFormat;
  headers: string[];
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  rowCount: number;
  columnCount: number;
};

const COMMENT_PREFIX = /^\s*(#|\/\/)/;

function cleanCell(value: string): string {
  return value
    .replace(/\uFEFF/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\r/g, "")
    .trim();
}

function normalizeClipboardText(text: string): string {
  return text
    .replace(/\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u200B-\u200D\u2060]/g, "");
}

function countDelimiterOutsideQuotes(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delimiter) count++;
  }

  return count;
}

function detectFormat(text: string): ClipboardFormat {
  const lines = text
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0 && !COMMENT_PREFIX.test(l))
    .slice(0, 40);

  if (lines.length === 0) return "tsv";

  const scores = {
    tsv: 0,
    csv: 0,
    semicolon: 0,
    whitespace: 0,
  };

  for (const line of lines) {
    const tabs = countDelimiterOutsideQuotes(line, "\t");
    const commas = countDelimiterOutsideQuotes(line, ",");
    const semis = countDelimiterOutsideQuotes(line, ";");

    if (tabs >= 1) scores.tsv += tabs + 2;
    if (commas >= 1) scores.csv += commas;
    if (semis >= 1) scores.semicolon += semis;

    if (tabs === 0 && commas === 0 && semis === 0) {
      const multiSpace = line.split(/\s{2,}/).length - 1;
      if (multiSpace >= 1) scores.whitespace += multiSpace;
    }
  }

  if (scores.tsv > 0 && scores.tsv >= scores.csv && scores.tsv >= scores.semicolon) {
    return "tsv";
  }
  if (scores.semicolon > scores.csv && scores.semicolon > 0) {
    return "semicolon";
  }
  if (scores.csv > 0) {
    return "csv";
  }
  if (scores.whitespace > 0) {
    return "whitespace";
  }

  return "tsv";
}

function delimiterForFormat(format: ClipboardFormat): string {
  switch (format) {
    case "tsv":
      return "\t";
    case "csv":
      return ",";
    case "semicolon":
      return ";";
    case "whitespace":
      return "WHITESPACE";
    default:
      return "\t";
  }
}

/** RFC-style delimited parse with quoted fields and multiline cells. */
export function parseDelimitedGrid(text: string, delimiter: string): string[][] {
  if (delimiter === "WHITESPACE") {
    return parseWhitespaceGrid(text);
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const flushRow = () => {
    row.push(cleanCell(cell));
    cell = "";
    if (row.some((c) => c.length > 0)) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(cleanCell(cell));
      cell = "";
      continue;
    }

    if (ch === "\n") {
      flushRow();
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    flushRow();
  }

  return rows;
}

function parseWhitespaceGrid(text: string): string[][] {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0 && !COMMENT_PREFIX.test(line))
    .map((line) => {
      if (line.includes("\t")) {
        return line.split("\t").map(cleanCell);
      }
      const byMultiSpace = line.split(/\s{2,}/).map(cleanCell).filter(Boolean);
      if (byMultiSpace.length >= 2) return byMultiSpace;
      return line.split(/\s+/).map(cleanCell);
    });
}

function isCommentOrBlankRow(row: string[]): boolean {
  const joined = row.map(cleanCell).join("").trim();
  if (!joined) return true;
  const first = cleanCell(row[0] ?? "");
  return COMMENT_PREFIX.test(first) || COMMENT_PREFIX.test(joined);
}

function trimEmptyEdgeColumns(grid: string[][]): string[][] {
  if (grid.length === 0) return grid;

  let lastCol = 0;
  for (const row of grid) {
    for (let i = row.length - 1; i >= lastCol; i--) {
      if (cleanCell(row[i] ?? "").length > 0) {
        lastCol = Math.max(lastCol, i + 1);
        break;
      }
    }
  }

  return grid.map((row) => row.slice(0, lastCol));
}

function isRowNumberColumn(values: string[]): boolean {
  const samples = values.map(cleanCell).filter(Boolean);
  if (samples.length < 3) return false;

  let numeric = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (/^\d+$/.test(v)) numeric++;
    if (v === String(i + 1) || v === String(i)) numeric++;
  }

  return numeric / samples.length >= 0.85;
}

function isRowNumberHeader(cell: string): boolean {
  const v = cleanSample(cell);
  return !v || /^#+$/.test(v) || /^row$/i.test(v) || /^#$/i.test(v) || /^no\.?$/i.test(v) || /^index$/i.test(v);
}

function cleanSample(cell: string): string {
  return cleanCell(cell);
}

function dropRowNumberColumn(grid: string[][]): string[][] {
  if (grid.length === 0 || (grid[0]?.length ?? 0) < 2) return grid;

  const firstRow = grid[0] ?? [];
  const dataRows = grid.slice(1);
  const col0Data = dataRows.map((r) => r[0] ?? "");

  const headerSuggestsIndex = isRowNumberHeader(firstRow[0] ?? "");
  const dataSuggestsIndex = isRowNumberColumn(col0Data);

  if (!headerSuggestsIndex && !dataSuggestsIndex) return grid;

  return grid.map((row) => row.slice(1));
}

function dropTrailingIndexColumn(grid: string[][]): string[][] {
  if (grid.length === 0 || (grid[0]?.length ?? 0) < 2) return grid;

  const dataRows = grid.slice(1);
  const lastIdx = (grid[0]?.length ?? 1) - 1;
  const lastCol = dataRows.map((r) => r[lastIdx] ?? "");

  if (isRowNumberColumn(lastCol)) {
    return grid.map((row) => row.slice(0, -1));
  }

  return grid;
}

function padRows(grid: string[][]): string[][] {
  const width = Math.max(...grid.map((r) => r.length), 0);
  return grid.map((row) => {
    const padded = [...row];
    while (padded.length < width) padded.push("");
    return padded;
  });
}

export function parseClipboardText(text: string): ParsedClipboard {
  const normalized = normalizeClipboardText(text);
  const format = detectFormat(normalized);
  const delimiter = delimiterForFormat(format);

  let grid = parseDelimitedGrid(normalized, delimiter)
    .map((row) => row.map(cleanCell))
    .filter((row) => !isCommentOrBlankRow(row));

  grid = trimEmptyEdgeColumns(padRows(grid));
  grid = dropRowNumberColumn(grid);
  grid = dropTrailingIndexColumn(grid);

  if (grid.length === 0) {
    return {
      format,
      headers: [],
      rows: [],
      mapping: {},
      rowCount: 0,
      columnCount: 0,
    };
  }

  const hasHeader = looksLikeHeaderRow(grid[0]);
  let headers: string[];

  if (hasHeader) {
    headers = dedupeHeaders(
      grid[0].map((cell, index) => normalizeHeaderLabel(cell, index)),
    );
    grid = grid.slice(1).filter((row) => !isCommentOrBlankRow(row));
  } else {
    headers = inferHeadersFromGrid(grid, false);
  }

  grid = grid.filter((row) => !isCommentOrBlankRow(row));

  const records = gridToRecords(headers, grid).filter(
    (row) => Object.values(row).some((v) => v.trim().length > 0),
  );

  const mapping = suggestColumnMappingFromData(headers, records);

  return {
    format,
    headers,
    rows: records,
    mapping,
    rowCount: records.length,
    columnCount: headers.length,
  };
}
