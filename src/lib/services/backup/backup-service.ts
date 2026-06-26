import { readFile, copyFile } from "fs/promises";
import { getDatabasePath } from "@/lib/db";

export class BackupService {
  async getDatabaseBuffer(): Promise<Buffer> {
    return readFile(getDatabasePath());
  }

  async restoreDatabase(buffer: Buffer): Promise<void> {
    const dbPath = getDatabasePath();
    const backupPath = `${dbPath}.backup-${Date.now()}`;
    try {
      await copyFile(dbPath, backupPath);
    } catch {
      // No existing db
    }
    const { writeFile } = await import("fs/promises");
    await writeFile(dbPath, buffer);
  }
}

export const backupService = new BackupService();
