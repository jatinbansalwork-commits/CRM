import type { ImportRow } from "@/types";

export const FIELD_LABELS: Record<keyof ImportRow, string> = {
  name: "Name",
  email: "Email",
  company: "Company",
  role: "Role",
  department: "Department",
  linkedin: "LinkedIn",
  website: "Website",
  sourceFile: "Source file",
  sourceSheet: "Source sheet",
  sourceRow: "Source row",
  tags: "Tags",
  priority: "Priority",
  status: "Status",
  notes: "Notes",
};
