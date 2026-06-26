import { ensureDbReady } from "@/lib/init";

export async function withDb<T>(handler: () => Promise<T>): Promise<T> {
  await ensureDbReady();
  return handler();
}
