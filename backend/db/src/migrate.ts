import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { poolerAware } from "./client";

/**
 * Applies the migrations. Schema changes want a direct connection, not a transaction pooler:
 * on Neon or Supabase set DATABASE_DIRECT_URL to the direct (non-pooled) URL, and keep the
 * pooled one in DATABASE_URL for the running app.
 */
const url =
  process.env.DATABASE_DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgres://realm:realm@localhost:5432/realm";
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

const target = poolerAware(url);
const client = postgres(target.url, { max: 1, prepare: target.prepare });
try {
  await migrate(drizzle({ client }), { migrationsFolder });
  console.warn("✓ migrations applied");
} finally {
  await client.end();
}
