import { looksLikeHeaderRow } from "@/lib/parsers/column-inference";

const SEPARATOR_LINE = /^[\s\-_=.*#]{3,}$/;
const TITLE_LINE =
  /^(recruiter|hr|hiring|contact|vendor|client|company|employee|talent|people)\s*(list|database|sheet|export|contacts?)?/i;
const DATE_LINE = /^(updated|created|as of|last modified|exported)/i;
const INSTRUCTION_LINE = /^(note|instructions?|please|do not|important):/i;

export function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (SEPARATOR_LINE.test(t)) return true;
  if (INSTRUCTION_LINE.test(t)) return true;
  if (DATE_LINE.test(t) && !t.includes("@") && !t.includes("\t")) return true;
  if (TITLE_LINE.test(t) && !t.includes("\t") && !t.includes(",")) return true;
  return false;
}

export function stripMessyPreamble(lines: string[]): string[] {
  let start = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || isNoiseLine(line)) {
      start = i + 1;
      continue;
    }

    if (line.includes("\t") || (line.match(/,/g) ?? []).length >= 2) {
      break;
    }

    if (looksLikeHeaderRow(line.split(/\t|,|;/))) {
      break;
    }

    start = i + 1;
  }

  return lines.slice(start).filter((l) => {
    const t = l.trim();
    return t.length > 0 && !SEPARATOR_LINE.test(t);
  });
}

export function extractTableRegion(text: string): {
  text: string;
  rowsIgnored: number;
} {
  const allLines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const originalCount = allLines.length;
  const cleaned = stripMessyPreamble(allLines);
  return {
    text: cleaned.join("\n"),
    rowsIgnored: originalCount - cleaned.length,
  };
}
