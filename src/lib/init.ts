import { getDbDiagnostics, initFts, prisma } from "./db";

let initialized = false;

function productionConfigError(): Error {
  const diag = getDbDiagnostics();
  if (!diag.hasUrl && !diag.hasToken) {
    return new Error(
      "Missing TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel environment variables.",
    );
  }
  if (!diag.hasUrl) {
    return new Error(
      "Missing TURSO_DATABASE_URL. Set it to libsql://sheet-jatinbansalwork-commits.aws-ap-south-1.turso.io in Vercel.",
    );
  }
  if (!diag.hasToken) {
    return new Error(
      "Missing TURSO_AUTH_TOKEN. Create a database token in Turso (not the org token) and add it in Vercel.",
    );
  }
  return new Error(
    "Database credentials are set but connection failed. Use a database token from Turso → sheet → Tokens.",
  );
}

export async function ensureDbReady() {
  if (initialized) return;

  if (process.env.VERCEL && !getDbDiagnostics().configured) {
    throw productionConfigError();
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database connection failed";
    if (message.includes("unable to open database file")) {
      throw productionConfigError();
    }
    if (process.env.VERCEL && (message.includes("401") || message.includes("Unauthorized"))) {
      throw new Error(
        "Turso rejected the auth token (401). In Vercel, set TURSO_AUTH_TOKEN to a database token from Turso → sheet → Tokens — not the org/platform token.",
      );
    }
    throw err instanceof Error ? err : new Error(message);
  }

  await initFts();
  initialized = true;
}
