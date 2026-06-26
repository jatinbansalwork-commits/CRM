import { initFts, prisma } from "./db";

let initialized = false;

export async function ensureDbReady() {
  if (initialized) return;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database connection failed";
    if (message.includes("unable to open database file") || process.env.VERCEL) {
      throw new Error(
        "Database is not configured for production. On Vercel, set TURSO_DATABASE_URL " +
          "and TURSO_AUTH_TOKEN, then run npm run db:turso:migrate. See README.",
      );
    }
    throw err;
  }

  await initFts();
  initialized = true;
}
