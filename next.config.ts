import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(/* turbopackIgnore: true */ process.cwd()),
  },
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@libsql/client",
    "@prisma/adapter-libsql",
  ],
};

export default nextConfig;
