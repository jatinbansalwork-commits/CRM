import { NextResponse } from "next/server";
import { deduplicationService } from "@/lib/services/deduplication/deduplication-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "emails";

  switch (type) {
    case "emails":
      return NextResponse.json(await deduplicationService.getDuplicateEmailGroups());
    case "companies":
      return NextResponse.json(await deduplicationService.getDuplicateCompanyGroups());
    case "domains":
      return NextResponse.json(await deduplicationService.getDuplicateDomainGroups());
    case "names":
      return NextResponse.json(await deduplicationService.getDuplicateNameGroups());
    default:
      return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.type === "contacts") {
    await deduplicationService.mergeContacts(body.keepId, body.mergeId);
    return NextResponse.json({ success: true });
  }

  if (body.type === "companies") {
    await deduplicationService.mergeCompanies(body.targetId, body.sourceId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
