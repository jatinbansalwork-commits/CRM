import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  if (envUrl.startsWith("file:")) {
    const relative = envUrl.replace("file:", "");
    if (path.isAbsolute(relative)) return envUrl;
    return `file:${path.join(process.cwd(), relative.replace(/^\.\//, ""))}`;
  }
  return `file:${path.join(process.cwd(), "dev.db")}`;
}

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: getDatabaseUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function getDatabasePath() {
  return getDatabaseUrl().replace("file:", "");
}

export async function initFts() {
  await prisma.$executeRawUnsafe(`
    CREATE VIRTUAL TABLE IF NOT EXISTS contacts_fts USING fts5(
      contact_id UNINDEXED,
      name,
      email,
      company,
      role,
      department,
      domain,
      tags,
      source_file,
      notes,
      tokenize='porter unicode61'
    );
  `);
}

export async function syncContactToFts(contact: {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  department: string | null;
  domain: string | null;
  tags: string;
  sourceFile: string | null;
  company?: { name: string } | null;
  notes?: { body: string }[];
}) {
  const noteText = contact.notes?.map((n) => n.body).join(" ") ?? "";
  const companyName = contact.company?.name ?? "";

  await prisma.$executeRawUnsafe(
    `DELETE FROM contacts_fts WHERE contact_id = ?`,
    contact.id,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO contacts_fts (contact_id, name, email, company, role, department, domain, tags, source_file, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    contact.id,
    contact.name ?? "",
    contact.email,
    companyName,
    contact.role ?? "",
    contact.department ?? "",
    contact.domain ?? "",
    contact.tags,
    contact.sourceFile ?? "",
    noteText,
  );
}

export async function removeContactFromFts(contactId: string) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM contacts_fts WHERE contact_id = ?`,
    contactId,
  );
}
