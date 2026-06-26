/** Build an FTS5 MATCH expression with prefix support. */
export function buildFtsQuery(raw: string): string | null {
  const q = raw.trim();
  if (!q) return null;

  if (q.includes("@")) {
    const email = q.toLowerCase().replace(/[^\w@.-]/g, "");
    if (email.length >= 3) {
      return `email:"${email}"*`;
    }
  }

  const terms = q
    .toLowerCase()
    .replace(/[^\w\s@.-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  if (terms.length === 0) {
    if (q.length >= 2) return `${q.toLowerCase()}*`;
    return null;
  }

  return terms.map((t) => (t.includes("@") ? `email:"${t}"*` : `${t}*`)).join(" OR ");
}

export function shouldSearchQuery(raw: string): boolean {
  const q = raw.trim();
  if (!q) return false;
  if (q.includes("@")) return q.length >= 3;
  return q.length >= 2;
}

export const SEARCH_DEBOUNCE_MS = 150;
export const SEARCH_STALE_MS = 30_000;
