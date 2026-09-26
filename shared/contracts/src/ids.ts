import { z } from "zod";

/** Realm epoch: 2026-01-01T00:00:00.000Z. Snowflake timestamps count milliseconds from here. */
export const REALM_EPOCH_MS = 1_767_225_600_000n;

/**
 * Snowflake IDs are 64-bit integers. They are ALWAYS strings on the wire:
 * JavaScript numbers lose precision above 2^53.
 */
export const Snowflake = z
  .string()
  .regex(/^[1-9]\d{0,19}$/, "Invalid ID")
  .meta({ id: "Snowflake", description: "64-bit ID encoded as a decimal string" });
export type Snowflake = z.infer<typeof Snowflake>;

/** Milliseconds since Unix epoch at which the ID was generated. */
export function snowflakeTimestamp(id: Snowflake): number {
  return Number((BigInt(id) >> 22n) + REALM_EPOCH_MS);
}

/** Smallest snowflake that could have been generated at `date` — useful for time-based cursors. */
export function snowflakeFromDate(date: Date): Snowflake {
  const ms = BigInt(date.getTime()) - REALM_EPOCH_MS;
  return ((ms < 0n ? 0n : ms) << 22n).toString();
}

export function compareSnowflakes(a: Snowflake, b: Snowflake): number {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
