import { prisma } from "@/lib/db";
import { normalizeCompanyName, detectRoleCategory } from "@/lib/utils/contact";
import type { PaginatedResult, ContactWithCompany } from "@/types";
import type { CompanyWithStats, CompanyDetail, ICompanyRepository } from "./types";

export class CompanyRepository implements ICompanyRepository {
  async findMany(params: {
    cursor?: string;
    take?: number;
    search?: string;
  }): Promise<PaginatedResult<CompanyWithStats>> {
    const take = params.take ?? 50;
    const where: Record<string, unknown> = {};

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q } },
        { domain: { contains: q.toLowerCase() } },
      ];
    }

    const total = params.search
      ? undefined
      : await prisma.company.count({ where });

    const companies = await prisma.company.findMany({
      where,
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { name: "asc" },
      include: {
        _count: { select: { contacts: { where: { deletedAt: null } } } },
        contacts: {
          where: { deletedAt: null },
          select: { status: true },
        },
      },
    });

    let nextCursor: string | null = null;
    if (companies.length > take) {
      const next = companies.pop();
      nextCursor = next?.id ?? null;
    }

    const items: CompanyWithStats[] = companies.map((c) => {
      const contacted = c.contacts.filter((ct) => ct.status !== "NOT_CONTACTED").length;
      return {
        id: c.id,
        name: c.name,
        domain: c.domain,
        website: c.website,
        industry: c.industry,
        notes: c.notes,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        _count: { contacts: c._count.contacts },
        contacted,
        remaining: c._count.contacts - contacted,
      };
    });

    return { items, nextCursor, total: total ?? items.length };
  }

  async findById(id: string): Promise<CompanyDetail | null> {
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        contacts: {
          where: { deletedAt: null },
          include: {
            company: { select: { id: true, name: true, domain: true } },
            _count: { select: { notes: true } },
          },
          orderBy: { name: "asc" },
        },
        _count: { select: { contacts: { where: { deletedAt: null } } } },
      },
    });

    if (!company) return null;

    const contacts = company.contacts as ContactWithCompany[];
    const contacted = contacts.filter((c) => c.status !== "NOT_CONTACTED").length;
    const responses = contacts.filter((c) =>
      ["REPLIED", "INTERVIEW", "OFFER"].includes(c.status),
    ).length;
    const interviews = contacts.filter((c) =>
      ["INTERVIEW", "OFFER"].includes(c.status),
    ).length;
    const offers = contacts.filter((c) => c.status === "OFFER").length;

    const roleGroups: Record<string, ContactWithCompany[]> = {};
    for (const contact of contacts) {
      const category = detectRoleCategory(contact.role);
      if (!roleGroups[category]) roleGroups[category] = [];
      roleGroups[category].push(contact);
    }

    return {
      id: company.id,
      name: company.name,
      domain: company.domain,
      website: company.website,
      industry: company.industry,
      notes: company.notes,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      _count: { contacts: company._count.contacts },
      contacted,
      remaining: company._count.contacts - contacted,
      contacts,
      stats: { contacted, remaining: company._count.contacts - contacted, responses, interviews, offers },
      roleGroups,
    };
  }

  async findOrCreate(
    name: string,
    domain?: string | null,
  ): Promise<{ id: string; name: string }> {
    const normalized = normalizeCompanyName(name);
    if (!normalized) throw new Error("Company name required");

    if (domain) {
      const byDomain = await prisma.company.findFirst({ where: { domain } });
      if (byDomain) return { id: byDomain.id, name: byDomain.name };
    }

    const existing = await prisma.company.findFirst({
      where: { name: { equals: normalized } },
    });
    if (existing) return { id: existing.id, name: existing.name };

    const company = await prisma.company.create({
      data: { name: normalized, domain: domain ?? null },
    });
    return { id: company.id, name: company.name };
  }

  async merge(sourceId: string, targetId: string): Promise<void> {
    await prisma.$transaction([
      prisma.contact.updateMany({
        where: { companyId: sourceId },
        data: { companyId: targetId },
      }),
      prisma.company.delete({ where: { id: sourceId } }),
    ]);
  }

  async getDuplicateCompanies(): Promise<{ name: string; count: number; ids: string[] }[]> {
    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
    });

    const groups = new Map<string, string[]>();
    for (const c of companies) {
      const key = normalizeCompanyName(c.name).toLowerCase();
      const existing = groups.get(key) ?? [];
      existing.push(c.id);
      groups.set(key, existing);
    }

    return Array.from(groups.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([name, ids]) => ({ name, count: ids.length, ids }))
      .sort((a, b) => b.count - a.count);
  }

  async getDuplicateDomains(): Promise<{ domain: string; count: number; ids: string[] }[]> {
    const companies = await prisma.company.findMany({
      where: { domain: { not: null } },
    });

    const groups = new Map<string, string[]>();
    for (const c of companies) {
      if (!c.domain) continue;
      const key = c.domain.toLowerCase();
      const existing = groups.get(key) ?? [];
      existing.push(c.id);
      groups.set(key, existing);
    }

    return Array.from(groups.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([domain, ids]) => ({ domain, count: ids.length, ids }))
      .sort((a, b) => b.count - a.count);
  }
}

export const companyRepository = new CompanyRepository();
