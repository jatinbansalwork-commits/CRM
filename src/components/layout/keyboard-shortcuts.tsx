"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: ["⌘", "K"], description: "Open command palette" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["G", "C"], description: "Go to Contacts" },
  { keys: ["G", "I"], description: "Go to Import" },
  { keys: ["G", "D"], description: "Go to Dashboard" },
  { keys: ["?"], description: "Show shortcuts" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "g" && !e.metaKey) {
        const next = (ev: KeyboardEvent) => {
          if (ev.key === "c") window.location.href = "/contacts";
          if (ev.key === "i") window.location.href = "/import";
          if (ev.key === "d") window.location.href = "/";
          document.removeEventListener("keydown", next);
        };
        document.addEventListener("keydown", next);
        setTimeout(() => document.removeEventListener("keydown", next), 1000);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border bg-muted px-2 py-0.5 text-xs font-mono"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
