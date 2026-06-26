import { NextResponse } from "next/server";
import { contactRepository } from "@/lib/repositories";
import { bulkActionSchema } from "@/lib/validators/contact";
import { activityService } from "@/lib/services/activity/activity-service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = bulkActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ids, action, tag } = parsed.data;
  let count = 0;

  switch (action) {
    case "delete":
      for (const id of ids) {
        await contactRepository.softDelete(id);
      }
      count = ids.length;
      await activityService.logBulk("DELETED", ids);
      break;
    case "archive":
      count = await contactRepository.bulkUpdate(ids, { status: "ARCHIVED" });
      await activityService.logBulk("BULK_UPDATED", ids, { status: "ARCHIVED" });
      break;
    case "mark_contacted":
      count = await contactRepository.bulkUpdate(ids, {
        status: "CONTACTED",
        lastContacted: new Date(),
      });
      await activityService.logBulk("EMAILED", ids);
      break;
    case "mark_emailed":
      count = await contactRepository.bulkUpdate(ids, { emailed: true });
      await activityService.logBulk("EMAILED", ids);
      break;
    case "tag":
      if (!tag) return NextResponse.json({ error: "Tag required" }, { status: 400 });
      for (const id of ids) {
        const contact = await contactRepository.findById(id);
        if (!contact) continue;
        const tags = JSON.parse(contact.tags || "[]") as string[];
        if (!tags.includes(tag)) tags.push(tag);
        await contactRepository.update(id, { tags });
      }
      count = ids.length;
      await activityService.logBulk("BULK_UPDATED", ids, { tag });
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ success: true, count });
}
