"use client";

import { useEffect, useState } from "react";
import { DEBOUNCE_SEARCH_MS } from "@/lib/ux-principles";

export function useDebouncedValue<T>(value: T, delay = DEBOUNCE_SEARCH_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
