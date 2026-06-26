"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Download, Upload, Sparkles } from "lucide-react";
import { useRef } from "react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
  });

  const handleBackup = async () => {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "backup" }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach-crm-backup-${Date.now()}.db`;
    a.click();
    toast.success("Database backed up");
  };

  const handleRestore = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", data: base64 }),
    });
    toast.success("Database restored. Refresh the page.");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        description="Theme, import rules, and database backup."
      />

      <Card className="shadow-ads-raised border-border/80 bg-surface">
        <CardHeader>
          <CardTitle className="text-base">Theme</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          {(["dark", "light", "system"] as const).map((t) => (
            <Button
              key={t}
              variant={theme === t ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-ads-raised border-border/80 bg-surface">
        <CardHeader>
          <CardTitle className="text-base">Import Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingToggle
            label="Skip invalid emails"
            checked={settings?.importRules?.skipInvalidEmails ?? true}
            onChange={(v) =>
              updateMutation.mutate({ importRules: { ...settings?.importRules, skipInvalidEmails: v } })
            }
          />
          <SettingToggle
            label="Merge duplicates on import"
            checked={settings?.importRules?.mergeDuplicates ?? true}
            onChange={(v) =>
              updateMutation.mutate({ importRules: { ...settings?.importRules, mergeDuplicates: v } })
            }
          />
          <SettingToggle
            label="Auto-create companies"
            checked={settings?.importRules?.autoCreateCompanies ?? true}
            onChange={(v) =>
              updateMutation.mutate({ importRules: { ...settings?.importRules, autoCreateCompanies: v } })
            }
          />
        </CardContent>
      </Card>

      <Card className="shadow-ads-raised border-border/80 bg-surface">
        <CardHeader>
          <CardTitle className="text-base">Backup & Restore</CardTitle>
          <CardDescription>Download or restore your SQLite database</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" onClick={handleBackup}>
            <Download className="mr-2 h-4 w-4" />
            Backup Database
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Restore Database
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".db"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleRestore(file);
            }}
          />
        </CardContent>
      </Card>

      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Features
          </CardTitle>
          <CardDescription>Coming soon — company normalization, email generation, contact suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            AI service stubs are in place. Connect an API provider to enable smart features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
