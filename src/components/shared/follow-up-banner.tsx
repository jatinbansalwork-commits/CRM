"use client";

import { Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Zeigarnik Effect: incomplete tasks (follow-ups) stay visible until resolved.
 */
export function FollowUpBanner({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-warning/30 bg-[#fff7e6] px-4 py-3 dark:border-warning/20 dark:bg-[#332b1a] sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="font-medium text-foreground">
            {count} follow-up{count === 1 ? "" : "s"} due
          </p>
          <p className="text-sm text-text-subtle">
            Unfinished outreach stays top of mind — review who needs a nudge today.
          </p>
        </div>
      </div>
      <Link
        href="/contacts"
        className={cn(buttonVariants({ size: "sm" }), "shrink-0 touch-target")}
      >
        Review contacts
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </div>
  );
}
