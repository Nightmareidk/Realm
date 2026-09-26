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

export function createDb(url: string, options: { max?: number; appName?: string } = {}): DbHandle {
  const client = postgres(url, {
    max: options.max ?? 10,
    connection: { application_name: options.appName ?? "realm" },
    // bigint columns come back as JS bigint, matching the schema's `mode: "bigint"`.
    types: { bigint: postgres.BigInt },
  });
  const db = drizzle({ client, schema, casing: "snake_case" }) as unknown as Database;
  return { db, close: () => client.end({ timeout: 5 }) };
}
