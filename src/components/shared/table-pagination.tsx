"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  itemCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  loading?: boolean;
  label?: string;
};

export function TablePagination({
  page,
  pageSize,
  total,
  itemCount,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  loading = false,
  label = "rows",
}: TablePaginationProps) {
  if (total === 0) return null;

  const start = page * pageSize + 1;
  const end = page * pageSize + itemCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3">
      <p className="text-sm text-text-subtle" role="status">
        Showing {start.toLocaleString()}–{end.toLocaleString()} of{" "}
        {total.toLocaleString()} {label}
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-subtle">Per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => v && onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-[72px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!hasPrev || loading}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="min-w-[4rem] text-center text-sm text-text-subtle">
          Page {page + 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext || loading}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
