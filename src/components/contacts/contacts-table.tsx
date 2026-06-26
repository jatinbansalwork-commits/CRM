"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS_LABELS, CONTACT_STATUSES, PRIORITIES, PRIORITY_LABELS } from "@/lib/constants";
import type { ContactWithCompany } from "@/types";
import type { ContactStatus } from "@/lib/constants";
import { ContactSheet } from "./contact-sheet";
import { BulkActionBar } from "./bulk-action-bar";
import { Search, Download, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { useContactsListSearch } from "@/hooks/use-contact-search";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchFeedback } from "@/components/shared/search-feedback";

const statusColors: Record<ContactStatus, string> = {
  NOT_CONTACTED: "bg-muted text-text-subtle",
  CONTACTED: "bg-brand-subtle text-brand",
  REPLIED: "bg-[#e3fcef] text-[#006644] dark:bg-[#1c3329] dark:text-success",
  INTERVIEW: "bg-[#eae6ff] text-[#403294] dark:bg-[#2b273f] dark:text-[#9f8fef]",
  REJECTED: "bg-[#ffebe6] text-destructive dark:bg-[#42221f]",
  OFFER: "bg-[#e3fcef] text-success",
  ARCHIVED: "bg-muted text-text-subtlest",
};

export function ContactsTable() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const parentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, isSearching, debouncedSearch } =
    useContactsListSearch(search, statusFilter, 100);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact updated");
    },
  });

  const contacts: ContactWithCompany[] = data?.items ?? [];

  const columns = useMemo<ColumnDef<ContactWithCompany>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
          />
        ),
        size: 40,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <button
            className="text-left font-medium hover:underline"
            onClick={() => setSelectedId(row.original.id)}
          >
            {row.original.name ?? "—"}
          </button>
        ),
      },
      { accessorKey: "email", header: "Email" },
      {
        id: "company",
        header: "Company",
        cell: ({ row }) => row.original.company?.name ?? "—",
      },
      { accessorKey: "role", header: "Role", cell: ({ getValue }) => getValue() ?? "—" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Select
            value={row.original.status}
            onValueChange={(v) =>
              updateMutation.mutate({ id: row.original.id, data: { status: v } })
            }
          >
            <SelectTrigger className="h-7 w-32 border-0 bg-transparent">
              <Badge variant="secondary" className={statusColors[row.original.status]}>
                {STATUS_LABELS[row.original.status]}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {CONTACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => PRIORITY_LABELS[row.original.priority],
      },
      {
        id: "emailed",
        header: "✉️",
        cell: ({ row }) => (
          <Checkbox
            checked={row.original.emailed}
            onCheckedChange={(v) =>
              updateMutation.mutate({ id: row.original.id, data: { emailed: !!v } })
            }
          />
        ),
        size: 40,
      },
      {
        id: "followup",
        header: "↩️",
        cell: ({ row }) => (
          <Checkbox
            checked={row.original.followupSent}
            onCheckedChange={(v) =>
              updateMutation.mutate({ id: row.original.id, data: { followupSent: !!v } })
            }
          />
        ),
        size: 40,
      },
      {
        id: "linkedin",
        header: "in",
        cell: ({ row }) => (
          <Checkbox
            checked={row.original.linkedinSent}
            onCheckedChange={(v) =>
              updateMutation.mutate({ id: row.original.id, data: { linkedinSent: !!v } })
            }
          />
        ),
        size: 40,
      },
    ],
    [updateMutation],
  );

  const table = useReactTable({
    data: contacts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    getRowId: (row) => row.id,
  });

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  const handleExport = useCallback(async () => {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds.length ? selectedIds : undefined, format: "csv" }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
  }, [selectedIds]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="touch-target pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search contacts"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-40 touch-target">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CONTACT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="touch-target" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button size="sm" className="touch-target" onClick={() => setSelectedId("new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
      <SearchFeedback
        searching={isSearching || (isFetching && !!debouncedSearch)}
        resultCount={debouncedSearch ? data?.total : undefined}
      />

      {selectedIds.length > 0 && (
        <BulkActionBar
          selectedIds={selectedIds}
          onClear={() => setRowSelection({})}
        />
      )}

      {!isLoading && contacts.length === 0 && !data?.total ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Import your spreadsheet or paste emails to build your outreach list."
          action={{ label: "Import contacts", href: "/import" }}
          secondaryAction={{ label: "Add manually", href: "/contacts" }}
        />
      ) : (
      <div ref={parentRef} className="h-[calc(100vh-280px)] overflow-auto rounded-md border border-border bg-surface shadow-ads-raised">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No contacts found. Import your data to get started.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr style={{ height: virtualizer.getVirtualItems()[0]?.start ?? 0 }} />
                )}
                {virtualizer.getVirtualItems().map((vRow) => {
                  const row = rows[vRow.index];
                  if (!row) return null;
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      className="hover:bg-muted/50"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr
                    style={{
                      height:
                        virtualizer.getTotalSize() -
                        (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                    }}
                  />
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      )}

      <p className="text-sm text-text-subtle" role="status">
        Showing {contacts.length} of {data?.total ?? 0} contacts
      </p>

      <ContactSheet
        contactId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
