"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_LABELS } from "@/lib/constants";
import type { ContactStatus } from "@/lib/constants";

export default function CompanyDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: () => fetch(`/api/companies/${id}`).then((r) => r.json()),
  });

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!company || company.error) {
    return <p>Company not found</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.name}
        description={company.domain ?? undefined}
        breadcrumbs={[
          { label: "Companies", href: "/companies" },
          { label: company.name },
        ]}
      />

      <section aria-label="Company stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Contacts" value={company._count.contacts} />
        <StatCard title="Contacted" value={company.stats.contacted} />
        <StatCard title="Remaining" value={company.stats.remaining} />
        <StatCard title="Responses" value={company.stats.responses} />
        <StatCard title="Interviews" value={company.stats.interviews} />
        <StatCard title="Offers" value={company.stats.offers} />
      </section>

      {Object.entries(company.roleGroups ?? {}).map(([role, contacts]) => (
        <Card key={role} className="shadow-ads-raised border-border/80 bg-surface">
          <CardHeader>
            <CardTitle className="text-base">{role} ({(contacts as unknown[]).length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(contacts as { id: string; name: string | null; email: string; role: string | null; status: ContactStatus }[]).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Link href={`/contacts?selected=${c.id}`} className="font-medium hover:underline">
                      {c.name ?? c.email}
                    </Link>
                    <p className="text-sm text-muted-foreground">{c.role}</p>
                  </div>
                  <Badge variant="secondary">{STATUS_LABELS[c.status]}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="shadow-ads-raised border-border/80 bg-surface">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
