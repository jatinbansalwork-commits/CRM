"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_STALE_MS,
  shouldSearchQuery,
} from "@/lib/search/fts-query";

export type SearchContactHit = {
  id: string;
  name: string | null;
  email: string;
  company?: { id: string; name: string; domain: string | null } | null;
};

async function fetchSearchContacts(
  q: string,
  signal?: AbortSignal,
): Promise<SearchContactHit[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=20`, {
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Search failed (${res.status})`);
  }
  const data = await res.json();
  return data.contacts ?? [];
}

/** Debounced contact search with caching and request cancellation. */
export function useContactSearch(query: string, debounceMs = SEARCH_DEBOUNCE_MS) {
  const debounced = useDebouncedValue(query, debounceMs);
  const active = shouldSearchQuery(debounced);

  return useQuery({
    queryKey: ["search", "contacts", debounced],
    queryFn: ({ signal }) => fetchSearchContacts(debounced, signal),
    enabled: active,
    staleTime: SEARCH_STALE_MS,
    placeholderData: (prev) => prev,
  });
}

async function fetchContactsList(params: URLSearchParams, signal?: AbortSignal) {
  const res = await fetch(`/api/contacts?${params}`, { signal });
  if (!res.ok) throw new Error("Failed to load contacts");
  return res.json();
}

/** Debounced contacts table search — keeps prior rows visible while fetching. */
export function useContactsListSearch(
  search: string,
  statusFilter: string,
  take = 100,
) {
  const debouncedSearch = useDebouncedValue(search);
  const isSearching = search !== debouncedSearch;

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (statusFilter !== "all") params.set("status", statusFilter);
  params.set("take", String(take));

  const query = useQuery({
    queryKey: ["contacts", debouncedSearch, statusFilter, take],
    queryFn: ({ signal }) => fetchContactsList(params, signal),
    staleTime: SEARCH_STALE_MS,
    placeholderData: (prev) => prev,
  });

  return { ...query, isSearching, debouncedSearch };
}
