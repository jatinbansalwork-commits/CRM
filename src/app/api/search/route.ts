import { NextResponse } from "next/server";
import { contactRepository } from "@/lib/repositories";
import { ensureDbReady } from "@/lib/init";
import { shouldSearchQuery } from "@/lib/search/fts-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    await ensureDbReady();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

    if (!shouldSearchQuery(q)) {
      return NextResponse.json({
        contacts: [],
        companies: [],
        query: q,
        durationMs: Date.now() - startedAt,
      });
    }

    const contacts = await contactRepository.searchLean(q.trim(), limit);

    return NextResponse.json(
      {
        contacts,
        query: q,
        durationMs: Date.now() - startedAt,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=10",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    console.error("[search]", message);
    return NextResponse.json(
      { success: false, error: message, contacts: [], companies: [] },
      { status: 500 },
    );
  }
}
