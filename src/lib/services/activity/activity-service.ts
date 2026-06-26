import { prisma } from "@/lib/db";
import type { ActivityAction } from "@/lib/constants";

export class ActivityService {
  async log(
    action: ActivityAction,
    contactId?: string,
    metadata: Record<string, unknown> = {},
  ) {
    return prisma.activity.create({
      data: {
        action,
        contactId: contactId ?? null,
        metadata: JSON.stringify(metadata),
      },
    });
  }

  async logBulk(action: ActivityAction, contactIds: string[], metadata: Record<string, unknown> = {}) {
    return prisma.activity.createMany({
      data: contactIds.map((contactId) => ({
        action,
        contactId,
        metadata: JSON.stringify(metadata),
      })),
    });
  }

  async findMany(params: {
    cursor?: string;
    take?: number;
    action?: string;
  }) {
    const take = params.take ?? 50;
    const where: Record<string, unknown> = {};
    if (params.action) where.action = params.action;

    const total = await prisma.activity.count({ where });

    const items = await prisma.activity.findMany({
      where,
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { timestamp: "desc" },
      include: {
        contact: {
          select: { id: true, name: true, email: true, company: { select: { name: true } } },
        },
      },
    });

    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }

    return { items, nextCursor, total };
  }

  async getRecentImported(limit = 10) {
    return prisma.activity.findMany({
      where: { action: "IMPORTED" },
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        contact: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async getRecentlyContacted(limit = 10) {
    return prisma.contact.findMany({
      where: { deletedAt: null, lastContacted: { not: null } },
      orderBy: { lastContacted: "desc" },
      take: limit,
      include: {
        company: { select: { name: true } },
      },
    });
  }

  async getUpcomingFollowups(limit = 10) {
    return prisma.contact.findMany({
      where: {
        deletedAt: null,
        nextFollowup: { not: null },
        status: { notIn: ["ARCHIVED", "REJECTED", "OFFER"] },
      },
      orderBy: { nextFollowup: "asc" },
      take: limit,
      include: {
        company: { select: { name: true } },
      },
    });
  }
}

export const activityService = new ActivityService();
