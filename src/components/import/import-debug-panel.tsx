"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChunkedImportProgress } from "@/lib/import-client";
import type { ImportApiResponse } from "@/lib/import-client";

type Props = {
  open: boolean;
  progress: ChunkedImportProgress | null;
  debugLog: string[];
  lastResponse?: ImportApiResponse;
  payloadBytes?: number;
};

export function ImportDebugPanel({
  open,
  progress,
  debugLog,
  lastResponse,
  payloadBytes,
}: Props) {
  if (!open || !progress) return null;

  const elapsed = Date.now() - progress.startedAt;
  const pct =
    progress.totalBatches > 0
      ? Math.round((progress.batchIndex / progress.totalBatches) * 100)
      : 0;

  return (
    <Card className="border-dashed border-brand/40 bg-brand-subtle/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Import debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs font-mono">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Progress" value={`${pct}% (batch ${progress.batchIndex}/${progress.totalBatches})`} />
          <Stat label="Rows" value={`${progress.importedSoFar} imported / ${progress.totalRows} total`} />
          <Stat label="Payload" value={payloadBytes ? `${(payloadBytes / 1024).toFixed(1)} KB` : "—"} />
          <Stat label="Elapsed" value={`${(elapsed / 1000).toFixed(1)}s`} />
        </div>

        {progress.errors.length > 0 && (
          <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-destructive">
            {progress.errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {lastResponse && (
          <details open>
            <summary className="cursor-pointer text-muted-foreground">Last API response</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-[10px]">
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          </details>
        )}

        <details>
          <summary className="cursor-pointer text-muted-foreground">Debug log ({debugLog.length})</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-background p-2 text-[10px]">
            {debugLog.join("\n")}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
