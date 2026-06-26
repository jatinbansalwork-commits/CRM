import { NextResponse } from "next/server";
import { contactRepository } from "@/lib/repositories";
import { companyRepository } from "@/lib/repositories";
import { contactSchema } from "@/lib/validators/contact";
import { activityService } from "@/lib/services/activity/activity-service";
import { ensureDbReady } from "@/lib/init";
import type { ContactStatus, Priority } from "@/lib/constants";

export async function GET(request: Request) {
  try {
    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const take = parseInt(searchParams.get("take") ?? "50", 10);
    const sortBy = searchParams.get("sortBy") ?? "updatedAt";
    const sortOrder = (searchParams.get("sortOrder") ?? "desc") as "asc" | "desc";
    const search = searchParams.get("search") ?? undefined;

    const status = searchParams.getAll("status") as ContactStatus[];
    const priority = searchParams.getAll("priority") as Priority[];

    const result = await contactRepository.findMany({
      cursor,
      take,
      sortBy,
      sortOrder,
      filters: {
        search,
        status: status.length ? status : undefined,
        priority: priority.length ? priority : undefined,
        companyId: searchParams.get("companyId") ?? undefined,
        hasNotes: searchParams.get("hasNotes") === "true" ? true : undefined,
        missingCompany: searchParams.get("missingCompany") === "true" ? true : undefined,
        missingRole: searchParams.get("missingRole") === "true" ? true : undefined,
        emailed: searchParams.get("emailed") === "true" ? true : searchParams.get("emailed") === "false" ? false : undefined,
        duplicate: searchParams.get("duplicate") === "true" ? true : undefined,
        includeArchived: searchParams.get("includeArchived") === "true",
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database unavailable";
    return NextResponse.json({ error: message, items: [], total: 0, nextCursor: null }, { status: 503 });
  }
}

export async function POST(request: Request) {
  await ensureDbReady();
  const body = await request.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let companyId = parsed.data.companyId;
  if (parsed.data.companyName && !companyId) {
    const company = await companyRepository.findOrCreate(parsed.data.companyName);
    companyId = company.id;
  }

  const contact = await contactRepository.create({ ...parsed.data, companyId });
  await activityService.log("UPDATED", contact.id, { action: "created" });
  return NextResponse.json(contact, { status: 201 });
}
