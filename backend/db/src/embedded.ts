import { mkdirSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database, DbHandle } from "./client";
import * as schema from "./schema";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * Development only: Postgres compiled to WebAssembly (PGlite), running inside the API process
 * and keeping its data in a folder, so there's nothing to install or run alongside. One
 * connection, one process. `pglite:memory` keeps nothing; a relative folder is taken from the
 * repo root (`pglite:.data/pglite`). Migrations are applied on every start.
 */
export async function openEmbeddedDb(target: string): Promise<DbHandle> {
  let dataDir: string | undefined;
  if (target !== "memory") {
    dataDir = isAbsolute(target) ? target : resolve(repoRoot, target);
    mkdirSync(dataDir, { recursive: true });
  }
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema, casing: "snake_case" });
  try {
    await migrate(db, { migrationsFolder });
  } catch (err) {
    await client.close().catch(() => {});
    throw err;
  }
  return { db: db as unknown as Database, close: () => client.close() };
}
