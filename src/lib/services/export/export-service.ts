import * as XLSX from "xlsx";
import type { ContactWithCompany } from "@/types";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { parseTags } from "@/lib/utils/contact";

function contactToRow(contact: ContactWithCompany): Record<string, string> {
  return {
    Name: contact.name ?? "",
    Email: contact.email,
    Company: contact.company?.name ?? "",
    Role: contact.role ?? "",
    Department: contact.department ?? "",
    Domain: contact.domain ?? "",
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
    if (contacts.length === 0) return "";
    const rows = contacts.map(contactToRow);
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
    const rows = contacts.map(contactToRow);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
    return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  }
}

export const exportService = new ExportService();
