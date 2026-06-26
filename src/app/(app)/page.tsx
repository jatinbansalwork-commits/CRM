"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Building2,
  Copy,
  Mail,
  MailX,
  Clock,
  MessageSquare,
  Calendar,
  Trophy,
  XCircle,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { FollowUpBanner } from "@/components/shared/follow-up-banner";
import { SectionPanel } from "@/components/shared/section-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { STATUS_LABELS } from "@/lib/constants";
import type { ContactStatus } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => fetch("/api/analytics").then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Your outreach pipeline at a glance — key metrics and recent activity."
      />

      <FollowUpBanner count={kpis?.followUpDue ?? 0} />

      {/* Pareto Principle: vital few metrics first */}
      <SectionPanel
        title="Priority metrics"
        description="The numbers that matter most for your job search right now."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Follow Up Due" value={kpis?.followUpDue ?? 0} icon={Clock} variant="warning" />
          <KpiCard title="Not Contacted" value={kpis?.notContacted ?? 0} icon={MailX} />
          <KpiCard title="Responses" value={kpis?.responses ?? 0} icon={MessageSquare} variant="success" />
          <KpiCard title="Interviews" value={kpis?.interviews ?? 0} icon={Calendar} variant="brand" />
        </div>
      </SectionPanel>

      <SectionPanel title="Pipeline overview" description="Full counts across your contact database.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <KpiCard title="Total Contacts" value={kpis?.totalContacts ?? 0} icon={Users} />
          <KpiCard title="Companies" value={kpis?.totalCompanies ?? 0} icon={Building2} />
          <KpiCard title="Duplicate Emails" value={kpis?.duplicateEmails ?? 0} icon={Copy} />
          <KpiCard title="Duplicate Companies" value={kpis?.duplicateCompanies ?? 0} icon={Copy} />
          <KpiCard title="Contacted" value={kpis?.contacted ?? 0} icon={Mail} />
          <KpiCard title="Offers" value={kpis?.offers ?? 0} icon={Trophy} variant="success" />
          <KpiCard title="Rejections" value={kpis?.rejections ?? 0} icon={XCircle} />
        </div>
      </SectionPanel>

      <SectionPanel title="Charts & trends">
        <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-ads-raised border-border/80 bg-surface">
          <CardHeader>
            <CardTitle className="text-base">Contacts by Company</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.contactsByCompany ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-ads-raised border-border/80 bg-surface">
          <CardHeader>
            <CardTitle className="text-base">Top Email Domains</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topDomains ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="domain" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-ads-raised border-border/80 bg-surface">
          <CardHeader>
            <CardTitle className="text-base">Contact Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(data?.statusBreakdown ?? []).map((s: { status: ContactStatus; count: number }) => ({
                    name: STATUS_LABELS[s.status],
                    value: s.count,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label
                >
                  {(data?.statusBreakdown ?? []).map((_: unknown, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-ads-raised border-border/80 bg-surface">
          <CardHeader>
            <CardTitle className="text-base">Import History</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={(data?.importHistory ?? []).map((imp: { timestamp: string; imported: number }) => ({
                  date: new Date(imp.timestamp).toLocaleDateString(),
                  imported: imp.imported,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="imported" stroke="hsl(var(--chart-3))" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        </div>
      </SectionPanel>

      <SectionPanel title="Recent activity">
        <div className="grid gap-6 lg:grid-cols-3">
        <RecentList
          title="Recently Imported"
          items={(data?.importHistory ?? []).slice(0, 5).map((imp: { filename: string | null; imported: number; timestamp: string }) => ({
            label: imp.filename ?? "Import",
            sub: `${imp.imported} contacts`,
            time: imp.timestamp,
          }))}
        />
        <RecentList
          title="Outreach Progress"
          items={[
            { label: "Emailed", sub: `${data?.outreachProgress?.emailed ?? 0} contacts` },
            { label: "Follow-up Sent", sub: `${data?.outreachProgress?.followupSent ?? 0} contacts` },
            { label: "LinkedIn Sent", sub: `${data?.outreachProgress?.linkedinSent ?? 0} contacts` },
          ]}
        />
        <RecentList
          title="Missing Data"
          items={[
            { label: "Missing Company", sub: `${data?.missingData?.missingCompany ?? 0} contacts` },
            { label: "Missing Role", sub: `${data?.missingData?.missingRole ?? 0} contacts` },
            { label: "Missing Name", sub: `${data?.missingData?.missingName ?? 0} contacts` },
          ]}
        />
        </div>
      </SectionPanel>
    </div>
  );
}

function RecentList({
  title,
  items,
}: {
  title: string;
  items: { label: string; sub: string; time?: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-muted-foreground">{item.sub}</p>
              </div>
              {item.time && (
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                </span>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
