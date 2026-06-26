/**
 * Atlassian Design System–inspired tokens + Apple HIG spacing scale.
 * @see https://atlassian.design/foundations
 */

export const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Dashboard", icon: "LayoutDashboard" as const },
      { href: "/contacts", label: "Contacts", icon: "Users" as const },
      { href: "/companies", label: "Companies", icon: "Building2" as const },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/import", label: "Import", icon: "Upload" as const },
      { href: "/duplicates", label: "Duplicates", icon: "Copy" as const },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: "Settings" as const }],
  },
] as const;

/** Apple HIG minimum comfortable tap target */
export const MIN_TOUCH_TARGET_PX = 44;

/** Atlassian 4px spacing grid */
export const SPACE = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;
