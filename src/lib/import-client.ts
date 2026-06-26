import { IMPORT_BATCH_SIZE } from "@/lib/constants/import";

export type ImportApiSuccess = {
  success: true;
  importId: string;
  imported: number;
  duplicates: number;
  updated: number;
  skipped: number;
  newContacts: number;
  updatedContacts: number;
  duplicateEmails: number;
  invalidEmails: number;
  missingEmail: number;
  missingCompany: number;
  companiesEnriched: number;
  skippedRows: number;
  errors: string[];
  batchIndex?: number;
  totalBatches?: number;
  rowsReceived: number;
  rowsParsed: number;
  durationMs: number;
};

export type ImportApiFailure = {
  success: false;
  error: string;
  details?: unknown;
  durationMs?: number;
};

export type ImportApiResponse = ImportApiSuccess | ImportApiFailure;

export { IMPORT_BATCH_SIZE };

export function slimRowsForPayload(
  rows: Record<string, string>[],
  mapping: Record<string, string | undefined>,
): Record<string, string>[] {
  const keys = new Set<string>(Object.keys(mapping).filter(Boolean));
  keys.add("__sourceSheet");

  return rows.map((row) => {
    const slim: Record<string, string> = {};
    for (const key of keys) {
      const val = row[key];
      if (val !== undefined && val !== "") slim[key] = val;
    }
    return slim;
  });
}

export function estimatePayloadBytes(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return JSON.stringify(data).length;
  }
}

export async function parseJsonResponse<T = ImportApiResponse>(
  res: Response,
): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!text.trim()) {
    throw new Error(
      `Server returned empty response (HTTP ${res.status}). The import may have timed out — try again with batching enabled.`,
    );
  }

  if (!contentType.includes("application/json") && !text.trimStart().startsWith("{")) {
    const isTimeout =
      res.status === 504 ||
      text.includes("FUNCTION_INVOCATION_TIMEOUT") ||
      text.includes("An error occurred with your deployment");
    throw new Error(
      isTimeout
        ? `Import timed out on the server (HTTP ${res.status}). Importing in smaller batches — retry and it should continue.`
        : `Unexpected response type (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Invalid JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }
}

export type ChunkedImportProgress = {
  batchIndex: number;
  totalBatches: number;
  rowsInBatch: number;
  totalRows: number;
  importedSoFar: number;
  payloadBytes: number;
  lastResponse?: ImportApiResponse;
  errors: string[];
  startedAt: number;
};

export type ChunkedImportResult = {
  success: boolean;
  summary: ImportApiSuccess | null;
  progress: ChunkedImportProgress;
  debugLog: string[];
};

function mergeSuccess(
  acc: ImportApiSuccess | null,
  batch: ImportApiSuccess,
): ImportApiSuccess {
  if (!acc) return { ...batch };
  return {
    ...batch,
    imported: acc.imported + batch.imported,
    duplicates: acc.duplicates + batch.duplicates,
    updated: acc.updated + batch.updated,
    skipped: acc.skipped + batch.skipped,
    newContacts: acc.newContacts + batch.newContacts,
    updatedContacts: acc.updatedContacts + batch.updatedContacts,
    duplicateEmails: acc.duplicateEmails + batch.duplicateEmails,
    invalidEmails: acc.invalidEmails + batch.invalidEmails,
    missingEmail: acc.missingEmail + batch.missingEmail,
    missingCompany: acc.missingCompany + batch.missingCompany,
    companiesEnriched: acc.companiesEnriched + batch.companiesEnriched,
    skippedRows: acc.skippedRows + batch.skippedRows,
    errors: [...acc.errors, ...batch.errors].slice(0, 100),
    rowsReceived: acc.rowsReceived + batch.rowsReceived,
    rowsParsed: acc.rowsParsed + batch.rowsParsed,
    durationMs: acc.durationMs + batch.durationMs,
  };
}

export async function runChunkedImport(params: {
  rows: Record<string, string>[];
  mapping: Record<string, string | undefined>;
  source: string;
  filename?: string;
  sheetName?: string;
  sheetNames?: string[];
  onProgress?: (progress: ChunkedImportProgress) => void;
  batchSize?: number;
}): Promise<ChunkedImportResult> {
  const batchSize = params.batchSize ?? IMPORT_BATCH_SIZE;
  const slimmed = slimRowsForPayload(params.rows, params.mapping);
  const totalBatches = Math.max(1, Math.ceil(slimmed.length / batchSize));
  const debugLog: string[] = [];
  const startedAt = Date.now();

  let accumulated: ImportApiSuccess | null = null;
  let importId: string | undefined;
  const progress: ChunkedImportProgress = {
    batchIndex: 0,
    totalBatches,
    rowsInBatch: 0,
    totalRows: slimmed.length,
    importedSoFar: 0,
    payloadBytes: 0,
    errors: [],
    startedAt,
  };

  const log = (msg: string) => {
    debugLog.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
  };

  log(`Starting import: ${slimmed.length} rows, ${totalBatches} batch(es)`);

  for (let i = 0; i < slimmed.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize);
    const batchRows = slimmed.slice(i, i + batchSize);
    const payload = {
      rows: batchRows,
      mapping: params.mapping,
      source: params.source,
      filename: params.filename,
      sheetName: params.sheetName,
      sheetNames: params.sheetNames,
      importId,
      batchIndex,
      totalBatches,
    };

    const payloadBytes = estimatePayloadBytes(payload);
    progress.batchIndex = batchIndex + 1;
    progress.rowsInBatch = batchRows.length;
    progress.payloadBytes = payloadBytes;
    params.onProgress?.({ ...progress });

    log(`Batch ${batchIndex + 1}/${totalBatches}: ${batchRows.length} rows, ${(payloadBytes / 1024).toFixed(1)} KB`);

    let res: Response;
    try {
      res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      const msg = networkErr instanceof Error ? networkErr.message : "Network error";
      log(`Batch ${batchIndex + 1} network error: ${msg}`);
      progress.errors.push(msg);
      return { success: false, summary: accumulated, progress, debugLog };
    }

    let result: ImportApiResponse;
    try {
      result = await parseJsonResponse<ImportApiResponse>(res);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : "Invalid JSON";
      log(`Batch ${batchIndex + 1} parse error: ${msg}`);
      progress.errors.push(msg);
      return { success: false, summary: accumulated, progress, debugLog };
    }

    progress.lastResponse = result;
    params.onProgress?.({ ...progress });

    if (!result.success) {
      log(`Batch ${batchIndex + 1} failed: ${result.error}`);
      progress.errors.push(result.error);
      return { success: false, summary: accumulated, progress, debugLog };
    }

    importId = result.importId;
    accumulated = mergeSuccess(accumulated, result);
    progress.importedSoFar = accumulated.imported;
    log(
      `Batch ${batchIndex + 1} OK: +${result.imported} imported (${result.durationMs}ms)`,
    );
    params.onProgress?.({ ...progress });
  }

  log(`Complete: ${accumulated?.imported ?? 0} imported in ${Date.now() - startedAt}ms`);

  return {
    success: true,
    summary: accumulated,
    progress,
    debugLog,
  };
}
