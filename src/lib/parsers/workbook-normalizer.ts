import {
  extractEmailFromCell,
  extractDomain,
  companyFromDomain,
  isValidEmail,
  normalizeEmail,
} from "@/lib/utils/contact";
import type { ParsedSheetData } from "@/types";

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
]);

function headerLooksLikeEmail(header: string): boolean {
  const extracted = extractEmailFromCell(header);
  return extracted !== null && isValidEmail(extracted);
}

/** First row of sheet is a row of email addresses used as column keys. */
export function headersLookLikeEmails(headers: string[]): boolean {
  const meaningful = headers.filter((h) => h.trim() && !h.startsWith("__"));
  if (meaningful.length < 3) return false;

  const emailHeaders = meaningful.filter(headerLooksLikeEmail);
  return emailHeaders.length / meaningful.length >= 0.4;
}

function addContact(
  seen: Set<string>,
  contacts: Record<string, string>[],
  raw: string,
  extra: Record<string, string> = {},
) {
  const extracted = extractEmailFromCell(raw);
  if (!extracted || !isValidEmail(extracted)) return;

  const email = normalizeEmail(extracted);
  if (seen.has(email)) return;
  seen.add(email);

  const domain = extractDomain(email);
  const company =
    extra.Company?.trim() ||
    (domain && !PERSONAL_DOMAINS.has(domain) ? companyFromDomain(domain) : "");

  contacts.push({
    Name: extra.Name?.trim() ?? "",
    Email: email,
    Company: company,
    Role: extra.Role?.trim() ?? "",
  });
}

/** Flatten sheets where emails are column headers or spread across a wide grid. */
function extractContactsFromEmailGrid(
  headers: string[],
  rows: Record<string, string>[],
): Record<string, string>[] {
  const seen = new Set<string>();
  const contacts: Record<string, string>[] = [];

  for (const header of headers) {
    addContact(seen, contacts, header);
  }

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith("__")) continue;
      addContact(seen, contacts, key);
      if (value.trim()) {
        addContact(seen, contacts, value, {
          Name: headerLooksLikeEmail(key) ? "" : key,
        });
      }
    }
  }

  return contacts;
}

function extractContactsFromVerticalEmailColumn(
  header: string,
  rows: Record<string, string>[],
): Record<string, string>[] {
  const seen = new Set<string>();
  const contacts: Record<string, string>[] = [];

  for (const row of rows) {
    const cell = row[header] ?? "";
    addContact(seen, contacts, cell);
  }

  return contacts;
}

/**
 * Normalize one workbook sheet to standard contact rows.
 * Handles HR tables, vertical email lists, and horizontal email matrices.
 */
export function normalizeSheetToContacts(
  sheet: ParsedSheetData,
): Record<string, string>[] {
  const { headers, rows } = sheet;
  if (headers.length === 0 || rows.length === 0) return [];

  if (headersLookLikeEmails(headers) || headers.length >= 25) {
    const emailRate = headers.filter(headerLooksLikeEmail).length / headers.length;
    if (emailRate >= 0.35 || headers.length >= 40) {
      return extractContactsFromEmailGrid(headers, rows);
    }
  }

  if (headers.length === 1) {
    const header = headers[0];
    const samples = rows.slice(0, 50).map((r) => r[header] ?? "").filter(Boolean);
    const emailSamples = samples.filter((v) => {
      const e = extractEmailFromCell(v);
      return e !== null && isValidEmail(e);
    });
    if (emailSamples.length >= Math.max(3, samples.length * 0.6)) {
      return extractContactsFromVerticalEmailColumn(header, rows);
    }
  }

  return rows;
}

export function combineSheetsToContacts(
  sheets: ParsedSheetData[],
  selectedSheetNames: string[],
): { headers: string[]; rows: Record<string, string>[] } {
  const selected = sheets.filter((s) => selectedSheetNames.includes(s.sheetName));
  const merged: Record<string, string>[] = [];
  const seenEmails = new Set<string>();

  for (const sheet of selected) {
    const contacts = normalizeSheetToContacts(sheet);
    for (const row of contacts) {
      const email = row.Email
        ? normalizeEmail(extractEmailFromCell(row.Email) ?? row.Email)
        : "";
      if (email && isValidEmail(email)) {
        if (seenEmails.has(email)) continue;
        seenEmails.add(email);
      }
      merged.push(row);
    }
  }

  const headerSet = new Set<string>();
  for (const row of merged) {
    for (const key of Object.keys(row)) {
      if (!key.startsWith("__")) headerSet.add(key);
    }
  }

  const preferred = ["Name", "Email", "Company", "Role", "Department", "LinkedIn", "Website"];
  const headers = [
    ...preferred.filter((h) => headerSet.has(h)),
    ...Array.from(headerSet).filter((h) => !preferred.includes(h)),
  ];

  return { headers, rows: merged };
}
