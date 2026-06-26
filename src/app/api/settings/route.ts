import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { backupService } from "@/lib/services/backup/backup-service";
import { settingsSchema } from "@/lib/validators/contact";

export async function GET() {
  const setting = await prisma.appSetting.findUnique({ where: { key: "defaults" } });
  const defaults = setting ? JSON.parse(setting.value) : {};
  return NextResponse.json(defaults);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.appSetting.findUnique({ where: { key: "defaults" } });
  const current = existing ? JSON.parse(existing.value) : {};
  const merged = { ...current, ...parsed.data };

  await prisma.appSetting.upsert({
    where: { key: "defaults" },
    update: { value: JSON.stringify(merged) },
    create: { key: "defaults", value: JSON.stringify(merged) },
  });

  return NextResponse.json(merged);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.action === "backup") {
    const buffer = await backupService.getDatabaseBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="outreach-crm-backup-${Date.now()}.db"`,
      },
    });
  }

  if (body.action === "restore" && body.data) {
    const buffer = Buffer.from(body.data, "base64");
    await backupService.restoreDatabase(buffer);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
