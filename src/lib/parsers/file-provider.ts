import * as XLSX from "xlsx";
import type { ParsedImportData, ParsedSheetData } from "@/types";
import type { ImportProvider } from "./types";
import { combineSheetsToContacts } from "./workbook-normalizer";

export { combineSheetsToContacts };

const SOURCE_SHEET_KEY = "__sourceSheet";

function parseSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
): ParsedSheetData {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { sheetName, headers: [], rows: [], rowCount: 0 };
  }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (raw.length === 0) {
    return { sheetName, headers: [], rows: [], rowCount: 0 };
  }

  const headers = Object.keys(raw[0] ?? {});
  const rows = raw.map((row) => {
    const mapped: Record<string, string> = {};
    for (const h of headers) {
      mapped[h] = String(row[h] ?? "").trim();
    }
    return mapped;
  });

  return { sheetName, headers, rows, rowCount: rows.length };
}

export function parseWorkbook(buffer: ArrayBuffer): ParsedSheetData[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  return workbook.SheetNames.map((sheetName) => parseSheet(workbook, sheetName));
}

export function combineSheets(
  sheets: ParsedSheetData[],
  selectedSheetNames: string[],
): { headers: string[]; rows: Record<string, string>[] } {
  const selected = sheets.filter((s) => selectedSheetNames.includes(s.sheetName));
  const headerSet = new Set<string>();

  for (const sheet of selected) {
    for (const header of sheet.headers) {
      headerSet.add(header);
    }
  }

  const headers = Array.from(headerSet);
  const rows: Record<string, string>[] = [];

  for (const sheet of selected) {
    for (const row of sheet.rows) {
      const combined: Record<string, string> = {
        [SOURCE_SHEET_KEY]: sheet.sheetName,
      };
      for (const header of headers) {
        combined[header] = row[header] ?? "";
      }
      rows.push(combined);
    }
  }

  return { headers, rows };
}

export function getSourceSheetFromRow(row: Record<string, string>): string | undefined {
  return row[SOURCE_SHEET_KEY];
}

export class FileProvider implements ImportProvider {
  name = "file" as const;

  async parse(input: { buffer: ArrayBuffer; filename: string }): Promise<ParsedImportData> {
    const sheets = parseWorkbook(input.buffer);
    if (sheets.length === 0) {
      throw new Error("Spreadsheet has no sheets");
    }

    const nonEmpty = sheets.filter((s) => s.rowCount > 0);
    const defaultSheets = nonEmpty.length > 0 ? nonEmpty : sheets;
    const selectedNames = defaultSheets.map((s) => s.sheetName);
    const { headers, rows } = combineSheetsToContacts(sheets, selectedNames);
    const primary = defaultSheets[0];

    return {
      headers,
      rows,
      sheetName: primary?.sheetName,
      sheets,
      selectedSheetNames: selectedNames,
    };
  }
}

export const fileProvider = new FileProvider();
