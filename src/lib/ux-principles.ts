/**
 * UX laws & principles — implementation constants.
 * Each constant maps to a deliberate UI decision in the app.
 */

/** Doherty Threshold: feedback should feel instant (<400ms) */
export const DEBOUNCE_SEARCH_MS = 150;
export const TOAST_DURATION_MS = 4000;

/** Miller's Law: max visible primary choices per group */
export const MAX_PRIMARY_ACTIONS = 3;
export const MAX_FILTER_CHIPS = 7;

/** Fitts's Law */
export const MIN_TOUCH_TARGET_PX = 44;

/** Goal-Gradient: import wizard steps */
export const IMPORT_STEPS = [
  { id: "input", label: "Upload" },
  { id: "preview", label: "Preview" },
  { id: "mapping", label: "Map columns" },
  { id: "summary", label: "Complete" },
] as const;

export type ImportStepId = (typeof IMPORT_STEPS)[number]["id"];

export const UX_LAWS = {
  fitts: "Large, reachable targets for frequent actions",
  hick: "Fewer choices per screen; progressive disclosure",
  miller: "Chunk nav & filters into groups of ≤7",
  jakob: "Familiar sidebar + page header patterns",
  proximity: "Related controls grouped in sections",
  similarity: "Consistent badges, buttons, and spacing",
  commonRegion: "Cards & bordered panels group related content",
  aestheticUsability: "Polished surfaces build trust",
  peakEnd: "Strong import success & undo moments",
  vonRestorff: "Primary CTA visually distinct",
  tesler: "Complexity lives in import wizard, not dashboard",
  pareto: "Dashboard highlights the vital 20% of metrics",
  doherty: "Skeletons & debounced search under 400ms feel",
  zeigarnik: "Surface incomplete follow-ups prominently",
  serialPosition: "Key actions first and last in toolbars",
  praggnanz: "Simple forms, minimal visual noise",
  postel: "Forgiving import — merge, skip bad rows",
  goalGradient: "Step progress during multi-step flows",
  feedback: "Toast + confirm on every destructive action",
} as const;
