import { NextResponse } from "next/server";
import { contactRepository } from "@/lib/repositories";
import { exportService } from "@/lib/services/export/export-service";
import type { ContactWithCompany } from "@/types";

export async function POST(request: Request) {
  const body = await request.json();
  const format = body.format ?? "csv";
  let contacts: ContactWithCompany[] = [];

  if (body.ids?.length) {
    for (const id of body.ids) {
      const c = await contactRepository.findById(id);
      if (c) contacts.push(c);
    }
  } else {
    const result = await contactRepository.findMany({
      take: 10000,
      filters: body.filters,
    });
    contacts = result.items;
  }

  if (format === "xlsx") {
    const buffer = exportService.toExcelBuffer(contacts);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="contacts-export.xlsx"`,
      },
    });
  }

  const csv = exportService.toCSV(contacts);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="contacts-export.csv"`,
    },
  });
}
