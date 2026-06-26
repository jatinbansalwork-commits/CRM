import { NextResponse } from "next/server";
import { contactRepository } from "@/lib/repositories";
import { contactUpdateSchema, noteSchema } from "@/lib/validators/contact";
import { activityService } from "@/lib/services/activity/activity-service";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contact = await contactRepository.findById(id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = contactUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const contact = await contactRepository.update(id, parsed.data);
  await activityService.log("UPDATED", id, { fields: Object.keys(parsed.data) });
  return NextResponse.json(contact);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await contactRepository.softDelete(id);
  await activityService.log("DELETED", id);
  return NextResponse.json({ success: true, id });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  if (body.action === "restore") {
    await contactRepository.restore(id);
    await activityService.log("RESTORED", id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "add_note") {
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const note = await prisma.contactNote.create({
      data: { contactId: id, body: parsed.data.body },
    });
    await activityService.log("NOTE_ADDED", id, { noteId: note.id });
    return NextResponse.json(note);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
