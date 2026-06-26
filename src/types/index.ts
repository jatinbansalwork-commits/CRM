import type { ContactStatus, Priority } from "@/lib/constants";

export type ContactWithCompany = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  department: string | null;
  domain: string | null;
  linkedin: string | null;
  website: string | null;
  sourceFile: string | null;
  sourceSheet: string | null;
  sourceRow: number | null;
  tags: string;
  priority: Priority;
  status: ContactStatus;
  emailed: boolean;
  followupSent: boolean;
  linkedinSent: boolean;
  lastContacted: Date | null;
  nextFollowup: Date | null;
  companyId: string | null;
  importId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  company: {
    id: string;
    name: string;
    domain: string | null;
  } | null;
  notes?: { id: string; body: string; createdAt: Date }[];
  _count?: { notes: number };
};

export type ContactFilters = {
  search?: string;
  status?: ContactStatus[];
  priority?: Priority[];
  companyId?: string;
  source?: string;
  hasNotes?: boolean;
  missingCompany?: boolean;
  missingRole?: boolean;
  emailed?: boolean;
  followupSent?: boolean;
  linkedinSent?: boolean;
  duplicate?: boolean;
  includeArchived?: boolean;
};

export type ContactListParams = {
  cursor?: string;
  take?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: ContactFilters;
};

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
  total: number;
};

export type ImportRow = {
  name?: string;
  email?: string;
  company?: string;
  role?: string;
  department?: string;
  linkedin?: string;
  website?: string;
  sourceFile?: string;
  sourceSheet?: string;
  sourceRow?: number;
  tags?: string[];
  priority?: Priority;
  status?: ContactStatus;
  notes?: string;
};

export type ParsedSheetData = {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
};

export type ParsedImportData = {
  headers: string[];
  rows: Record<string, string>[];
  sheetName?: string;
  sheets?: ParsedSheetData[];
  selectedSheetNames?: string[];
  parseMeta?: {
    format?: string;
    columnCount?: number;
    rowCount?: number;
    mapping?: ColumnMapping;
    confidence?: number;
    parserId?: string;
    quality?: {
      totalRows: number;
      validContacts: number;
      duplicateEmails: number;
      missingEmail: number;
      missingCompany: number;
      missingName: number;
      invalidEmails: number;
      emptyRows: number;
      rowsIgnored: number;
      multiEmailRows: number;
    };
    columnDetections?: {
      header: string;
      field: keyof ImportRow;
      confidence: number;
      source: string;
    }[];
    issues?: { severity: string; message: string; suggestion?: string }[];
  };
};

export type ColumnMapping = Partial<Record<string, keyof ImportRow>>;

export type ImportSummary = {
  importId: string;
  imported: number;
  newContacts: number;
  updatedContacts: number;
  duplicateEmails: number;
  duplicateCompanies: number;
  invalidEmails: number;
  missingCompany: number;
  missingEmail: number;
  companiesEnriched: number;
  skippedRows: number;
  errors: string[];
};

export type DuplicateGroup<T> = {
  key: string;
  items: T[];
};

export type KpiData = {
  totalContacts: number;
  totalCompanies: number;
  duplicateEmails: number;
  duplicateCompanies: number;
  contacted: number;
  notContacted: number;
  followUpDue: number;
  responses: number;
  interviews: number;
  offers: number;
  rejections: number;
};

export type MergeSuggestion = {
  canonical: string;
  variants: string[];
  confidence: number;
};
