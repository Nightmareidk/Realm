import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  inet,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createdAt, id, tstz, updatedAt } from "./_columns";

export const userStatus = pgEnum("user_status", ["active", "suspended", "deactivated", "deleted"]);

export const platform = pgEnum("platform", ["web", "ios", "android", "windows", "macos", "linux"]);

/** A personal account, or a business one (always public, with a category and a link). */
export const accountKind = pgEnum("account_kind", ["personal", "business"]);

/** A checked account: a notable person, a business or brand, or Realm itself. */
export const verifiedKind = pgEnum("verified_kind", ["notable", "business", "official"]);

/** Realm's own staff: moderators handle reports; admins also manage accounts and staff. */
export const staffRole = pgEnum("staff_role", ["moderator", "admin"]);

export const users = pgTable(
  "users",
  {
    id: id().primaryKey(),
    /** Stored lowercase (normalized by contracts); unique case-insensitively. */
    username: text().notNull(),
    displayName: text().notNull(),
    /** Stored lowercase; never exposed to other users. */
    email: text().notNull(),
    emailVerifiedAt: tstz(),
    passwordHash: text().notNull(),
    birthDate: date({ mode: "string" }).notNull(),
    avatarMediaId: id(),
    bannerMediaId: id(),
    bio: text(),
    pronouns: text(),
    accentColor: integer(),
    accountKind: accountKind().notNull().default("personal"),
    /** Business accounts: what they are ("Esports team") and where to find them. */
    category: text(),
    websiteUrl: text(),
    /** Verified by Realm (the badge), and when. */
    verified: verifiedKind(),
    verifiedAt: tstz(),
    staffRole: staffRole(),
    flags: id().notNull().default(sql`0`),
    status: userStatus().notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tstz(),
  },
  (t) => [
    uniqueIndex("users_username_key").on(sql`lower(${t.username})`),
    uniqueIndex("users_email_key").on(sql`lower(${t.email})`),
  ],
);

export const themePref = pgEnum("theme_pref", ["system", "dark", "light"]);
export const motionPref = pgEnum("motion_pref", ["system", "on", "off"]);
export const profileVisibility = pgEnum("profile_visibility", ["public", "private"]);
export const dmPolicy = pgEnum("dm_policy", [
  "everyone",
  "friends_and_communities",
  "friends",
  "nobody",
]);
export const friendRequestPolicy = pgEnum("friend_request_policy", [
  "everyone",
  "friends_of_friends",
  "nobody",
]);

/** The person's theme (DESIGN.md): the action colour and the light behind every screen. */
export const themeAccent = pgEnum("theme_accent", ["mint", "orchid", "aqua", "ember"]);

/** Realm's own looks (themes.ts holds the same list as `theme_look`). */
export const themeLookPref = pgEnum("theme_look_pref", ["now-playing", "wristband", "plain"]);

export const userSettings = pgTable("user_settings", {
  userId: id()
    .primaryKey()
    .references(() => users.id),
  theme: themePref().notNull().default("system"),
  accent: themeAccent().notNull().default("mint"),
  /** Which of Realm's looks they use (Now Playing unless they pick another). */
  look: themeLookPref().notNull().default("now-playing"),
  /** A theme from their library in place of a look; null for Realm's own looks. */
  themeId: id(),
  reducedMotion: motionPref().notNull().default("system"),
  locale: text().notNull().default("en"),
  profileVisibility: profileVisibility().notNull().default("public"),
  dmPolicy: dmPolicy().notNull().default("friends_and_communities"),
  friendRequestPolicy: friendRequestPolicy().notNull().default("everyone"),
  showPresence: boolean().notNull().default(true),
  showReadReceipts: boolean().notNull().default(true),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** Public identifier (safe to show in URLs / device lists). */
    id: id().primaryKey(),
    /** SHA-256 of the secret token. The token itself is never stored. */
    tokenHash: text().notNull(),
    userId: id()
      .notNull()
      .references(() => users.id),
    platform: platform().notNull(),
    deviceName: text().notNull(),
    ipCreated: inet(),
    country: text(),
    userAgent: text(),
    /** Phase 2: E2EE device bound to this session. */
    deviceId: id(),
    createdAt: createdAt(),
    lastActiveAt: tstz().notNull().defaultNow(),
    expiresAt: tstz().notNull(),
    revokedAt: tstz(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_key").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: id().primaryKey(),
    userId: id()
      .notNull()
      .references(() => users.id),
    email: text().notNull(),
    codeHash: text().notNull(),
    tokenHash: text().notNull(),
    attempts: smallint().notNull().default(0),
    expiresAt: tstz().notNull(),
    consumedAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [
    index("email_verifications_user_idx").on(t.userId),
    uniqueIndex("email_verifications_token_key").on(t.tokenHash),
  ],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    tokenHash: text().primaryKey(),
    userId: id()
      .notNull()
      .references(() => users.id),
    expiresAt: tstz().notNull(),
    usedAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

export const securityEventType = pgEnum("security_event_type", [
  "register",
  "login",
  "login_failed",
  "logout",
  "password_changed",
  "password_reset_requested",
  "password_reset",
  "email_verified",
  "email_changed",
  "session_revoked",
]);

export const securityEvents = pgTable(
  "security_events",
  {
    id: id().primaryKey(),
    userId: id()
      .notNull()
      .references(() => users.id),
    type: securityEventType().notNull(),
    sessionId: id(),
    ip: inet(),
    createdAt: createdAt(),
  },
  (t) => [index("security_events_user_idx").on(t.userId, t.id.desc())],
);
