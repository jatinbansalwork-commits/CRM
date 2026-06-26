import { cn } from "@/lib/utils";

/**
 * Law of Common Region + Proximity: grouped content with clear boundaries.
 */
export function SectionPanel({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)} aria-labelledby={`section-${title.replace(/\s/g, "-")}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id={`section-${title.replace(/\s/g, "-")}`}
            className="text-base font-semibold text-foreground"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-text-subtle">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
