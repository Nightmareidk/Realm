import { z } from "zod";

/**
 * Sparks and Glow (Realm's own take on boosting a server). Members give a Space Sparks; enough of
 * them light it up to a Glow level, with perks for everyone inside. Prices come later; until
 * payments are set up, Sparks can be tried for free while Realm is being built.
 */
export const GLOW_LEVELS = [
  {
    level: 1,
    sparks: 3,
    name: "Glow 1",
    perks: [
      "A banner across the top of the Space",
      "Photos and files up to 50 MB",
      "Clearer sound in voice rooms",
    ],
  },
  {
    level: 2,
    sparks: 9,
    name: "Glow 2",
    perks: [
      "A Space look: one theme everyone inside sees",
      "A moving Space picture",
      "Up to 100 rooms",
    ],
  },
  {
    level: 3,
    sparks: 18,
    name: "Glow 3",
    perks: [
      "Your own invite name (tomyrealm.com/your-space)",
      "Studio sound in voice rooms",
      "Listen together: play music to a whole room",
    ],
  },
] as const;

/** How many Sparks one person can give one Space at a time. */
export const SPARKS_PER_PERSON = 2;
/** How long a Spark lasts (renewed each month once payments exist). */
export const SPARK_DAYS = 30;

export function glowLevel(sparks: number): 0 | 1 | 2 | 3 {
  let level: 0 | 1 | 2 | 3 = 0;
  for (const g of GLOW_LEVELS) if (sparks >= g.sparks) level = g.level;
  return level;
}

export const SparkStatus = z
  .object({
    count: z.number().int(),
    level: z.number().int().min(0).max(3),
    /** Sparks still needed for the next level (null at Glow 3). */
    toNext: z.number().int().nullable(),
    /** Yours in this Space right now. */
    mine: z.number().int(),
    /** Who's backing it (newest first, up to 30). */
    backers: z.array(z.object({ id: z.string(), username: z.string(), displayName: z.string() })),
    /** Real payments are set up; until then Sparks are free to try. */
    payments: z.boolean(),
    testing: z.boolean(),
  })
  .meta({ id: "SparkStatus" });
export type SparkStatus = z.infer<typeof SparkStatus>;

export const AutoModRules = z
  .object({
    /** Words or phrases that can't be posted (any case, as whole words). */
    words: z.array(z.string().trim().min(1).max(40)).max(200),
    blockLinks: z.boolean(),
    blockInvites: z.boolean(),
    /** Accounts younger than this many days can't post yet (0: off). */
    minAccountDays: z.number().int().min(0).max(90),
    /** New members wait this many minutes before posting (0: off). */
    minMemberMinutes: z.number().int().min(0).max(1440),
  })
  .meta({ id: "AutoModRules" });
export type AutoModRules = z.infer<typeof AutoModRules>;

export const DEFAULT_AUTOMOD: AutoModRules = {
  words: [],
  blockLinks: false,
  blockInvites: false,
  minAccountDays: 0,
  minMemberMinutes: 0,
};
