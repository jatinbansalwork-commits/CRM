"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Doherty Threshold: show activity when response exceeds ~100ms */
export function SearchFeedback({
  searching,
  resultCount,
  className,
}: {
  searching: boolean;
  resultCount?: number;
  className?: string;
}) {
  return (
    <p
      className={cn("text-xs text-text-subtlest", className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {searching ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Searching...
        </span>
      ) : resultCount !== undefined ? (
        `${resultCount} result${resultCount === 1 ? "" : "s"}`
      ) : null}
    </p>
  );
}
