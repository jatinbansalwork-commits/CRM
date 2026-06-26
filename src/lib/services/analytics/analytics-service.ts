import { prisma } from "@/lib/db";
import { contactRepository, companyRepository } from "@/lib/repositories";
import type { KpiData } from "@/types";

export class AnalyticsService {
  async getKpis(): Promise<KpiData> {
    const [
      totalContacts,
      totalCompanies,
      contacted,
      notContacted,
      followUpDue,
      responses,
      interviews,
      offers,
      rejections,
      duplicateEmails,
      duplicateCompanies,
    ] = await Promise.all([
      prisma.contact.count({ where: { deletedAt: null } }),
      prisma.company.count(),
      prisma.contact.count({
        where: { deletedAt: null, status: { not: "NOT_CONTACTED" } },
      }),
      prisma.contact.count({
        where: { deletedAt: null, status: "NOT_CONTACTED" },
      }),
      prisma.contact.count({
        where: {
          deletedAt: null,
          nextFollowup: { lte: new Date() },
          status: { notIn: ["ARCHIVED", "REJECTED", "OFFER"] },
        },
      }),
      prisma.contact.count({
        where: { deletedAt: null, status: { in: ["REPLIED", "INTERVIEW", "OFFER"] } },
      }),
      prisma.contact.count({
        where: { deletedAt: null, status: { in: ["INTERVIEW", "OFFER"] } },
      }),
      prisma.contact.count({ where: { deletedAt: null, status: "OFFER" } }),
      prisma.contact.count({ where: { deletedAt: null, status: "REJECTED" } }),
      contactRepository.getDuplicateEmails().then((d) => d.length),
      companyRepository.getDuplicateCompanies().then((d) => d.length),
    ]);

    return {
      totalContacts,
      totalCompanies,
      duplicateEmails,
      duplicateCompanies,
      contacted,
      notContacted,
      followUpDue,
      responses,
      interviews,
      offers,
      rejections,
    };
  }

  async getContactsByCompany(limit = 10) {
    const companies = await prisma.company.findMany({
      include: {
        _count: { select: { contacts: { where: { deletedAt: null } } } },
      },
      take: 100,
    });
    return companies
      .sort((a, b) => b._count.contacts - a._count.contacts)
      .slice(0, limit)
      .map((c) => ({
        name: c.name,
        count: c._count.contacts,
      }));
  }

  async getTopDomains(limit = 10) {
    const results = await prisma.$queryRaw<{ domain: string; count: number }[]>`
      SELECT domain, COUNT(*) as count FROM Contact
      WHERE deletedAt IS NULL AND domain IS NOT NULL
      GROUP BY domain ORDER BY count DESC LIMIT ${limit}
    `;
    return results;
  }

  async getStatusBreakdown() {
    const results = await prisma.contact.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: true,
    });
    return results.map((r) => ({ status: r.status, count: r._count }));
  }

  async getOutreachProgress() {
    const [emailed, followupSent, linkedinSent, total] = await Promise.all([
      prisma.contact.count({ where: { deletedAt: null, emailed: true } }),
      prisma.contact.count({ where: { deletedAt: null, followupSent: true } }),
      prisma.contact.count({ where: { deletedAt: null, linkedinSent: true } }),
      prisma.contact.count({ where: { deletedAt: null } }),
    ]);
    return { emailed, followupSent, linkedinSent, total };
  }

  async getImportHistory(limit = 10) {
    return prisma.import.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  }

  async getMissingData() {
    const [missingCompany, missingRole, missingName] = await Promise.all([
      prisma.contact.count({ where: { deletedAt: null, companyId: null } }),
      prisma.contact.count({
        where: { deletedAt: null, OR: [{ role: null }, { role: "" }] },
      }),
      prisma.contact.count({
        where: { deletedAt: null, OR: [{ name: null }, { name: "" }] },
      }),
    ]);
    return { missingCompany, missingRole, missingName };
  }

  async getRates() {
    const total = await prisma.contact.count({
      where: { deletedAt: null, status: { not: "NOT_CONTACTED" } },
    });
    if (total === 0) return { responseRate: 0, interviewRate: 0, offerRate: 0 };

    const [responses, interviews, offers] = await Promise.all([
      prisma.contact.count({
        where: { deletedAt: null, status: { in: ["REPLIED", "INTERVIEW", "OFFER"] } },
      }),
      prisma.contact.count({
        where: { deletedAt: null, status: { in: ["INTERVIEW", "OFFER"] } },
      }),
      prisma.contact.count({ where: { deletedAt: null, status: "OFFER" } }),
    ]);

    const contacted = await prisma.contact.count({
      where: { deletedAt: null, status: { not: "NOT_CONTACTED" } },
    });

    return {
      responseRate: contacted ? (responses / contacted) * 100 : 0,
      interviewRate: contacted ? (interviews / contacted) * 100 : 0,
      offerRate: contacted ? (offers / contacted) * 100 : 0,
    };
  }
}

export const analyticsService = new AnalyticsService();
