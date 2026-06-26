import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getTursoConfig() {
  const url =
    process.env.TURSO_DATABASE_URL ??
    (process.env.DATABASE_URL?.startsWith("libsql:")
      ? process.env.DATABASE_URL
      : undefined);
  if (!url) return null;
  return {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN ?? "",
  };
}

function getLocalDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  if (envUrl.startsWith("file:")) {
    const relative = envUrl.replace("file:", "");
    if (path.isAbsolute(relative)) return envUrl;
    return `file:${path.join(process.cwd(), relative.replace(/^\.\//, ""))}`;
  }
  return `file:${path.join(process.cwd(), "dev.db")}`;
}

function createPrismaClient(): PrismaClient {
  const turso = getTursoConfig();
  if (turso) {
    return new PrismaClient({
      adapter: new PrismaLibSql(turso),
    });
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Vercel cannot use a local SQLite file. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN " +
        "in Vercel → Settings → Environment Variables, then run: npm run db:turso:migrate",
    );
  }

  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: getLocalDatabaseUrl() }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;

export function getDatabasePath() {
  return getLocalDatabaseUrl().replace("file:", "");
}

export function isRemoteDatabase() {
  return getTursoConfig() !== null;
}

let ftsReady = false;
let ftsDisabled = false;

export async function initFts() {
  if (ftsDisabled || ftsReady) return;
  try {
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
    ftsReady = true;
  } catch (err) {
    ftsDisabled = true;
    console.warn(
      "[db] Full-text search index unavailable:",
      err instanceof Error ? err.message : err,
    );
  }
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
  if (ftsDisabled) return;

  const noteText = contact.notes?.map((n) => n.body).join(" ") ?? "";
  const companyName = contact.company?.name ?? "";

  try {
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
  } catch (err) {
    ftsDisabled = true;
    console.warn(
      "[db] FTS sync skipped:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function removeContactFromFts(contactId: string) {
  if (ftsDisabled) return;
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM contacts_fts WHERE contact_id = ?`,
      contactId,
    );
  } catch {
    ftsDisabled = true;
  }
}
