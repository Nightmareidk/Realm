import { z } from "zod";
import { Snowflake } from "../ids";
import { Limits } from "../limits";
import { IsoDateTime } from "./common";

/**
 * Usernames: 3–32 chars of a–z, 0–9, `_` and `.`; no leading, trailing, or doubled dots.
 * Case-insensitive — normalized to lowercase before validation.
 */
export const USERNAME_PATTERN = /^(?!.*\.\.)(?!\.)[a-z0-9._]+(?<!\.)$/;

export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .min(Limits.username.min, `At least ${Limits.username.min} characters`)
  .max(Limits.username.max, `At most ${Limits.username.max} characters`)
  .regex(USERNAME_PATTERN, "Letters, numbers, underscores and single dots only");

export const DisplayName = z
  .string()
  .trim()
  .min(Limits.displayName.min)
  .max(Limits.displayName.max);

/** A checked account: a notable person, a business or brand, or Realm itself (the badge). */
export const VerifiedKind = z.enum(["notable", "business", "official"]);
export type VerifiedKind = z.infer<typeof VerifiedKind>;

/** Realm's staff: moderators handle reports; admins also manage accounts and staff. */
export const StaffRole = z.enum(["moderator", "admin"]);
export type StaffRole = z.infer<typeof StaffRole>;

export const PublicUser = z
  .object({
    id: Snowflake,
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    bannerUrl: z.string().nullable(),
    accentColor: z.number().int().nullable(),
    bio: z.string().nullable(),
    pronouns: z.string().nullable(),
    createdAt: IsoDateTime,
    /** Verified by Realm; left out for everyone else. */
    verified: VerifiedKind.optional(),
  })
  .meta({ id: "PublicUser" });
export type PublicUser = z.infer<typeof PublicUser>;

/** Compact user shape embedded in messages, posts, member lists. */
export const UserSummary = PublicUser.pick({
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  accentColor: true,
  verified: true,
}).meta({ id: "UserSummary" });
export type UserSummary = z.infer<typeof UserSummary>;

export const SelfUser = PublicUser.extend({
  email: z.email(),
  emailVerified: z.boolean(),
  /** Under 18: the interface hides what the server won't allow (nearby Spaces, for one). */
  teen: z.boolean(),
  /** Realm staff only: what they may do in the admin pages. */
  staff: StaffRole.optional(),
}).meta({ id: "SelfUser" });
export type SelfUser = z.infer<typeof SelfUser>;

export const UpdateSelf = z
  .object({
    displayName: DisplayName,
    username: Username,
    bio: z.string().trim().max(Limits.bio.max).nullable(),
    pronouns: z.string().trim().max(Limits.pronouns.max).nullable(),
    accentColor: z.number().int().min(0).max(0xffffff).nullable(),
    avatarMediaId: Snowflake.nullable(),
    bannerMediaId: Snowflake.nullable(),
  })
  .partial();
export type UpdateSelf = z.infer<typeof UpdateSelf>;

/** The person's theme: the action colour and the light behind every screen (DESIGN.md). */
export const ThemeAccent = z.enum(["mint", "orchid", "aqua", "ember"]);
export type ThemeAccent = z.infer<typeof ThemeAccent>;

export const UserSettings = z
  .object({
    theme: z.enum(["system", "dark", "light"]),
    accent: ThemeAccent,
    reducedMotion: z.enum(["system", "on", "off"]),
    locale: z.string().max(35),
    profileVisibility: z.enum(["public", "private"]),
    dmPolicy: z.enum(["everyone", "friends_and_communities", "friends", "nobody"]),
    friendRequestPolicy: z.enum(["everyone", "friends_of_friends", "nobody"]),
    showPresence: z.boolean(),
    showReadReceipts: z.boolean(),
  })
  .meta({ id: "UserSettings" });
export type UserSettings = z.infer<typeof UserSettings>;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: "system",
  accent: "mint",
  reducedMotion: "system",
  locale: "en",
  profileVisibility: "public",
  dmPolicy: "friends_and_communities",
  friendRequestPolicy: "everyone",
  showPresence: true,
  showReadReceipts: true,
};

/**
 * Where an account under 18 starts (docs/research/2026-10-phase1-spaces-feed-safety.md §3.4,
 * after Discord's teen defaults and the EU DSA Art. 28 guidelines): a private profile, direct
 * messages from friends only, and friend requests only from friends of friends.
 */
export const TEEN_USER_SETTINGS = {
  profileVisibility: "private",
  dmPolicy: "friends",
  friendRequestPolicy: "friends_of_friends",
} as const satisfies Partial<UserSettings>;

export const UpdateUserSettings = UserSettings.partial();

export const RelationshipType = z.enum([
  "friend",
  "pending_outgoing",
  "pending_incoming",
  "blocked",
]);
export type RelationshipType = z.infer<typeof RelationshipType>;

export const Relationship = z
  .object({
    user: UserSummary,
    type: RelationshipType,
    since: IsoDateTime,
  })
  .meta({ id: "Relationship" });
export type Relationship = z.infer<typeof Relationship>;

export const PresenceStatus = z.enum(["online", "idle", "dnd", "offline"]);
export type PresenceStatus = z.infer<typeof PresenceStatus>;

export const Presence = z
  .object({
    userId: Snowflake,
    status: PresenceStatus,
    activity: z
      .object({ kind: z.enum(["playing", "listening", "watching", "custom"]), name: z.string() })
      .nullable(),
  })
  .meta({ id: "Presence" });
export type Presence = z.infer<typeof Presence>;
