import "dotenv/config";
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Set TURSO_DATABASE_URL (libsql://...) before running this script.");
  process.exit(1);
}

const migrationDir = path.join(
  process.cwd(),
  "prisma/migrations/20260626140840_init",
);
const sqlPath = path.join(migrationDir, "migration.sql");

if (!fs.existsSync(sqlPath)) {
  console.error("Migration file not found:", sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const client = createClient({ url, authToken });

const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  console.log(`Applying ${statements.length} statements to ${url}...`);
  for (const statement of statements) {
    await client.execute(statement);
  }

  await client.execute(`
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

  console.log("Turso database ready.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.close());
