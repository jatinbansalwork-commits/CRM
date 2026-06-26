import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { SkipLink } from "@/components/layout/skip-link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="page-container animate-content-in">{children}</div>
        </main>
        <CommandPalette />
        <KeyboardShortcuts />
      </div>
    </>
  );
}
