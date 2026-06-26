"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants";
import type { ContactStatus } from "@/lib/constants";
import type { ContactWithCompany } from "@/types";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function DuplicatesPage() {
  const [tab, setTab] = useState("emails");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["duplicates", tab],
    queryFn: () => fetch(`/api/duplicates?type=${tab}`).then((r) => r.json()),
  });

  const mergeMutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      fetch("/api/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["duplicates"] });
      toast.success("Merged successfully");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duplicates"
        description="Review and merge duplicate emails, companies, domains, and names."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="names">Names</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6 space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !data?.length ? (
            <EmptyState
              icon={Copy}
              title="No duplicates found"
              description="Your data looks clean. Duplicates appear here when the same email, company, or name exists more than once."
              action={{ label: "Import more data", href: "/import" }}
            />
          ) : tab === "emails" || tab === "names" ? (
            data.map((group: { key: string; items: ContactWithCompany[] }) => (
              <DuplicateContactGroup
                key={group.key}
                group={group}
                onMerge={(keepId, mergeId) =>
                  mergeMutation.mutate({ type: "contacts", keepId, mergeId })
                }
              />
            ))
          ) : (
            data.map((group: { name?: string; domain?: string; ids: string[]; count: number }) => (
              <Card key={group.name ?? group.domain}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {group.name ?? group.domain}
                    <Badge variant="secondary" className="ml-2">{group.count}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    size="sm"
                    onClick={() =>
                      mergeMutation.mutate({
                        type: "companies",
                        targetId: group.ids[0],
                        sourceId: group.ids[1],
                      })
                    }
                  >
                    Merge into first
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DuplicateContactGroup({
  group,
  onMerge,
}: {
  group: { key: string; items: ContactWithCompany[] };
  onMerge: (keepId: string, mergeId: string) => void;
}) {
  const [keepId, setKeepId] = useState(group.items[0]?.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{group.key}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {group.items.map((contact) => (
            <div
              key={contact.id}
              className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                keepId === contact.id ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => setKeepId(contact.id)}
            >
              <p className="font-medium">{contact.name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{contact.email}</p>
              <p className="text-sm">{contact.company?.name}</p>
              <Badge variant="secondary" className="mt-2">
                {STATUS_LABELS[contact.status as ContactStatus]}
              </Badge>
              {keepId === contact.id && (
                <Badge className="ml-2 mt-2">Keep</Badge>
              )}
            </div>
          ))}
        </div>
        {group.items.length > 1 && (
          <Button
            className="mt-4"
            size="sm"
            onClick={() => {
              const mergeId = group.items.find((c) => c.id !== keepId)?.id;
              if (keepId && mergeId) onMerge(keepId, mergeId);
            }}
          >
            Merge Duplicates
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
