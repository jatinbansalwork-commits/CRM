import { prisma, syncContactToFts, removeContactFromFts } from "@/lib/db";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { normalizeEmail } from "@/lib/utils/contact";
import { stringifyTags } from "@/lib/utils/contact";
import { buildFtsQuery, shouldSearchQuery } from "@/lib/search/fts-query";
import type { ContactListParams, PaginatedResult, ContactWithCompany } from "@/types";
import type { ContactInput } from "@/lib/validators/contact";
import type { IContactRepository } from "./types";

const contactInclude = {
  company: { select: { id: true, name: true, domain: true } },
  _count: { select: { notes: true } },
};

function buildWhere(filters: ContactListParams["filters"]) {
  const where: Record<string, unknown> = { deletedAt: null };

  if (!filters?.includeArchived) {
    where.status = { not: "ARCHIVED" };
  }

  if (filters?.status?.length) {
    where.status = { in: filters.status };
  }
  if (filters?.priority?.length) {
    where.priority = { in: filters.priority };
  }
  if (filters?.companyId) {
    where.companyId = filters.companyId;
  }
  if (filters?.source) {
    where.sourceFile = { contains: filters.source };
  }
  if (filters?.hasNotes) {
    where.notes = { some: {} };
  }
  if (filters?.missingCompany) {
    where.companyId = null;
  }
  if (filters?.missingRole) {
    where.OR = [{ role: null }, { role: "" }];
  }
  if (filters?.emailed !== undefined) {
    where.emailed = filters.emailed;
  }
  if (filters?.followupSent !== undefined) {
    where.followupSent = filters.followupSent;
  }
  if (filters?.linkedinSent !== undefined) {
    where.linkedinSent = filters.linkedinSent;
  }

  return where;
}

export class ContactRepository implements IContactRepository {
  async findMany(params: ContactListParams): Promise<PaginatedResult<ContactWithCompany>> {
    const take = params.take ?? DEFAULT_PAGE_SIZE;
    const where = buildWhere(params.filters);

    let contactIds: string[] | null = null;
    if (params.filters?.search) {
      contactIds = await this.searchContactIds(
        params.filters.search,
        Math.min(take + 50, 500),
      );
      if (contactIds.length === 0) {
        return { items: [], nextCursor: null, total: 0 };
      }
      where.id = { in: contactIds };
    }

    if (params.filters?.duplicate) {
      const dupes = await this.getDuplicateEmails();
      const dupeEmails = dupes.map((d) => normalizeEmail(d.email));
      const dupeContacts = await prisma.contact.findMany({
        where: { email: { in: dupeEmails }, deletedAt: null },
        select: { id: true },
      });
      const dupeIds = dupeContacts.map((c) => c.id);
      if (dupeIds.length === 0) {
        return { items: [], nextCursor: null, total: 0 };
      }
      where.id = contactIds
        ? { in: contactIds.filter((id) => dupeIds.includes(id)) }
        : { in: dupeIds };
    }

    const total = contactIds
      ? contactIds.length
      : await prisma.contact.count({ where });

    const orderBy: Record<string, string> = {};
    const sortBy = params.sortBy ?? "updatedAt";
    const sortOrder = params.sortOrder ?? "desc";

    if (sortBy === "company") {
      const items = await prisma.contact.findMany({
        where,
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: [
          { company: { name: sortOrder } },
          { name: "asc" },
          { email: "asc" },
        ],
        include: contactInclude,
      });

      if (contactIds) {
        const rank = new Map(contactIds.map((id, index) => [id, index]));
        items.sort(
          (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999),
        );
      }

      let nextCursor: string | null = null;
      if (items.length > take) {
        const next = items.pop();
        nextCursor = next?.id ?? null;
      }

      return {
        items: items as ContactWithCompany[],
        nextCursor,
        total,
      };
    }

    if (!contactIds) {
      orderBy[sortBy] = sortOrder;
    }

    const items = await prisma.contact.findMany({
      where,
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      ...(Object.keys(orderBy).length ? { orderBy } : {}),
      include: contactInclude,
    });

    if (contactIds) {
      const rank = new Map(contactIds.map((id, index) => [id, index]));
      items.sort(
        (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999),
      );
    }

    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }

    return {
      items: items as ContactWithCompany[],
      nextCursor,
      total,
    };
  }

  /** Full export — sorted by company, then name, then email. */
  async findAllForExport(
    filters?: ContactListParams["filters"],
  ): Promise<ContactWithCompany[]> {
    const where = buildWhere(filters);
    const items = await prisma.contact.findMany({
      where,
      orderBy: [
        { company: { name: "asc" } },
        { name: "asc" },
        { email: "asc" },
      ],
      include: contactInclude,
    });
    return items as ContactWithCompany[];
  }

  async findById(id: string): Promise<ContactWithCompany | null> {
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, domain: true } },
        notes: { orderBy: { createdAt: "desc" } },
      },
    });
    return contact as ContactWithCompany | null;
  }

  async findByEmail(email: string): Promise<ContactWithCompany | null> {
    const contact = await prisma.contact.findUnique({
      where: { email: normalizeEmail(email) },
      include: contactInclude,
    });
    return contact as ContactWithCompany | null;
  }

  async create(
    data: ContactInput & { domain?: string; importId?: string },
  ): Promise<ContactWithCompany> {
    const email = normalizeEmail(data.email);
    const contact = await prisma.contact.create({
      data: {
        name: data.name ?? null,
        email,
        role: data.role ?? null,
        department: data.department ?? null,
        domain: data.domain ?? email.split("@")[1] ?? null,
        linkedin: data.linkedin ?? null,
        website: data.website ?? null,
        sourceFile: data.sourceFile ?? null,
        sourceSheet: data.sourceSheet ?? null,
        sourceRow: data.sourceRow ?? null,
        tags: stringifyTags(data.tags ?? []),
        priority: data.priority ?? "MEDIUM",
        status: data.status ?? "NOT_CONTACTED",
        companyId: data.companyId ?? null,
        importId: data.importId ?? null,
        emailed: data.emailed ?? false,
        followupSent: data.followupSent ?? false,
        linkedinSent: data.linkedinSent ?? false,
        lastContacted: data.lastContacted ? new Date(data.lastContacted) : null,
        nextFollowup: data.nextFollowup ? new Date(data.nextFollowup) : null,
      },
      include: contactInclude,
    });

    if (data.note) {
      await prisma.contactNote.create({
        data: { contactId: contact.id, body: data.note },
      });
    }

    await syncContactToFts({
      ...contact,
      notes: data.note ? [{ body: data.note }] : [],
    });

    return contact as ContactWithCompany;
  }

  async update(id: string, data: Partial<ContactInput>): Promise<ContactWithCompany> {
    const updateData: Record<string, unknown> = {};

    if (data.companyName) {
      const { companyRepository } = await import("./company-repository");
      const company = await companyRepository.findOrCreate(data.companyName);
      updateData.companyId = company.id;
    }

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email) updateData.email = normalizeEmail(data.email);
    if (data.role !== undefined) updateData.role = data.role;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.linkedin !== undefined) updateData.linkedin = data.linkedin;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.sourceFile !== undefined) updateData.sourceFile = data.sourceFile;
    if (data.sourceSheet !== undefined) updateData.sourceSheet = data.sourceSheet;
    if (data.sourceRow !== undefined) updateData.sourceRow = data.sourceRow;
    if (data.tags) updateData.tags = stringifyTags(data.tags);
    if (data.priority) updateData.priority = data.priority;
    if (data.status) updateData.status = data.status;
    if (data.companyId !== undefined) updateData.companyId = data.companyId;
    if (data.emailed !== undefined) updateData.emailed = data.emailed;
    if (data.followupSent !== undefined) updateData.followupSent = data.followupSent;
    if (data.linkedinSent !== undefined) updateData.linkedinSent = data.linkedinSent;
    if (data.lastContacted !== undefined) {
      updateData.lastContacted = data.lastContacted ? new Date(data.lastContacted) : null;
    }
    if (data.nextFollowup !== undefined) {
      updateData.nextFollowup = data.nextFollowup ? new Date(data.nextFollowup) : null;
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: updateData,
      include: {
        company: { select: { id: true, name: true, domain: true } },
        notes: true,
      },
    });

    await syncContactToFts(contact);
    return contact as ContactWithCompany;
  }

  async softDelete(id: string): Promise<void> {
    await prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
    await removeContactFromFts(id);
  }

  async restore(id: string): Promise<void> {
    const contact = await prisma.contact.update({
      where: { id },
      data: { deletedAt: null },
      include: { company: true, notes: true },
    });
    await syncContactToFts(contact);
  }

  async bulkUpdate(ids: string[], data: Record<string, unknown>): Promise<number> {
    const result = await prisma.contact.updateMany({
      where: { id: { in: ids } },
      data,
    });
    for (const id of ids) {
      const contact = await prisma.contact.findUnique({
        where: { id },
        include: { company: true, notes: true },
      });
      if (contact) await syncContactToFts(contact);
    }
    return result.count;
  }

  /** Fast ID-only search — used by list + palette. */
  async searchContactIds(query: string, limit = 50): Promise<string[]> {
    const q = query.trim();
    if (!shouldSearchQuery(q)) return [];

    if (q.includes("@")) {
      const email = normalizeEmail(q);
      const exact = await prisma.contact.findMany({
        where: {
          deletedAt: null,
          OR: [
            { email: { equals: email } },
            { email: { startsWith: email } },
          ],
        },
        select: { id: true },
        take: limit,
      });
      if (exact.length > 0) return exact.map((c) => c.id);
    }

    const ftsQuery = buildFtsQuery(q);
    if (ftsQuery) {
      try {
        const ftsResults = await prisma.$queryRawUnsafe<{ contact_id: string }[]>(
          `SELECT contact_id FROM contacts_fts WHERE contacts_fts MATCH ? ORDER BY rank LIMIT ?`,
          ftsQuery,
          limit,
        );
        if (ftsResults.length > 0) {
          return ftsResults.map((r) => r.contact_id);
        }
      } catch {
        // FTS not ready — fall through
      }
    }

    const contacts = await prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { startsWith: q } },
          { email: { startsWith: q.toLowerCase() } },
          { company: { name: { startsWith: q } } },
        ],
      },
      select: { id: true },
      take: limit,
    });

    return contacts.map((c) => c.id);
  }

  async search(query: string, limit = 20): Promise<ContactWithCompany[]> {
    const ids = await this.searchContactIds(query, limit);
    if (ids.length === 0) return [];

    const contacts = await prisma.contact.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: contactInclude,
    });

    const rank = new Map(ids.map((id, index) => [id, index]));
    contacts.sort(
      (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999),
    );

    return contacts as ContactWithCompany[];
  }

  async searchLean(
    query: string,
    limit = 20,
  ): Promise<
    Array<{
      id: string;
      name: string | null;
      email: string;
      company: { id: string; name: string; domain: string | null } | null;
    }>
  > {
    const ids = await this.searchContactIds(query, limit);
    if (ids.length === 0) return [];

    const contacts = await prisma.contact.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        company: { select: { id: true, name: true, domain: true } },
      },
    });

    const rank = new Map(ids.map((id, index) => [id, index]));
    contacts.sort(
      (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999),
    );

    return contacts;
  }

  async getDuplicateEmails(): Promise<{ email: string; count: number }[]> {
    const results = await prisma.$queryRaw<{ email: string; count: number }[]>`
      SELECT email, COUNT(*) as count FROM Contact
      WHERE deletedAt IS NULL
      GROUP BY email HAVING count > 1
    `;
    return results;
  }

  async getDuplicateNames(): Promise<{ name: string; count: number }[]> {
    const results = await prisma.$queryRaw<{ name: string; count: number }[]>`
      SELECT name, COUNT(*) as count FROM Contact
      WHERE deletedAt IS NULL AND name IS NOT NULL AND name != ''
      GROUP BY name HAVING count > 1
      ORDER BY count DESC
      LIMIT 100
    `;
    return results;
  }
}

export const contactRepository = new ContactRepository();
