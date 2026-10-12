import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { createdAt, id, tstz } from "./_columns";
import { users } from "./users";

export const notificationType = pgEnum("notification_type", [
  "mention",
  "reply",
  "post_comment",
  "comment_reply",
  "vote_milestone",
  "follow",
  "follow_request",
  "friend_request",
  "friend_accept",
  "community_invite",
  "moderation",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: id().primaryKey(),
    userId: id()
      .notNull()
      .references(() => users.id),
    type: notificationType().notNull(),
    actorId: id(),
    subjectType: text().notNull(),
    subjectId: id().notNull(),
    /** Collapses bursts ("12 people liked your post"). */
    groupKey: text(),
    data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    readAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.id.desc())],
);

export const pushPlatform = pgEnum("push_platform", ["web", "ios", "android"]);

/** Devices that asked for push notifications (Firebase Cloud Messaging registration tokens). */
export const pushTokens = pgTable(
  "push_tokens",
  {
    token: text().primaryKey(),
    userId: id()
      .notNull()
      .references(() => users.id),
    platform: pushPlatform().notNull().default("web"),
    createdAt: createdAt(),
    lastSeenAt: tstz().notNull().defaultNow(),
  },
  (t) => [index("push_tokens_user_idx").on(t.userId)],
);

export const notificationScope = pgEnum("notification_scope", ["global", "community", "channel"]);
export const notificationLevel = pgEnum("notification_level", ["all", "mentions", "none"]);

export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    userId: id()
      .notNull()
      .references(() => users.id),
    scopeType: notificationScope().notNull(),
    /** 0 for the global scope. */
    scopeId: id().notNull().default(sql`0`),
    level: notificationLevel().notNull().default("all"),
    mutedUntil: tstz(),
    toggles: jsonb().$type<Record<string, boolean>>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.userId, t.scopeType, t.scopeId] })],
);
