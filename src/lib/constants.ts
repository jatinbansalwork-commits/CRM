import { NAV_GROUPS } from "@/lib/design-system";

export const CONTACT_STATUSES = [
  "NOT_CONTACTED",
  "CONTACTED",
  "REPLIED",
  "INTERVIEW",
  "REJECTED",
  "OFFER",
  "ARCHIVED",
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABELS: Record<ContactStatus, string> = {
  NOT_CONTACTED: "Not Contacted",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  INTERVIEW: "Interview",
  REJECTED: "Rejected",
  OFFER: "Offer",
  ARCHIVED: "Archived",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => [...g.items]);

export const CONTACT_FIELDS = [
  "name",
  "email",
  "company",
  "role",
  "department",
  "linkedin",
  "website",
  "sourceFile",
  "sourceSheet",
  "tags",
  "priority",
  "status",
  "notes",
] as const;

export const IMPORT_SOURCES = [
  "file",
  "paste-table",
  "email-list",
  "google-sheet",
] as const;

export type ImportSource = (typeof IMPORT_SOURCES)[number];

export const ACTIVITY_ACTIONS = [
  "IMPORTED",
  "MERGED",
  "UPDATED",
  "EMAILED",
  "NOTE_ADDED",
  "DELETED",
  "RESTORED",
  "FOLLOWUP_SCHEDULED",
  "BULK_UPDATED",
  "COMPANY_MERGED",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const DEFAULT_PAGE_SIZE = 50;
