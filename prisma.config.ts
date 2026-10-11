
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const configDir = path.dirname(fileURLToPath(import.meta.url));
for (const dir of [configDir, process.cwd()]) {
  for (const relativePath of [
    "plant-tracker/.env.local",
    "plant-tracker/.env",
    ".env.local",
    ".env",
  ]) {
    loadEnvFile(path.join(dir, relativePath));
  }
}

function migrationConnectionUrl() {
  const raw = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("Set DIRECT_URL (unpooled Neon URL) or DATABASE_URL for Prisma migrations.");
  }

  // Session advisory locks used by `prisma migrate` do not work through Neon's pooler.
  let url = raw.replace(/-pooler\./, ".");
  if (!/[?&]connect_timeout=/.test(url)) {
    url += url.includes("?") ? "&connect_timeout=60" : "?connect_timeout=60";
  }

  const host = url.match(/@([^/?]+)/)?.[1];
  if (host) {
    console.log(`[prisma.config] migrate datasource host: ${host}`);
  }

  return url;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: migrationConnectionUrl(),
  },
});
