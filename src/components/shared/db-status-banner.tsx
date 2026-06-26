"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";

export function DbStatusBanner() {
  const { data, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: () => fetchJson<{ ok: boolean; error?: string }>("/api/health"),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading || data?.ok) return null;

  return (
    <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
      <strong>Database not connected.</strong>{" "}
      {data?.error ??
        "On Vercel, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN, then run npm run db:turso:migrate."}
    </div>
  );
}
