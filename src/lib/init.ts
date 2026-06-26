import { initFts } from "./db";

let initialized = false;

export async function ensureDbReady() {
  if (initialized) return;
  await initFts();
  initialized = true;
}
