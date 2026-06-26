import type { ParsedImportData } from "@/types";
import type { ImportProvider } from "./types";

export class GoogleSheetProvider implements ImportProvider {
  name = "google-sheet" as const;

  async parse(): Promise<ParsedImportData> {
    throw new Error(
      "Google Sheets integration is not configured. Connect OAuth in a future release.",
    );
  }
}

export const googleSheetProvider = new GoogleSheetProvider();
