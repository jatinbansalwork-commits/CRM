import type { ContactFilters, ContactListParams, PaginatedResult, ContactWithCompany } from "@/types";
import type { ContactStatus, Priority } from "@/lib/constants";
import type { ContactInput } from "@/lib/validators/contact";

export interface IContactRepository {
  findMany(params: ContactListParams): Promise<PaginatedResult<ContactWithCompany>>;
  findById(id: string): Promise<ContactWithCompany | null>;
  findByEmail(email: string): Promise<ContactWithCompany | null>;
  create(data: ContactInput & { domain?: string; importId?: string }): Promise<ContactWithCompany>;
  update(id: string, data: Partial<ContactInput>): Promise<ContactWithCompany>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  bulkUpdate(ids: string[], data: Record<string, unknown>): Promise<number>;
  search(query: string, limit?: number): Promise<ContactWithCompany[]>;
  getDuplicateEmails(): Promise<{ email: string; count: number }[]>;
  getDuplicateNames(): Promise<{ name: string; count: number }[]>;
}

export interface ICompanyRepository {
  findMany(params: { cursor?: string; take?: number; search?: string }): Promise<PaginatedResult<CompanyWithStats>>;
  findById(id: string): Promise<CompanyDetail | null>;
  findOrCreate(name: string, domain?: string | null): Promise<{ id: string; name: string }>;
  merge(sourceId: string, targetId: string): Promise<void>;
  getDuplicateCompanies(): Promise<{ name: string; count: number; ids: string[] }[]>;
  getDuplicateDomains(): Promise<{ domain: string; count: number; ids: string[] }[]>;
}

export type CompanyWithStats = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { contacts: number };
  contacted: number;
  remaining: number;
};

export type CompanyDetail = CompanyWithStats & {
  contacts: ContactWithCompany[];
  stats: {
    contacted: number;
    remaining: number;
    responses: number;
    interviews: number;
    offers: number;
  };
  roleGroups: Record<string, ContactWithCompany[]>;
};
