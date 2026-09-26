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

export const PublicUser = z
  .object({
    id: Snowflake,
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.url().nullable(),
    bannerUrl: z.url().nullable(),
    accentColor: z.number().int().nullable(),
    bio: z.string().nullable(),
    pronouns: z.string().nullable(),
    createdAt: IsoDateTime,
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
}).meta({ id: "UserSummary" });
export type UserSummary = z.infer<typeof UserSummary>;

export const SelfUser = PublicUser.extend({
  email: z.email(),
  emailVerified: z.boolean(),
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

export const UserSettings = z
  .object({
    theme: z.enum(["system", "dark", "light"]),
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
  reducedMotion: "system",
  locale: "en",
  profileVisibility: "public",
  dmPolicy: "friends_and_communities",
  friendRequestPolicy: "everyone",
  showPresence: true,
  showReadReceipts: true,
};

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
