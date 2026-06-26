"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

type Step = { id: string; label: string };

/**
 * Goal-Gradient Effect: visible progress through multi-step flows.
 */
export function StepProgress({
  steps,
  currentStepId,
  className,
}: {
  steps: readonly Step[];
  currentStepId: string;
  className?: string;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const progress = currentIndex < 0 ? 0 : ((currentIndex + 1) / steps.length) * 100;

  return (
    <nav aria-label="Progress" className={cn("space-y-3", className)}>
      <Progress value={progress} className="h-1.5" aria-hidden />
      <ol className="flex flex-wrap gap-2 sm:gap-4">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = step.id === currentStepId;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-2 text-xs font-medium sm:text-sm",
                active && "text-brand",
                done && "text-success",
                !active && !done && "text-text-subtlest",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                  active && "border-brand bg-brand-subtle text-brand",
                  done && "border-success bg-[#e3fcef] text-success dark:bg-[#1c3329]",
                  !active && !done && "border-border bg-muted",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
