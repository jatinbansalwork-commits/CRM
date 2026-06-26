"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Upload, FileSpreadsheet, Clipboard, Mail, Sheet, CheckCircle2, PartyPopper } from "lucide-react";
import { combineSheetsToContacts } from "@/lib/parsers/file-provider";
import {
  mergeColumnMapping,
  hasEmailColumnMapped,
  unmappedLikelyEmailColumns,
} from "@/lib/services/import/column-mapping";
import {
  runUniversalImport,
  reanalyzeWithMapping,
  saveMappingPattern,
  type ImportAnalysis,
} from "@/lib/universal-import";
import {
  runChunkedImport,
  type ChunkedImportProgress,
} from "@/lib/import-client";
import { ImportPreviewPanel } from "@/components/import/import-preview-panel";
import { ImportDebugPanel } from "@/components/import/import-debug-panel";
import type { ColumnMapping, ImportSummary, ImportRow, ParsedSheetData } from "@/types";
import { CONTACT_FIELDS } from "@/lib/constants";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { StepProgress } from "@/components/shared/step-progress";
import { IMPORT_STEPS } from "@/lib/ux-principles";
import { fetchJson } from "@/lib/fetch-json";

type Step = "input" | "preview" | "mapping" | "summary";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("input");
  const [source, setSource] = useState<"file" | "paste-table" | "email-list">("file");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [filename, setFilename] = useState<string>();
  const [sheetName, setSheetName] = useState<string>();
  const [workbookSheets, setWorkbookSheets] = useState<ParsedSheetData[]>([]);
  const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [importProgress, setImportProgress] = useState<ChunkedImportProgress | null>(null);
  const [importDebugLog, setImportDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("import-debug") === "1",
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const applyAnalysis = (result: ImportAnalysis, importSource: typeof source) => {
    setAnalysis(result);
    setHeaders(result.headers);
    setRows(result.rows);
    setMapping(result.mapping);
    setSource(importSource);
    setStep("preview");
  };

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await runUniversalImport({
        kind: "file",
        buffer,
        filename: file.name,
      });

      if (!result || result.rows.length === 0) {
        throw new Error("No data found in file");
      }

      setWorkbookSheets(result.sheets ?? []);
      setSelectedSheetNames(result.selectedSheetNames ?? []);
      setFilename(result.filename ?? file.name);
      setSheetName(result.sheetName);
      applyAnalysis(result, "file");

      toast.success(
        `Detected ${result.parserName} — ${result.rows.length.toLocaleString()} contacts (${Math.round(result.confidence * 100)}% confidence)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    multiple: false,
  });

  const handleUniversalPaste = async (text?: string) => {
    const input = (text ?? pasteText).trim();
    if (!input) return;
    setLoading(true);
    try {
      const result = await runUniversalImport({ kind: "text", text: input });
      const resolved = result;

      if (!resolved || resolved.rows.length === 0) {
        throw new Error("Could not detect table structure. Try adjusting your selection.");
      }

      setWorkbookSheets([]);
      setSelectedSheetNames([]);
      setFilename(undefined);
      setSheetName(undefined);
      applyAnalysis(resolved, resolved.sheetType === "email-list" ? "email-list" : "paste-table");

      toast.success(
        `${resolved.parserName} — ${resolved.rows.length.toLocaleString()} contacts (${Math.round(resolved.confidence * 100)}% confidence)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse");
    } finally {
      setLoading(false);
    }
  };

  const handlePasteEmails = () => handleUniversalPaste();

  const updateSelectedSheets = (nextSelected: string[]) => {
    if (nextSelected.length === 0) {
      toast.error("Select at least one tab to import");
      return;
    }

    const { headers: nextHeaders, rows: nextRows } = combineSheetsToContacts(
      workbookSheets,
      nextSelected,
    );

    setSelectedSheetNames(nextSelected);
    setHeaders(nextHeaders);
    setRows(nextRows);
    setMapping((prev) => {
      const merged = mergeColumnMapping(prev, nextHeaders, nextRows);
      if (analysis) {
        setAnalysis(reanalyzeWithMapping({ ...analysis, headers: nextHeaders, rows: nextRows }, merged));
      }
      return merged;
    });
    setSheetName(nextSelected.length === 1 ? nextSelected[0] : `${nextSelected.length} sheets`);
  };

  const toggleSheet = (name: string, checked: boolean) => {
    const next = checked
      ? [...selectedSheetNames, name]
      : selectedSheetNames.filter((n) => n !== name);
    updateSelectedSheets(next);
  };

  const handleImport = async () => {
    setLoading(true);
    setImportProgress(null);
    setImportDebugLog([]);

    try {
      const health = await fetch("/api/health").then((r) => r.json()).catch(() => null);
      if (!health?.ok) {
        throw new Error(
          health?.error ??
            "Database not connected. On Vercel, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
        );
      }

      saveMappingPattern(headers, mapping);

      const result = await runChunkedImport({
        rows,
        mapping,
        source,
        filename,
        sheetName,
        sheetNames: selectedSheetNames.length > 0 ? selectedSheetNames : undefined,
        onProgress: (p) => setImportProgress({ ...p }),
      });

      setImportDebugLog(result.debugLog);
      setImportProgress(result.progress);

      if (!result.success || !result.summary) {
        const errMsg =
          result.progress.errors.join("; ") ||
          "Import failed — check debug panel for details";
        throw new Error(errMsg);
      }

      const s = result.summary;
      setSummary({
        importId: s.importId,
        imported: s.imported,
        newContacts: s.newContacts,
        updatedContacts: s.updatedContacts,
        duplicateEmails: s.duplicateEmails,
        duplicateCompanies: 0,
        invalidEmails: s.invalidEmails,
        missingCompany: s.missingCompany,
        missingEmail: s.missingEmail,
        companiesEnriched: s.companiesEnriched ?? 0,
        skippedRows: s.skippedRows,
        errors: s.errors,
      });
      setStep("summary");
      toast.success(
        `Imported ${s.imported.toLocaleString()} contacts in ${result.progress.totalBatches} batch(es)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!summary?.importId) return;
    await fetch("/api/import/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importId: summary.importId }),
    });
    toast.success("Import undone");
    setStep("input");
    setSummary(null);
  };

  if (step === "summary" && summary) {
    return (
      <div className="space-y-6">
        <StepProgress steps={IMPORT_STEPS} currentStepId="summary" />
        <Card className="border-success/30 bg-[#e3fcef]/30 shadow-ads-raised dark:bg-[#1c3329]/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/20">
              <PartyPopper className="h-7 w-7 text-success" aria-hidden />
            </div>
            <CardTitle className="text-xl">Import complete</CardTitle>
            <p className="text-sm text-text-subtle">
              {summary.newContacts} new · {summary.updatedContacts} updated · {summary.skippedRows} skipped
            </p>
          </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Imported" value={summary.imported} />
            <Stat label="New Contacts" value={summary.newContacts} />
            <Stat label="Updated" value={summary.updatedContacts} />
            <Stat label="Skipped" value={summary.skippedRows} />
            <Stat label="Duplicate Emails" value={summary.duplicateEmails} />
            <Stat label="Invalid Emails" value={summary.invalidEmails} />
            <Stat label="Missing Company" value={summary.missingCompany} />
            <Stat label="Companies Inferred" value={summary.companiesEnriched ?? 0} />
            <Stat label="No email found" value={summary.missingEmail} />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => router.push("/contacts")}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              View contacts
            </Button>
            <Button variant="outline" onClick={handleUndo}>Undo import</Button>
            <Button variant="ghost" onClick={() => { setStep("input"); setSummary(null); }}>
              Import more
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    );
  }

  if (step === "mapping" || step === "preview") {
    return (
      <div className="space-y-6">
        <StepProgress steps={IMPORT_STEPS} currentStepId={step} />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">
              {step === "preview" ? "Preview" : "Column Mapping"} — {rows.length} rows
            </h2>
            {filename && (
              <p className="text-sm text-muted-foreground">
                {filename}
                {sheetName && ` · ${sheetName}`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setStep("input");
              setWorkbookSheets([]);
              setSelectedSheetNames([]);
            }}>Back</Button>
            {step === "preview" ? (
              <>
                {hasEmailColumnMapped(mapping) && (analysis?.confidence ?? 0) >= 0.8 ? (
                  <Button onClick={handleImport} disabled={loading}>
                    {loading
                      ? importProgress
                        ? `Importing ${importProgress.batchIndex}/${importProgress.totalBatches}…`
                        : "Importing..."
                      : `Import ${rows.length.toLocaleString()}`}
                  </Button>
                ) : hasEmailColumnMapped(mapping) ? (
                  <Button onClick={() => setStep("mapping")}>
                    Review mapping ({Math.round((analysis?.confidence ?? 0) * 100)}% confidence)
                  </Button>
                ) : null}
                <Button
                  variant={hasEmailColumnMapped(mapping) && (analysis?.confidence ?? 0) >= 0.8 ? "outline" : "default"}
                  onClick={() => setStep("mapping")}
                >
                  {hasEmailColumnMapped(mapping) ? "Adjust mapping" : "Map columns"}
                </Button>
              </>
            ) : (
              <Button onClick={handleImport} disabled={loading}>
                {loading ? "Importing..." : "Import"}
              </Button>
            )}
          </div>
        </div>

        {analysis && step === "preview" && <ImportPreviewPanel analysis={analysis} />}

        {(loading || importProgress) && (
          <ImportDebugPanel
            open={showDebug || loading}
            progress={importProgress}
            debugLog={importDebugLog}
            lastResponse={importProgress?.lastResponse}
            payloadBytes={importProgress?.payloadBytes}
          />
        )}

        {step === "preview" && !loading && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={showDebug}
              onCheckedChange={(c) => {
                const on = c === true;
                setShowDebug(on);
                localStorage.setItem("import-debug", on ? "1" : "0");
              }}
            />
            Show import debug panel
          </label>
        )}

        {workbookSheets.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select tabs to import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateSelectedSheets(
                      workbookSheets.filter((s) => s.rowCount > 0).map((s) => s.sheetName),
                    )
                  }
                >
                  Select all with data
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateSelectedSheets(workbookSheets.map((s) => s.sheetName))
                  }
                >
                  Select all tabs
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {workbookSheets.map((sheet) => (
                  <label
                    key={sheet.sheetName}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selectedSheetNames.includes(sheet.sheetName)}
                      onCheckedChange={(checked) =>
                        toggleSheet(sheet.sheetName, checked === true)
                      }
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{sheet.sheetName}</p>
                      <p className="text-xs text-muted-foreground">
                        {sheet.rowCount} row{sheet.rowCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {step === "mapping" && (
          <>
            {!hasEmailColumnMapped(mapping) && (
              <div
                role="alert"
                className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground"
              >
                No column is mapped to <strong>email</strong>. Map the column that contains
                addresses — multi-tab files often use different names per tab (e.g. &quot;Work
                Email&quot;, &quot;E-mail&quot;).
              </div>
            )}
            {unmappedLikelyEmailColumns(headers, mapping).length > 0 && (
              <div
                role="alert"
                className="rounded-md border border-brand/30 bg-brand-subtle px-4 py-3 text-sm text-foreground"
              >
                These columns look like email but aren&apos;t mapped:{" "}
                <strong>{unmappedLikelyEmailColumns(headers, mapping).join(", ")}</strong>.
                Map each to <strong>email</strong> if your tabs use different header names.
              </div>
            )}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {headers.map((header) => (
                  <div key={header} className="flex items-center gap-3">
                    <span className="w-32 truncate text-sm font-medium">{header}</span>
                    <Select
                      value={mapping[header] ?? "skip"}
                      onValueChange={(v) => {
                        const next = {
                          ...mapping,
                          [header]: v === "skip" ? undefined : (v as keyof ImportRow),
                        };
                        setMapping(next);
                        if (analysis) setAnalysis(reanalyzeWithMapping(analysis, next));
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip</SelectItem>
                        {CONTACT_FIELDS.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          </>
        )}

        <div className="overflow-auto rounded-lg border max-h-96">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 20).map((row, i) => (
                <TableRow key={i}>
                  {headers.map((h) => (
                    <TableCell key={h} className="max-w-[200px] truncate">
                      {row[h]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {rows.length > 20 && (
          <p className="text-sm text-muted-foreground">Showing first 20 of {rows.length} rows</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepProgress steps={IMPORT_STEPS} currentStepId="input" />
      <Tabs defaultValue="paste" className="space-y-6">
      <TabsList>
        <TabsTrigger value="paste"><Clipboard className="mr-2 h-4 w-4" />Paste</TabsTrigger>
        <TabsTrigger value="file"><FileSpreadsheet className="mr-2 h-4 w-4" />Upload File</TabsTrigger>
        <TabsTrigger value="emails"><Mail className="mr-2 h-4 w-4" />Email List</TabsTrigger>
        <TabsTrigger value="google" disabled><Sheet className="mr-2 h-4 w-4" />Google Sheet</TabsTrigger>
      </TabsList>

      <TabsContent value="file">
        <Card>
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-12 transition-colors cursor-pointer touch-target ${
                isDragActive
                  ? "border-brand bg-brand-subtle"
                  : "border-border bg-surface hover:border-brand/50 hover:bg-muted/30"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-lg font-medium">Drop your file here</p>
              <p className="mt-1 text-sm text-muted-foreground">CSV, XLS, or XLSX</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="paste">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Label>Paste anything — tables, email lists, messy sheets</Label>
            <Textarea
              className="min-h-[240px] font-mono text-sm"
              placeholder="Copy rows from Google Sheets, Excel, or Airtable and paste here (tab-separated columns are detected automatically)"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text.trim()) {
                  setPasteText(text);
                  void handleUniversalPaste(text);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Paste from Google Sheets, Excel, or Airtable — the engine auto-detects format,
              columns, and orientation. Supports tables, email lists, and messy spreadsheets.
            </p>
            <Button onClick={() => handleUniversalPaste()} disabled={loading || !pasteText.trim()}>
              Parse & Preview
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="emails">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Label>Email list (one per line or horizontal)</Label>
            <Textarea
              className="min-h-[200px] font-mono text-sm"
              placeholder="john@google.com&#10;jane@microsoft.com&#10;or: john@a.com, jane@b.com, hr@c.com"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text.trim()) {
                  setPasteText(text);
                  void handleUniversalPaste(text);
                }
              }}
            />
            <Button onClick={handlePasteEmails} disabled={loading || !pasteText.trim()}>
              Parse Emails
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="google">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Google Sheets integration coming soon. OAuth connection will be added in a future release.
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
