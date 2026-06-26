"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { X, Trash2, Mail, Tag, Archive } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

type PendingAction = "delete" | "archive" | null;

export function BulkActionBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingAction>(null);

  const bulkMutation = useMutation({
    mutationFn: (action: string) =>
      fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action }),
      }).then((r) => r.json()),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`${selectedIds.length} contact${selectedIds.length === 1 ? "" : "s"} updated`);
      onClear();
      setPending(null);
    },
  });

  const count = selectedIds.length;

  return (
    <>
      <div
        className="sticky-action-bar flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-4 py-3"
        role="toolbar"
        aria-label={`${count} contacts selected`}
      >
        {/* Serial Position: count first, destructive last */}
        <span className="mr-1 text-sm font-medium text-foreground">
          {count} selected
        </span>

        <Button
          variant="outline"
          size="sm"
          className="touch-target"
          onClick={() => bulkMutation.mutate("mark_emailed")}
        >
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Emailed
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="touch-target"
          onClick={() => bulkMutation.mutate("mark_contacted")}
        >
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Contacted
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="touch-target"
          onClick={() => setPending("archive")}
        >
          <Archive className="mr-1.5 h-3.5 w-3.5" />
          Archive
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="touch-target"
          onClick={() => bulkMutation.mutate("tag")}
        >
          <Tag className="mr-1.5 h-3.5 w-3.5" />
          Tag
        </Button>

        <Button
          variant="destructive"
          size="sm"
          className="touch-target"
          onClick={() => setPending("delete")}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          className="ml-auto touch-target"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ConfirmDialog
        open={pending === "delete"}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Delete ${count} contact${count === 1 ? "" : "s"}?`}
        description="Contacts will be archived. You can restore them from the activity log."
        confirmLabel="Delete"
        variant="destructive"
        loading={bulkMutation.isPending}
        onConfirm={() => bulkMutation.mutate("delete")}
      />

      <ConfirmDialog
        open={pending === "archive"}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Archive ${count} contact${count === 1 ? "" : "s"}?`}
        description="Archived contacts are hidden from default views but kept in your database."
        confirmLabel="Archive"
        variant="default"
        loading={bulkMutation.isPending}
        onConfirm={() => bulkMutation.mutate("archive")}
      />
    </>
  );
}
