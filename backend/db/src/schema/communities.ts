import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createdAt, id, tstz, updatedAt } from "./_columns";
import { themeAccent, users } from "./users";

export const communityVisibility = pgEnum("community_visibility", ["public", "private"]);
export const joinPolicy = pgEnum("join_policy", ["open", "request", "invite"]);

export const communities = pgTable(
  "communities",
  {
    /** Also the ID of this community's `@everyone` role. */
    id: id().primaryKey(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    iconMediaId: id(),
    bannerMediaId: id(),
    ownerId: id()
      .notNull()
      .references(() => users.id),
    /** The Space's colour, one of the four themes. */
    accent: themeAccent().notNull().default("mint"),
    visibility: communityVisibility().notNull().default("private"),
    joinPolicy: joinPolicy().notNull().default("invite"),
    isNsfw: boolean().notNull().default(false),
    memberCount: integer().notNull().default(0),
    rules: jsonb().$type<{ title: string; body: string }[]>().notNull().default([]),
    /** The city a Space says it's in (public Spaces can be found nearby). Rounded to ~1 km. */
    city: text(),
    lat: doublePrecision(),
    lng: doublePrecision(),
    features: id().notNull().default(sql`0`),
    /**
     * AutoMod: words that can't be posted, links and invites blocked, and how new an account
     * (or a member) has to wait before talking. Mods are never held back by it.
     */
    automod: jsonb()
      .$type<{
        words?: string[];
        blockLinks?: boolean;
        blockInvites?: boolean;
        minAccountDays?: number;
        minMemberMinutes?: number;
      }>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tstz(),
  },
  (t) => [
    uniqueIndex("communities_slug_key").on(sql`lower(${t.slug})`),
    index("communities_discover_idx")
      .on(t.memberCount.desc())
      .where(sql`${t.visibility} = 'public' and ${t.deletedAt} is null`),
  ],
);

export const communityMembers = pgTable(
  "community_members",
  {
    communityId: id()
      .notNull()
      .references(() => communities.id),
    userId: id()
      .notNull()
      .references(() => users.id),
    nickname: text(),
    joinedAt: tstz().notNull().defaultNow(),
    timeoutUntil: tstz(),
    flags: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.userId] }),
    index("community_members_user_idx").on(t.userId),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: id().primaryKey(),
    communityId: id()
      .notNull()
      .references(() => communities.id),
    name: text().notNull(),
    color: integer(),
    position: integer().notNull().default(0),
    permissions: id().notNull().default(sql`0`),
    hoist: boolean().notNull().default(false),
    mentionable: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("roles_community_idx").on(t.communityId)],
);

export const memberRoles = pgTable(
  "member_roles",
  {
    communityId: id().notNull(),
    userId: id().notNull(),
    roleId: id()
      .notNull()
      .references(() => roles.id),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.userId, t.roleId] }),
    index("member_roles_role_idx").on(t.roleId),
  ],
);

export const channelType = pgEnum("channel_type", [
  "text",
  "board",
  "announcement",
  "category",
  "voice",
  "dm",
  "group_dm",
]);

export const encryption = pgEnum("encryption", ["none", "mls"]);

/** Community channels AND direct-message channels. */
export const channels = pgTable(
  "channels",
  {
    id: id().primaryKey(),
    type: channelType().notNull(),
    communityId: id().references(() => communities.id),
    parentId: id(),
    name: text(),
    topic: text(),
    position: integer().notNull().default(0),
    isNsfw: boolean().notNull().default(false),
    slowmodeSeconds: integer().notNull().default(0),
    ownerId: id(),
    iconMediaId: id(),
    encryption: encryption().notNull().default("none"),
    lastMessageId: id(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tstz(),
  },
  (t) => [index("channels_community_idx").on(t.communityId, t.position)],
);

export const overwriteTarget = pgEnum("overwrite_target", ["role", "member"]);

export const channelOverwrites = pgTable(
  "channel_overwrites",
  {
    channelId: id()
      .notNull()
      .references(() => channels.id),
    targetType: overwriteTarget().notNull(),
    targetId: id().notNull(),
    allow: id().notNull().default(sql`0`),
    deny: id().notNull().default(sql`0`),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.targetType, t.targetId] })],
);

/** Membership of DM and group-DM channels. */
export const channelRecipients = pgTable(
  "channel_recipients",
  {
    channelId: id()
      .notNull()
      .references(() => channels.id),
    userId: id()
      .notNull()
      .references(() => users.id),
    joinedAt: tstz().notNull().defaultNow(),
    /** Hidden from the user's DM list until a new message arrives. */
    closedAt: tstz(),
    /** Pinned to the top of the user's DM list. */
    pinnedAt: tstz(),
    /**
     * A message request: someone this person doesn't know started the DM. It waits in their
     * Requests (no notifications, no "seen") until they accept it or reply.
     */
    requestedAt: tstz(),
  },
  (t) => [
    primaryKey({ columns: [t.channelId, t.userId] }),
    index("channel_recipients_user_idx").on(t.userId),
  ],
);

export const invites = pgTable(
  "invites",
  {
    code: text().primaryKey(),
    communityId: id()
      .notNull()
      .references(() => communities.id),
    channelId: id().references(() => channels.id),
    inviterId: id().references(() => users.id),
    maxUses: integer(),
    uses: integer().notNull().default(0),
    expiresAt: tstz(),
    revokedAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [index("invites_community_idx").on(t.communityId)],
);

export const bans = pgTable(
  "bans",
  {
    communityId: id()
      .notNull()
      .references(() => communities.id),
    userId: id()
      .notNull()
      .references(() => users.id),
    moderatorId: id().references(() => users.id),
    reason: text(),
    expiresAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] })],
);

/** Where a Spark came from: paid for, given as a gift, or (before payments) a free test one. */
export const sparkSource = pgEnum("spark_source", ["paid", "gift", "test"]);

/**
 * Sparks: members back a Space they love, and enough Sparks light it up to a higher Glow level
 * with perks for everyone in it (Realm's own take on boosting). Each lasts until `endsAt`.
 */
export const spaceSparks = pgTable(
  "space_sparks",
  {
    id: id().primaryKey(),
    communityId: id()
      .notNull()
      .references(() => communities.id),
    userId: id()
      .notNull()
      .references(() => users.id),
    source: sparkSource().notNull(),
    startedAt: createdAt(),
    endsAt: tstz().notNull(),
  },
  (t) => [
    index("space_sparks_space_idx").on(t.communityId, t.endsAt),
    index("space_sparks_user_idx").on(t.userId),
  ],
);
