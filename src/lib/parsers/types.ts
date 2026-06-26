import type { ParsedImportData } from "@/types";
import type { ImportSource } from "@/lib/constants";

export interface ImportProvider {
  name: ImportSource;
  parse(input: unknown): Promise<ParsedImportData>;
}

export interface ImportProviderResult {
  provider: ImportProvider;
  available: boolean;
  message?: string;
}
