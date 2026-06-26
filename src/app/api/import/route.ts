import { NextResponse } from "next/server";
import { importEngine } from "@/lib/services/import/import-engine";
import { importMappingSchema } from "@/lib/validators/contact";
import { withDb } from "@/lib/api";
import type { ImportApiResponse } from "@/lib/import-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorResponse(
  error: string,
  status: number,
  details?: unknown,
  durationMs?: number,
): NextResponse<ImportApiResponse> {
  console.error("[import] error:", error, details ?? "");
  return NextResponse.json(
    {
      success: false,
      error,
      details,
      durationMs,
    },
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function successResponse(
  summary: Awaited<ReturnType<typeof importEngine.process>>,
  meta: {
    rowsReceived: number;
    rowsParsed: number;
    durationMs: number;
    batchIndex?: number;
    totalBatches?: number;
  },
): NextResponse<ImportApiResponse> {
  return NextResponse.json(
    {
      success: true,
      importId: summary.importId,
      imported: summary.imported,
      duplicates: summary.duplicateEmails,
      updated: summary.updatedContacts,
      skipped: summary.skippedRows,
      newContacts: summary.newContacts,
      updatedContacts: summary.updatedContacts,
      duplicateEmails: summary.duplicateEmails,
      invalidEmails: summary.invalidEmails,
      missingEmail: summary.missingEmail,
      missingCompany: summary.missingCompany,
      companiesEnriched: summary.companiesEnriched,
      skippedRows: summary.skippedRows,
      errors: summary.errors,
      batchIndex: meta.batchIndex,
      totalBatches: meta.totalBatches,
      rowsReceived: meta.rowsReceived,
      rowsParsed: meta.rowsParsed,
      durationMs: meta.durationMs,
    },
    { headers: { "Content-Type": "application/json" } },
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  return withDb(async () => {
    let body: unknown;
    try {
      const raw = await request.text();
      if (!raw.trim()) {
        return errorResponse("Request body is empty", 400, undefined, Date.now() - startedAt);
      }
      body = JSON.parse(raw);
    } catch (err) {
      return errorResponse(
        `Invalid JSON body: ${err instanceof Error ? err.message : "parse failed"}`,
        400,
        undefined,
        Date.now() - startedAt,
      );
    }

    const parsed = importMappingSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        400,
        parsed.error.flatten(),
        Date.now() - startedAt,
      );
    }

    const {
      rows,
      mapping,
      source,
      filename,
      sheetName,
      sheetNames,
      importId,
      batchIndex,
      totalBatches,
    } = parsed.data;

    console.log("[import] batch", {
      batchIndex: batchIndex ?? 0,
      totalBatches: totalBatches ?? 1,
      rowsReceived: rows.length,
      importId: importId ?? "new",
      source,
      filename,
    });

    try {
      const summary = await importEngine.process({
        rows,
        mapping,
        source,
        filename,
        sheetName,
        sheetNames,
        importId,
        batchIndex,
        totalBatches,
      });

      const durationMs = Date.now() - startedAt;
      console.log("[import] batch complete", {
        batchIndex: batchIndex ?? 0,
        imported: summary.imported,
        skipped: summary.skippedRows,
        duplicates: summary.duplicateEmails,
        errors: summary.errors.length,
        durationMs,
      });

      return successResponse(summary, {
        rowsReceived: rows.length,
        rowsParsed: summary.imported + summary.skippedRows + summary.missingEmail + summary.invalidEmails + summary.duplicateEmails,
        durationMs,
        batchIndex,
        totalBatches,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      const stack = err instanceof Error ? err.stack : undefined;
      console.error("[import] exception:", message, stack);
      return errorResponse(message, 500, stack, Date.now() - startedAt);
    }
  }).catch((err) => {
    const message = err instanceof Error ? err.message : "Database not ready";
    console.error("[import] withDb failed:", err);
    return errorResponse(message, 503, undefined, Date.now() - startedAt);
  });
}
