import { bigint, timestamp } from "drizzle-orm/pg-core";

// Column names come from property keys via `casing: "snake_case"` (drizzle.config.ts + client).

/** Snowflake ID column (64-bit). JS side is `bigint`; the API layer converts to strings. */
export const id = () => bigint({ mode: "bigint" });

export const tstz = () => timestamp({ withTimezone: true, mode: "date" });

export const createdAt = () => tstz().notNull().defaultNow();

export const updatedAt = () =>
  tstz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
