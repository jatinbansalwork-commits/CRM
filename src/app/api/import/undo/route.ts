import { NextResponse } from "next/server";
import { importEngine } from "@/lib/services/import/import-engine";
import { withDb } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    let body: { importId?: string };
    try {
      const raw = await request.text();
      if (!raw.trim()) {
        return NextResponse.json(
          { success: false, error: "Request body is empty" },
          { status: 400 },
        );
      }
      body = JSON.parse(raw);
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid JSON: ${err instanceof Error ? err.message : "parse failed"}`,
        },
        { status: 400 },
      );
    }

    if (!body.importId) {
      return NextResponse.json(
        { success: false, error: "importId required" },
        { status: 400 },
      );
    }

    const reverted = await withDb(() => importEngine.undo(body.importId!));

    return NextResponse.json({
      success: true,
      reverted,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Undo failed";
    console.error("[import/undo]", message, err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
