import { z } from "zod";
import { CONTACT_STATUSES, PRIORITIES } from "@/lib/constants";
import type { ColumnMapping } from "@/types";

export const contactSchema = z.object({
  name: z.string().optional().nullable(),
  email: z.string().email("Invalid email"),
  role: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  sourceFile: z.string().optional().nullable(),
  sourceSheet: z.string().optional().nullable(),
  sourceRow: z.number().optional().nullable(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(CONTACT_STATUSES).optional(),
  companyId: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  emailed: z.boolean().optional(),
  followupSent: z.boolean().optional(),
  linkedinSent: z.boolean().optional(),
  lastContacted: z.string().optional().nullable(),
  nextFollowup: z.string().optional().nullable(),
  note: z.string().optional(),
});

export const contactUpdateSchema = contactSchema.partial().extend({
  email: z.string().email().optional(),
});

export const noteSchema = z.object({
  body: z.string().min(1, "Note cannot be empty"),
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum([
    "delete",
    "archive",
    "tag",
    "mark_contacted",
    "mark_emailed",
    "export",
  ]),
  tag: z.string().optional(),
});

export const importMappingSchema = z.object({
  mapping: z.record(z.string(), z.string()).transform((m) => m as ColumnMapping),
  source: z.enum(["file", "paste-table", "email-list", "google-sheet"]),
  filename: z.string().optional(),
  sheetName: z.string().optional(),
  sheetNames: z.array(z.string()).optional(),
  rows: z.array(z.record(z.string(), z.string())).max(600),
  importId: z.string().optional(),
  batchIndex: z.number().int().min(0).optional(),
  totalBatches: z.number().int().min(1).optional(),
});

export const settingsSchema = z.object({
  importRules: z
    .object({
      skipInvalidEmails: z.boolean().default(true),
      mergeDuplicates: z.boolean().default(true),
      autoCreateCompanies: z.boolean().default(true),
    })
    .optional(),
  mergeRules: z
    .object({
      stripSuffixes: z.array(z.string()).default(["LLC", "Inc", "Ltd", "Corp"]),
      caseInsensitive: z.boolean().default(true),
    })
    .optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
