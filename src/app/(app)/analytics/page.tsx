"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
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

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088fe", "#00c49f", "#ffbb28"];

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => fetch("/api/analytics").then((r) => r.json()),
  });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Response rates, import trends, and data quality across your outreach."
      />

      <section aria-label="Conversion rates" className="grid gap-4 sm:grid-cols-3">
        <RateCard title="Response Rate" value={data?.rates?.responseRate ?? 0} />
        <RateCard title="Interview Rate" value={data?.rates?.interviewRate ?? 0} />
        <RateCard title="Offer Rate" value={data?.rates?.offerRate ?? 0} />
      </section>

      <section aria-label="Charts" className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Top Companies">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.contactsByCompany ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--chart-1))" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status Breakdown">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={(data?.statusBreakdown ?? []).map((s: { status: ContactStatus; count: number }) => ({
                  name: STATUS_LABELS[s.status],
                  value: s.count,
                }))}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {(data?.statusBreakdown ?? []).map((_: unknown, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Import Trends">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={(data?.importHistory ?? []).map((imp: { timestamp: string; imported: number }) => ({
                date: new Date(imp.timestamp).toLocaleDateString(),
                count: imp.imported,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-3))" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Missing Data">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={[
                { field: "Company", count: data?.missingData?.missingCompany ?? 0 },
                { field: "Role", count: data?.missingData?.missingRole ?? 0 },
                { field: "Name", count: data?.missingData?.missingName ?? 0 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="field" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--chart-4))" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </div>
  );
}

function RateCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="shadow-ads-raised border-border/80 bg-surface">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold tabular-nums">{value.toFixed(1)}%</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-ads-raised border-border/80 bg-surface">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
