"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchJson } from "@/lib/fetch-json";
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_STALE_MS,
  shouldSearchQuery,
} from "@/lib/search/fts-query";
import type { ContactWithCompany } from "@/types";

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
  const data = await fetchJson<{ contacts?: SearchContactHit[] }>(
    `/api/search?q=${encodeURIComponent(q)}&limit=20`,
    { signal },
  );
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
    retry: false,
    placeholderData: (prev) => prev,
  });
}

type ContactsListResponse = {
  items: ContactWithCompany[];
  total: number;
  nextCursor: string | null;
};

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
    queryFn: ({ signal }) =>
      fetchJson<ContactsListResponse>(`/api/contacts?${params}`, { signal }),
    staleTime: SEARCH_STALE_MS,
    retry: false,
    placeholderData: (prev) => prev,
  });

  return { ...query, isSearching, debouncedSearch };
}
