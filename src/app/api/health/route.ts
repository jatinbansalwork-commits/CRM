import { NextResponse } from "next/server";
import { ensureDbReady } from "@/lib/init";
import { getDbDiagnostics, prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics = getDbDiagnostics();

  try {
    await ensureDbReady();
    await prisma.contact.count();
    return NextResponse.json({ ok: true, ...diagnostics });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database unavailable";
    return NextResponse.json(
      { ok: false, error: message, ...diagnostics },
      { status: 503 },
    );
  }
}
