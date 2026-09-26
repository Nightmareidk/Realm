import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database, DbHandle } from "./client";
import * as schema from "./schema";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * A fresh, fully migrated, in-memory Postgres (PGlite/WASM) for tests.
 * No Docker needed; every call is isolated.
 */
export async function createTestDb(): Promise<DbHandle> {
  const client = new PGlite();
  const db = drizzle({ client, schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder });
  return { db: db as unknown as Database, close: () => client.close() };
}
