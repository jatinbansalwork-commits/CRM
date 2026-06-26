import { runTextOrchestrator } from "@/lib/universal-import/orchestrator";
import type { ParsedImportData } from "@/types";
import type { ImportProvider } from "./types";

export class PasteTableProvider implements ImportProvider {
  name = "paste-table" as const;

  async parse(input: { text: string }): Promise<ParsedImportData> {
    const analysis = runTextOrchestrator(input.text);

    if (!analysis || analysis.rows.length === 0) {
      return { headers: [], rows: [] };
    }

    return {
      headers: analysis.headers,
      rows: analysis.rows,
      parseMeta: {
        format: analysis.sheetType,
        columnCount: analysis.headers.length,
        rowCount: analysis.rows.length,
        mapping: analysis.mapping,
        confidence: analysis.confidence,
        parserId: analysis.parserId,
        quality: analysis.quality,
        columnDetections: analysis.columnDetections,
        issues: analysis.issues,
      },
    };
  }
}

export const pasteTableProvider = new PasteTableProvider();
