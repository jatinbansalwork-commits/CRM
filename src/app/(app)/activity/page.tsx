"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { ACTIVITY_ACTIONS } from "@/lib/constants";
import { EmptyState } from "@/components/shared/empty-state";
import { History } from "lucide-react";

export default function ActivityPage() {
  const [action, setAction] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["activity", action],
    queryFn: () => {
      const params = new URLSearchParams({ take: "100" });
      if (action !== "all") params.set("action", action);
      return fetch(`/api/activity?${params}`).then((r) => r.json());
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Audit log of imports, updates, merges, and outreach actions."
        actions={
          <Select value={action} onValueChange={(v) => v && setAction(v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTIVITY_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="space-y-1">
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : data?.items?.length === 0 ? (
          <EmptyState
            icon={History}
            title={action !== "all" ? "No matching activity" : "No activity yet"}
            description="Imports, edits, merges, and outreach actions will appear here as you use the CRM."
            action={action !== "all" ? undefined : { label: "Import contacts", href: "/import" }}
          />
        ) : (
          data?.items?.map((item: {
            id: string;
            action: string;
            timestamp: string;
            contact?: { name: string | null; email: string; company?: { name: string } };
          }) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-md border border-border bg-surface px-4 py-3 shadow-ads-raised transition-colors hover:bg-muted/40"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {item.action[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.action.replace(/_/g, " ")}</p>
                {item.contact && (
                  <p className="text-sm text-muted-foreground">
                    {item.contact.name ?? item.contact.email}
                    {item.contact.company && ` · ${item.contact.company.name}`}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
