import { prisma } from "@/lib/db";
import { contactRepository, companyRepository } from "@/lib/repositories";
import { activityService } from "@/lib/services/activity/activity-service";
import type { ContactWithCompany } from "@/types";

export class DeduplicationService {
  async getDuplicateEmailGroups() {
    const dupes = await contactRepository.getDuplicateEmails();
    const groups = [];
    for (const dupe of dupes) {
      const contacts = await prisma.contact.findMany({
        where: { email: dupe.email, deletedAt: null },
        include: {
          company: { select: { id: true, name: true, domain: true } },
          _count: { select: { notes: true } },
        },
      });
      groups.push({ key: dupe.email, items: contacts as ContactWithCompany[] });
    }
    return groups;
  }

  async getDuplicateCompanyGroups() {
    return companyRepository.getDuplicateCompanies();
  }

  async getDuplicateDomainGroups() {
    return companyRepository.getDuplicateDomains();
  }

  async getDuplicateNameGroups() {
    const dupes = await contactRepository.getDuplicateNames();
    const groups = [];
    for (const dupe of dupes.slice(0, 50)) {
      const contacts = await prisma.contact.findMany({
        where: { name: dupe.name, deletedAt: null },
        include: {
          company: { select: { id: true, name: true, domain: true } },
          _count: { select: { notes: true } },
        },
      });
      groups.push({ key: dupe.name, items: contacts as ContactWithCompany[] });
    }
    return groups;
  }

  async mergeContacts(keepId: string, mergeId: string) {
    const keep = await contactRepository.findById(keepId);
    const merge = await contactRepository.findById(mergeId);
    if (!keep || !merge) throw new Error("Contact not found");

    await prisma.contactNote.updateMany({
      where: { contactId: mergeId },
      data: { contactId: keepId },
    });

    await prisma.activity.updateMany({
      where: { contactId: mergeId },
      data: { contactId: keepId },
    });

    const updates: Record<string, unknown> = {};
    if (!keep.name && merge.name) updates.name = merge.name;
    if (!keep.role && merge.role) updates.role = merge.role;
    if (!keep.department && merge.department) updates.department = merge.department;
    if (!keep.linkedin && merge.linkedin) updates.linkedin = merge.linkedin;
    if (!keep.companyId && merge.companyId) updates.companyId = merge.companyId;

    if (Object.keys(updates).length > 0) {
      await contactRepository.update(keepId, updates);
    }

    await contactRepository.softDelete(mergeId);
    await activityService.log("MERGED", keepId, { mergedFrom: mergeId });
  }

  async mergeCompanies(targetId: string, sourceId: string) {
    await companyRepository.merge(sourceId, targetId);
    await activityService.log("COMPANY_MERGED", undefined, { targetId, sourceId });
  }
}

export const deduplicationService = new DeduplicationService();
