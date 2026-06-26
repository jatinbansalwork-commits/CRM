import type { ColumnMapping, ImportRow, ParsedSheetData } from "@/types";

export type SheetOrientation =
  | "vertical-table"
  | "horizontal-matrix"
  | "email-list-vertical"
  | "single-column"
  | "mixed";

export type SheetType =
  | "standard-table"
  | "hr-table"
  | "email-list"
  | "email-matrix"
  | "headerless"
  | "messy-spreadsheet"
  | "workbook"
  | "free-text";

export type DetectedColumn = {
  header: string;
  field: keyof ImportRow;
  confidence: number;
  source: "header" | "content" | "memory";
};

export type QualityReport = {
  totalRows: number;
  validContacts: number;
  duplicateEmails: number;
  duplicateCompanies: number;
  missingEmail: number;
  missingCompany: number;
  missingName: number;
  invalidEmails: number;
  emptyRows: number;
  rowsIgnored: number;
  multiEmailRows: number;
  companiesEnriched: number;
};

export type ParseIssue = {
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
};

export type ParserCandidate = {
  parserId: string;
  parserName: string;
  confidence: number;
  sheetType: SheetType;
  orientation: SheetOrientation;
  headers: string[];
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  columnDetections: DetectedColumn[];
  issues: ParseIssue[];
  suggestedFixes: string[];
  rowsIgnored?: number;
};

export type ImportAnalysis = {
  parserId: string;
  parserName: string;
  confidence: number;
  sheetType: SheetType;
  orientation: SheetOrientation;
  headers: string[];
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  columnDetections: DetectedColumn[];
  quality: QualityReport;
  issues: ParseIssue[];
  suggestedFixes: string[];
  candidates: { parserId: string; parserName: string; confidence: number }[];
  sheets?: ParsedSheetData[];
  selectedSheetNames?: string[];
  filename?: string;
  sheetName?: string;
};

export type ImportInput =
  | { kind: "text"; text: string }
  | { kind: "file"; buffer: ArrayBuffer; filename: string };

export interface UniversalParser {
  id: string;
  name: string;
  canHandle(input: ImportInput): boolean;
  parse(input: ImportInput): ParserCandidate | null;
}
