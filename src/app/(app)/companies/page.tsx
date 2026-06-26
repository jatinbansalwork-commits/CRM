"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { TablePagination } from "@/components/shared/table-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { fetchJson } from "@/lib/fetch-json";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";

type CompanyRow = {
  id: string;
  name: string;
  domain: string | null;
  _count: { contacts: number };
  contacted: number;
  remaining: number;
};

type CompaniesResponse = {
  items: CompanyRow[];
  total: number;
  nextCursor: string | null;
};

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const debouncedSearch = useDebouncedValue(search);
  const isSearching = search !== debouncedSearch;

  const { page, cursor, hasPrev, goNext, goPrev } = useCursorPagination([
    debouncedSearch,
    pageSize,
  ]);

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  params.set("take", String(pageSize));
  if (cursor) params.set("cursor", cursor);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["companies", debouncedSearch, pageSize, cursor ?? ""],
    queryFn: ({ signal }) =>
      fetchJson<CompaniesResponse>(`/api/companies?${params}`, { signal }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description={`${data?.total ?? 0} organizations in your pipeline.`}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isSearching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            Searching…
          </span>
        )}
      </div>

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={search ? "No companies match your search" : "No companies yet"}
          description="Companies are created automatically when you import contacts with company names."
          action={{ label: "Import contacts", href: "/import" }}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface shadow-ads-raised">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Contacted</TableHead>
                <TableHead>Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                items.map((company) => (
                  <TableRow key={company.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Link
                        href={`/companies/${company.id}`}
                        className="font-medium hover:underline"
                      >
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.domain ?? "—"}
                    </TableCell>
                    <TableCell>{company._count.contacts}</TableCell>
                    <TableCell>{company.contacted}</TableCell>
                    <TableCell>{company.remaining}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={data?.total ?? items.length}
            itemCount={items.length}
            hasPrev={hasPrev}
            hasNext={Boolean(data?.nextCursor)}
            onPrev={goPrev}
            onNext={() => goNext(data?.nextCursor)}
            onPageSizeChange={setPageSize}
            loading={isFetching}
            label="companies"
          />
        </div>
      )}
    </div>
  );
}
