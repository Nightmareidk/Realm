import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Schema = typeof schema;

/** Driver-agnostic handle: production uses postgres.js, tests use PGlite. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;
export type Transaction = PgTransaction<
  PgQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;
/** Anything that can run queries — pass this to repositories so they work inside transactions. */
export type Executor = Database | Transaction;

export interface DbHandle {
  db: Database;
  close: () => Promise<void>;
}

/** The embedded development database: `pglite:<folder>` or `pglite:memory`. */
export const EMBEDDED_PREFIX = "pglite:";

/**
 * Opens the database a URL names: Postgres over the network (postgres.js), or in development the
 * embedded one (PGlite, migrated on open). The embedded driver is loaded only when asked for.
 */
export async function openDb(
  url: string,
  options: { max?: number; appName?: string } = {},
): Promise<DbHandle> {
  if (url.startsWith(EMBEDDED_PREFIX)) {
    const { openEmbeddedDb } = await import("./embedded");
    return openEmbeddedDb(url.slice(EMBEDDED_PREFIX.length) || "memory");
  }
  return createDb(url, options);
}

/**
 * A transaction pooler (Supabase's on port 6543, Neon's "-pooler" hosts, anything flagged
 * `pgbouncer=true`) can't hold prepared statements between transactions, so they're turned off
 * there. The flag itself isn't a Postgres setting and is taken out of the URL.
 */
export function poolerAware(url: string): { url: string; prepare: boolean } {
  const pooled = /[?&]pgbouncer=true\b|-pooler\.|pooler\.supabase\.com|:6543\//.test(url);
  const clean = url.replace(/([?&])pgbouncer=true&?/, "$1").replace(/[?&]$/, "");
  return { url: clean, prepare: !pooled };
}

export function createDb(url: string, options: { max?: number; appName?: string } = {}): DbHandle {
  const target = poolerAware(url);
  // Neon and Supabase need TLS: put `?sslmode=require` on their URLs (postgres.js reads it).
  const client = postgres(target.url, {
    prepare: target.prepare,
    max: options.max ?? 10,
    connection: { application_name: options.appName ?? "realm" },
    // bigint columns come back as JS bigint, matching the schema's `mode: "bigint"`.
    types: { bigint: postgres.BigInt },
  });
  const db = drizzle({ client, schema, casing: "snake_case" }) as unknown as Database;
  return { db, close: () => client.end({ timeout: 5 }) };
}
