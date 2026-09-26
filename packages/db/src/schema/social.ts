import { index, pgEnum, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { createdAt, id, tstz } from "./_columns";
import { users } from "./users";

export const relationshipType = pgEnum("relationship_type", [
  "friend",
  "pending_outgoing",
  "pending_incoming",
  "blocked",
]);

/** Directional rows: a friendship is two `friend` rows; a request is outgoing + incoming. */
export const relationships = pgTable(
  "relationships",
  {
    userId: id()
      .notNull()
      .references(() => users.id),
    targetId: id()
      .notNull()
      .references(() => users.id),
    type: relationshipType().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetId] }),
    index("relationships_target_idx").on(t.targetId),
  ],
);

export const followStatus = pgEnum("follow_status", ["active", "pending"]);

/** Asymmetric content subscriptions (separate from friendships). */
export const follows = pgTable(
  "follows",
  {
    followerId: id()
      .notNull()
      .references(() => users.id),
    followeeId: id()
      .notNull()
      .references(() => users.id),
    status: followStatus().notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index("follows_followee_idx").on(t.followeeId, t.createdAt.desc()),
  ],
);

export const muteTarget = pgEnum("mute_target", ["user", "community", "channel"]);

export const mutes = pgTable(
  "mutes",
  {
    userId: id()
      .notNull()
      .references(() => users.id),
    targetType: muteTarget().notNull(),
    targetId: id().notNull(),
    until: tstz(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);
