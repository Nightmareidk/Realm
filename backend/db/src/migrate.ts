import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgres://realm:realm@localhost:5432/realm";
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

const client = postgres(url, { max: 1 });
try {
  await migrate(drizzle({ client }), { migrationsFolder });
  console.warn("✓ migrations applied");
} finally {
  await client.end();
}
