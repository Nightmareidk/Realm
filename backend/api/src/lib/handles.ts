import { type Database, inArray, schema } from "@realm/db";
import { FAMOUS_HANDLES } from "../modules/auth/famous";
import { handleForms, isRealmName, RESERVED_USERNAMES } from "../modules/auth/reserved";

/**
 * Whether someone may take a username themselves. Kept back: Realm's own words and routes,
 * Realm's name with a staff word, famous people and brands (and near copies of them), and names
 * staff have set aside. Those go only to the right verified account, given by staff from the
 * admin pages. Returns why not, or null when it's free to take (if nobody has it).
 */
export async function whyReserved(
  db: Database,
  username: string,
  userId?: bigint,
): Promise<"system" | "famous" | null> {
  const name = username.toLowerCase();
  if (RESERVED_USERNAMES.has(name) || isRealmName(name)) return "system";
  const forms = handleForms(name);
  if ([...forms].some((f) => FAMOUS_HANDLES[f])) return "famous";
  const kept = await db
    .select({ claimedBy: schema.reservedHandles.claimedBy })
    .from(schema.reservedHandles)
    .where(inArray(schema.reservedHandles.handle, [...forms]));
  // A name staff gave you is yours to keep using.
  if (kept.some((k) => k.claimedBy === null || k.claimedBy !== userId)) return "famous";
  return null;
}

/** What to say when a name is kept back. */
export const RESERVED_MESSAGE = {
  system: "That username isn't available",
  famous:
    "That name is kept for a famous person or brand. If it's you, get verified and Realm can give it to you.",
} as const;
