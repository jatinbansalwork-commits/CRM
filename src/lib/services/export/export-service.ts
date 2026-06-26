import * as XLSX from "xlsx";
import type { ContactWithCompany } from "@/types";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { parseTags } from "@/lib/utils/contact";
import { inferCompanyFromEmail } from "@/lib/utils/company-enrichment";

function exportCompanyName(contact: ContactWithCompany): string {
  const linked = contact.company?.name?.trim();
  if (linked) return linked;
  return inferCompanyFromEmail(contact.email).company ?? "";
}

function exportDomain(contact: ContactWithCompany): string {
  if (contact.domain?.trim()) return contact.domain;
  return inferCompanyFromEmail(contact.email).domain ?? "";
}

function sortContactsForExport(
  contacts: ContactWithCompany[],
): ContactWithCompany[] {
  return [...contacts].sort((a, b) => {
    const companyA = exportCompanyName(a) || "\uffff";
    const companyB = exportCompanyName(b) || "\uffff";
    const byCompany = companyA.localeCompare(companyB, undefined, {
      sensitivity: "base",
    });
    if (byCompany !== 0) return byCompany;

    const nameA = (a.name ?? "").toLowerCase();
    const nameB = (b.name ?? "").toLowerCase();
    const byName = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;

    return a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
  });
}

function contactToRow(contact: ContactWithCompany): Record<string, string> {
  return {
    Name: contact.name ?? "",
    Email: contact.email,
    Company: exportCompanyName(contact),
    Role: contact.role ?? "",
    Department: contact.department ?? "",
    Domain: exportDomain(contact),
    LinkedIn: contact.linkedin ?? "",
    Website: contact.website ?? "",
    Status: STATUS_LABELS[contact.status],
    Priority: PRIORITY_LABELS[contact.priority],
    Tags: parseTags(contact.tags).join(", "),
    Emailed: contact.emailed ? "Yes" : "No",
    "Follow-up Sent": contact.followupSent ? "Yes" : "No",
    "LinkedIn Sent": contact.linkedinSent ? "Yes" : "No",
    "Last Contacted": contact.lastContacted?.toISOString() ?? "",
    "Next Follow-up": contact.nextFollowup?.toISOString() ?? "",
    Source: contact.sourceFile ?? "",
    "Date Imported": contact.createdAt.toISOString(),
  };
}

export class ExportService {
  toCSV(contacts: ContactWithCompany[]): string {
    const sorted = sortContactsForExport(contacts);
    if (sorted.length === 0) return "";
    const rows = sorted.map(contactToRow);
    const headers = Object.keys(rows[0] ?? {});
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((h) => `"${(row[h] ?? "").replace(/"/g, '""')}"`).join(","),
      ),
    ];
    return lines.join("\n");
  }

  toExcelBuffer(contacts: ContactWithCompany[]): Buffer {
    const sorted = sortContactsForExport(contacts);
    const rows = sorted.map(contactToRow);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
    return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  }
}

export const exportService = new ExportService();
