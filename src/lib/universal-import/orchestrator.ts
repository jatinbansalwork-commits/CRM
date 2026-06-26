import { parseWorkbook, combineSheetsToContacts } from "@/lib/parsers/file-provider";
import { smartMapColumns, buildColumnDetections, computeMappingConfidence } from "./smart-mapper";
import { analyzeQuality, expandRowsWithMultipleEmails } from "./quality-analyzer";
import { filterImportableContactRows } from "@/lib/services/import/column-mapping";
import { normalizeRowRecord } from "./normalize";
import { ALL_PARSERS } from "./parsers";
import { extractTableRegion } from "./messy-sheet";
import type { ImportAnalysis, ImportInput, ParserCandidate } from "./types";

function pickBest(candidates: ParserCandidate[]): ParserCandidate | null {
  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const aEmail = Object.values(a.mapping).includes("email") ? 1 : 0;
    const bEmail = Object.values(b.mapping).includes("email") ? 1 : 0;
    if (bEmail !== aEmail) return bEmail - aEmail;

    const aRatio = a.rows.length > 0 ? 1 : 0;
    const bRatio = b.rows.length > 0 ? 1 : 0;
    const scoreA = a.confidence + aRatio * 0.01;
    const scoreB = b.confidence + bRatio * 0.01;
    return scoreB - scoreA;
  })[0];
}

function candidateToAnalysis(
  best: ParserCandidate,
  all: ParserCandidate[],
  extra: Partial<ImportAnalysis> = {},
): ImportAnalysis {
  const expanded = expandRowsWithMultipleEmails(best.rows, best.mapping);
  const { rows: importable, filtered } = filterImportableContactRows(expanded);
  const quality = analyzeQuality(
    importable,
    best.mapping,
    (best.rowsIgnored ?? 0) + filtered,
  );

  return {
    parserId: best.parserId,
    parserName: best.parserName,
    confidence: best.confidence,
    sheetType: best.sheetType,
    orientation: best.orientation,
    headers: best.headers,
    rows: importable,
    mapping: best.mapping,
    columnDetections: best.columnDetections,
    quality,
    issues: best.issues,
    suggestedFixes: best.suggestedFixes,
    candidates: all.map((c) => ({
      parserId: c.parserId,
      parserName: c.parserName,
      confidence: c.confidence,
    })),
    ...extra,
  };
}

export function runTextOrchestrator(text: string): ImportAnalysis | null {
  const { text: cleaned, rowsIgnored: globalIgnored } = extractTableRegion(text);
  const input: ImportInput = { kind: "text", text: cleaned };
  const candidates: ParserCandidate[] = [];

  for (const parser of ALL_PARSERS) {
    if (!parser.canHandle(input)) continue;
    try {
      const result = parser.parse(input);
      if (result && result.rows.length > 0) {
        candidates.push({
          ...result,
          rowsIgnored: (result.rowsIgnored ?? 0) + globalIgnored,
        });
      }
    } catch {
      // parser failed — try next
    }
  }

  const best = pickBest(candidates);
  if (!best) return null;

  return candidateToAnalysis(best, candidates);
}

export async function runFileOrchestrator(
  buffer: ArrayBuffer,
  filename: string,
): Promise<ImportAnalysis | null> {
  const sheets = parseWorkbook(buffer);
  if (sheets.length === 0) return null;

  const nonEmpty = sheets.filter((s) => s.rowCount > 0);
  const selectedNames = (nonEmpty.length > 0 ? nonEmpty : sheets).map(
    (s) => s.sheetName,
  );
  const { headers, rows } = combineSheetsToContacts(sheets, selectedNames);
  const normalized = rows.map(normalizeRowRecord);

  const { mapping, detections } = smartMapColumns(headers, normalized);
  const expanded = expandRowsWithMultipleEmails(normalized, mapping);
  const { rows: importable, filtered } = filterImportableContactRows(expanded);
  const quality = analyzeQuality(importable, mapping, filtered);
  const confidence = computeMappingConfidence(detections);

  const hasEmail = Object.values(mapping).includes("email");
  const finalConfidence = hasEmail
    ? Math.min(0.99, confidence + (sheets.length > 1 ? 0.02 : 0.05))
    : confidence * 0.5;

  const issues: ImportAnalysis["issues"] = [];
  if (!hasEmail) {
    issues.push({
      severity: "error",
      message: "No email column detected in file",
      suggestion: "Map an email column manually",
    });
  }

  return {
    parserId: "workbook",
    parserName: filename.endsWith(".csv") ? "CSV File" : "Excel Workbook",
    confidence: Math.round(finalConfidence * 100) / 100,
    sheetType: "workbook",
    orientation: "vertical-table",
    headers,
    rows: importable,
    mapping,
    columnDetections: detections,
    quality,
    issues,
    suggestedFixes: finalConfidence < 0.8 ? ["Review column mapping"] : [],
    candidates: [
      {
        parserId: "workbook",
        parserName: "File Upload",
        confidence: finalConfidence,
      },
    ],
    sheets,
    selectedSheetNames: selectedNames,
    filename,
    sheetName:
      selectedNames.length === 1
        ? selectedNames[0]
        : `${selectedNames.length} sheets`,
  };
}

export async function runUniversalImport(
  input: ImportInput,
): Promise<ImportAnalysis | null> {
  if (input.kind === "file") {
    return runFileOrchestrator(input.buffer, input.filename);
  }
  return runTextOrchestrator(input.text);
}

/** Re-analyze after manual mapping change */
export function reanalyzeWithMapping(
  analysis: ImportAnalysis,
  mapping: ImportAnalysis["mapping"],
): ImportAnalysis {
  const expanded = expandRowsWithMultipleEmails(analysis.rows, mapping);
  const { rows: importable, filtered } = filterImportableContactRows(expanded);
  const detections = buildColumnDetections(analysis.headers, importable, mapping);
  const quality = analyzeQuality(
    importable,
    mapping,
    analysis.quality.rowsIgnored + filtered,
  );
  const confidence = computeMappingConfidence(detections);

  return {
    ...analysis,
    mapping,
    columnDetections: detections,
    confidence,
    quality,
    rows: importable,
  };
}
