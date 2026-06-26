"use client";

import { useCallback, useEffect, useState, type DependencyList } from "react";

/** Cursor stack for next/prev navigation over paginated API results. */
export function useCursorPagination(resetDeps: DependencyList) {
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);

  useEffect(() => {
    setPage(0);
    setCursors([undefined]);
  }, resetDeps);

  const cursor = cursors[page];

  const goNext = useCallback((nextCursor: string | null | undefined) => {
    if (!nextCursor) return;
    setCursors((prev) => {
      const copy = [...prev];
      copy[page + 1] = nextCursor;
      return copy;
    });
    setPage((p) => p + 1);
  }, [page]);

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(0, p - 1));
  }, []);

  return {
    page,
    cursor,
    hasPrev: page > 0,
    goNext,
    goPrev,
  };
}
