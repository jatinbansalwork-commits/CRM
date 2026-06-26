import {
  isValidEmail,
  extractDomain,
  companyFromDomain,
  normalizeEmail,
} from "@/lib/utils/contact";
import { parseClipboardText } from "./clipboard-parser";
import type { ParsedImportData } from "@/types";
import type { ImportProvider } from "./types";

function looksLikeTable(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
  if (lines.length === 0) return false;
  const tabbed = lines.filter((l) => (l.match(/\t/g) ?? []).length >= 2).length;
  const csv = lines.filter((l) => (l.match(/,/g) ?? []).length >= 2).length;
  return tabbed >= 2 || csv >= 2;
}

export class EmailListProvider implements ImportProvider {
  name = "email-list" as const;

  async parse(input: { text: string }): Promise<ParsedImportData> {
    if (looksLikeTable(input.text)) {
      const parsed = parseClipboardText(input.text);
      return {
        headers: parsed.headers,
        rows: parsed.rows,
        parseMeta: {
          format: parsed.format,
          columnCount: parsed.columnCount,
          rowCount: parsed.rowCount,
          mapping: parsed.mapping,
        },
      };
    }

    const lines = input.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const headers = ["Email", "Company", "Domain"];
    const rows: Record<string, string>[] = [];

    for (const line of lines) {
      const email = normalizeEmail(line.replace(/^mailto:/i, ""));
      if (!isValidEmail(email)) continue;

      const domain = extractDomain(email);
      const company = domain ? companyFromDomain(domain) : "";

      rows.push({
        Email: email,
        Company: company,
        Domain: domain ?? "",
      });
    }

    return { headers, rows };
  }
}

export const emailListProvider = new EmailListProvider();
