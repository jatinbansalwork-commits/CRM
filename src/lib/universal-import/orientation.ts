import { extractEmailFromCell, isValidEmail } from "@/lib/utils/contact";
import type { SheetOrientation } from "./types";

function emailRate(cells: string[]): number {
  const filled = cells.filter((c) => c.trim());
  if (filled.length === 0) return 0;
  return filled.filter((c) => {
    const e = extractEmailFromCell(c);
    return e !== null && isValidEmail(e);
  }).length / filled.length;
}

/** Detect if grid is a horizontal email matrix (few rows, many email columns). */
export function detectOrientation(grid: string[][]): SheetOrientation {
  if (grid.length === 0) return "vertical-table";

  const rowCount = grid.length;
  const colCount = Math.max(...grid.map((r) => r.length), 0);

  if (colCount <= 1 && rowCount > 1) {
    const col0 = grid.map((r) => r[0] ?? "");
    if (emailRate(col0) >= 0.7) return "email-list-vertical";
    return "single-column";
  }

  if (rowCount <= 3 && colCount >= 4) {
    const flat = grid.flat();
    if (emailRate(flat) >= 0.6) return "horizontal-matrix";
  }

  if (rowCount === 1 && colCount >= 2) {
    const row0 = grid[0] ?? [];
    if (emailRate(row0) >= 0.7) return "horizontal-matrix";
  }

  const hasTabs = grid.some((r) => r.length >= 2);
  if (!hasTabs && rowCount > 2) {
    const allEmails = emailRate(grid.flat());
    if (allEmails >= 0.5) return "email-list-vertical";
  }

  return "vertical-table";
}

/** Transpose horizontal email matrix into vertical contact rows. */
export function transposeEmailMatrix(grid: string[][]): string[][] {
  if (grid.length === 0) return [];

  const maxCols = Math.max(...grid.map((r) => r.length), 0);
  const emails: string[] = [];

  for (const row of grid) {
    for (let c = 0; c < maxCols; c++) {
      const cell = (row[c] ?? "").trim();
      if (!cell) continue;
      const extracted = extractEmailFromCell(cell);
      if (extracted && isValidEmail(extracted)) {
        emails.push(extracted);
      }
    }
  }

  return emails.map((e) => [e]);
}
