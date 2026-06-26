"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Info, Sparkles } from "lucide-react";
import type { ImportAnalysis } from "@/lib/universal-import";
import { FIELD_LABELS } from "@/lib/universal-import/field-labels";

type Props = {
  analysis: Pick<
    ImportAnalysis,
    | "parserName"
    | "sheetType"
    | "orientation"
    | "confidence"
    | "columnDetections"
    | "quality"
    | "issues"
    | "suggestedFixes"
  >;
};

export function ImportPreviewPanel({ analysis }: Props) {
  const { quality, columnDetections, confidence, issues, suggestedFixes } = analysis;
  const confidencePct = Math.round(confidence * 100);
  const highConfidence = confidencePct >= 80;

  return (
    <div className="space-y-4">
      <Card className="border-border/80 bg-surface shadow-ads-raised">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-brand" />
              Smart detection
            </CardTitle>
            <Badge
              variant={highConfidence ? "default" : "secondary"}
              className={highConfidence ? "bg-success text-white" : ""}
            >
              {confidencePct}% confidence
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {analysis.parserName} · {analysis.sheetType.replace(/-/g, " ")} ·{" "}
            {analysis.orientation.replace(/-/g, " ")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Detected columns
            </p>
            <div className="flex flex-wrap gap-2">
              {columnDetections.map((col) => (
                <div
                  key={col.header}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="font-medium">{FIELD_LABELS[col.field] ?? col.field}</span>
                  <span className="text-muted-foreground">← {col.header}</span>
                </div>
              ))}
              {columnDetections.length === 0 && (
                <p className="text-sm text-muted-foreground">No columns mapped yet</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QualityStat label="Total rows" value={quality.totalRows} />
            <QualityStat label="Valid contacts" value={quality.validContacts} good />
            <QualityStat label="Duplicate emails" value={quality.duplicateEmails} warn={quality.duplicateEmails > 0} />
            <QualityStat label="Missing company" value={quality.missingCompany} />
            <QualityStat
              label="Companies inferred"
              value={quality.companiesEnriched}
              info={quality.companiesEnriched > 0}
            />
            <QualityStat label="Missing name" value={quality.missingName} />
            <QualityStat label="Invalid emails" value={quality.invalidEmails} warn={quality.invalidEmails > 0} />
            <QualityStat label="Rows ignored" value={quality.rowsIgnored + quality.emptyRows} />
            {quality.multiEmailRows > 0 && (
              <QualityStat label="Multi-email rows" value={quality.multiEmailRows} info />
            )}
          </div>

          {issues.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Problems found
              </p>
              {issues.map((issue, i) => (
                <div
                  key={i}
                  className={`flex gap-2 rounded-md border px-3 py-2 text-sm ${
                    issue.severity === "error"
                      ? "border-destructive/30 bg-destructive/5"
                      : issue.severity === "warning"
                        ? "border-warning/30 bg-warning/10"
                        : "border-border bg-muted/20"
                  }`}
                >
                  {issue.severity === "error" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : issue.severity === "warning" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  ) : (
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p>{issue.message}</p>
                    {issue.suggestion && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{issue.suggestion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {suggestedFixes.length > 0 && !highConfidence && (
            <div className="rounded-md border border-brand/20 bg-brand-subtle/50 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">Suggested fixes</p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {suggestedFixes.map((fix, i) => (
                  <li key={i}>{fix}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QualityStat({
  label,
  value,
  good,
  warn,
  info,
}: {
  label: string;
  value: number;
  good?: boolean;
  warn?: boolean;
  info?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-semibold tabular-nums ${
          good ? "text-success" : warn ? "text-warning" : info ? "text-brand" : ""
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
