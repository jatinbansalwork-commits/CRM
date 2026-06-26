"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const isSearching = search !== debouncedSearch;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["companies", debouncedSearch],
    queryFn: ({ signal }) =>
      fetch(
        `/api/companies?search=${encodeURIComponent(debouncedSearch)}&take=100`,
        { signal },
      ).then((r) => r.json()),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

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
      </div>

      {!isLoading && data?.items?.length === 0 ? (
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
                  <TableCell colSpan={5}><Skeleton className="h-8" /></TableCell>
                </TableRow>
              ))
            ) : data?.items?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 h-8 w-8" />
                  No companies yet
                </TableCell>
              </TableRow>
            ) : (
              data?.items?.map((company: {
                id: string;
                name: string;
                domain: string | null;
                _count: { contacts: number };
                contacted: number;
                remaining: number;
              }) => (
                <TableRow key={company.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/companies/${company.id}`} className="font-medium hover:underline">
                      {company.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{company.domain ?? "—"}</TableCell>
                  <TableCell>{company._count.contacts}</TableCell>
                  <TableCell>{company.contacted}</TableCell>
                  <TableCell>{company.remaining}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
}
