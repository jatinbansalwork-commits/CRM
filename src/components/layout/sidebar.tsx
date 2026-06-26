"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Upload,
  Copy,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { NAV_GROUPS } from "@/lib/design-system";

const iconMap = {
  LayoutDashboard,
  Users,
  Building2,
  Upload,
  Copy,
  Settings,
};

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const openCommandPalette = () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-[56px]" : "w-[240px]",
      )}
      aria-label="Main navigation"
    >
      {/* Brand — Jakob's Law: familiar app chrome */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-3">
        {!collapsed && (
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 font-semibold text-sidebar-primary transition-opacity hover:opacity-90"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-xs font-bold">
              O
            </span>
            <span className="tracking-tight">Outreach</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="touch-target text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {/* Search — Hick's Law: one obvious entry point */}
      {!collapsed && (
        <div className="border-b border-sidebar-border p-3">
          <button
            type="button"
            onClick={openCommandPalette}
            className="touch-target flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-white/8 px-3 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            <Search className="h-4 w-4 shrink-0 opacity-70" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">
              ⌘K
            </kbd>
          </button>
        </div>
      )}

      {/* Grouped nav — Miller's Law: chunked sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5" role="list">
              {group.items.map((item) => {
                const Icon = iconMap[item.icon];
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "touch-target flex items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                        collapsed ? "justify-center px-0" : "",
                        isActive
                          ? "bg-sidebar-accent text-white shadow-sm"
                          : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-white",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
