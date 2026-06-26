import type { ColumnMapping, ImportRow } from "@/types";
import { scoreColumn } from "@/lib/parsers/column-inference";
import {
  suggestColumnMapping,
  suggestColumnMappingFromData,
} from "@/lib/services/import/column-mapping";
import type { DetectedColumn } from "./types";

const MEMORY_KEY = "outreach-crm-import-mapping-patterns";

type SavedPattern = {
  headerSignatures: string[];
  mapping: ColumnMapping;
  lastUsed: string;
};

export function buildColumnDetections(
  headers: string[],
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): DetectedColumn[] {
  const fromHeaders = suggestColumnMapping(headers);

  return headers
    .filter((header) => mapping[header])
    .map((header) => {
      const values = rows.map((r) => r[header] ?? "");
      const { confidence } = scoreColumn(values);
      const field = mapping[header]!;
      const headerMatch = fromHeaders[header] === field;

      return {
        header,
        field,
        confidence: Math.round((headerMatch ? Math.max(confidence, 0.85) : confidence) * 100) / 100,
        source: headerMatch ? ("header" as const) : ("content" as const),
      };
    });
}

export function computeMappingConfidence(detections: DetectedColumn[]): number {
  if (detections.length === 0) return 0;

  const hasEmail = detections.some((d) => d.field === "email");
  if (!hasEmail) return Math.min(0.5, detections.reduce((s, d) => s + d.confidence, 0) / detections.length);

  const avg = detections.reduce((s, d) => s + d.confidence, 0) / detections.length;
  const emailConf = detections.find((d) => d.field === "email")?.confidence ?? 0;
  return Math.round(Math.min(0.99, avg * 0.4 + emailConf * 0.6) * 100) / 100;
}

export function smartMapColumns(
  headers: string[],
  rows: Record<string, string>[],
): { mapping: ColumnMapping; detections: DetectedColumn[]; confidence: number } {
  const fromData = suggestColumnMappingFromData(headers, rows);
  const fromMemory = loadMatchingPattern(headers);
  const mapping: ColumnMapping = { ...fromData };

  if (fromMemory) {
    for (const header of headers) {
      const memField = fromMemory[header];
      if (memField) mapping[header] = memField;
    }
  }

  const detections = buildColumnDetections(headers, rows, mapping).map((d) => ({
    ...d,
    source: fromMemory?.[d.header] ? ("memory" as const) : d.source,
  }));

  return {
    mapping,
    detections,
    confidence: computeMappingConfidence(detections),
  };
}

function loadMatchingPattern(headers: string[]): ColumnMapping | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return null;
    const patterns: SavedPattern[] = JSON.parse(raw);
    const sig = headers.map((h) => h.toLowerCase().trim()).sort().join("|");

    const match = patterns.find(
      (p) => p.headerSignatures.sort().join("|") === sig,
    );
    return match?.mapping ?? null;
  } catch {
    return null;
  }
}

export function saveMappingPattern(headers: string[], mapping: ColumnMapping): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    const patterns: SavedPattern[] = raw ? JSON.parse(raw) : [];
    const sig = headers.map((h) => h.toLowerCase().trim()).sort();

    const existing = patterns.findIndex(
      (p) => p.headerSignatures.sort().join("|") === sig.sort().join("|"),
    );

    const entry: SavedPattern = {
      headerSignatures: sig,
      mapping,
      lastUsed: new Date().toISOString(),
    };

    if (existing >= 0) patterns[existing] = entry;
    else patterns.unshift(entry);

    localStorage.setItem(MEMORY_KEY, JSON.stringify(patterns.slice(0, 20)));
  } catch {
    // ignore storage errors
  }
}
