import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  title,
  value,
  icon: Icon,
  description,
  className,
  variant = "default",
}: {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  className?: string;
  variant?: "default" | "brand" | "success" | "warning";
}) {
  const accent = {
    default: "text-brand",
    brand: "text-brand",
    success: "text-success",
    warning: "text-warning",
  }[variant];

  return (
    <Card
      className={cn(
        "shadow-ads-raised border-border/80 bg-surface transition-shadow hover:shadow-ads-overlay",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-text-subtlest">
          {title}
        </CardTitle>
        {Icon && <Icon className={cn("h-4 w-4", accent)} aria-hidden />}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {value}
        </div>
        {description && (
          <p className="mt-1 text-xs text-text-subtle">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
