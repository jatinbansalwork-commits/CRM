import type { ImportRow } from "@/types";
import type { ContactWithCompany } from "@/types";
import type { ContactInput } from "@/lib/validators/contact";

export function mergeContactData(
  existing: ContactWithCompany,
  incoming: ImportRow & { email: string },
): Partial<ContactInput> {
  const updates: Partial<ContactInput> = {};

  if (!existing.name && incoming.name) updates.name = incoming.name;
  if (!existing.companyId && incoming.company) updates.companyName = incoming.company;
  if (!existing.role && incoming.role) updates.role = incoming.role;
  if (!existing.department && incoming.department) updates.department = incoming.department;
  if (!existing.linkedin && incoming.linkedin) updates.linkedin = incoming.linkedin;
  if (!existing.website && incoming.website) updates.website = incoming.website;
  if (!existing.sourceFile && incoming.sourceFile) updates.sourceFile = incoming.sourceFile;
  if (!existing.sourceSheet && incoming.sourceSheet) updates.sourceSheet = incoming.sourceSheet;
  if (!existing.sourceRow && incoming.sourceRow) updates.sourceRow = incoming.sourceRow;

  if (incoming.priority && existing.priority === "MEDIUM" && incoming.priority !== "MEDIUM") {
    updates.priority = incoming.priority;
  }

  return updates;
}

export function mergeOutreachFlags(
  existing: ContactWithCompany,
  incoming: Partial<ImportRow>,
): { emailed: boolean; followupSent: boolean; linkedinSent: boolean } {
  return {
    emailed: existing.emailed || Boolean(incoming.status === "CONTACTED"),
    followupSent: existing.followupSent,
    linkedinSent: existing.linkedinSent,
  };
}

export function mergeDates(
  existingLast: Date | null,
  incomingLast: Date | null | undefined,
  existingFollowup: Date | null,
  incomingFollowup: Date | null | undefined,
): { lastContacted: Date | null; nextFollowup: Date | null } {
  let lastContacted = existingLast;
  if (incomingLast) {
    lastContacted =
      !existingLast || incomingLast > existingLast ? incomingLast : existingLast;
  }

  let nextFollowup = existingFollowup;
  if (incomingFollowup) {
    nextFollowup =
      !existingFollowup || incomingFollowup < existingFollowup
        ? incomingFollowup
        : existingFollowup;
  }

  return { lastContacted, nextFollowup };
}
