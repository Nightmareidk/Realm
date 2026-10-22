import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
} from "drizzle-orm/pg-core";
import { createdAt, id, tstz } from "./_columns";
import { channels, communities } from "./communities";
import { media } from "./media";
import { users } from "./users";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const postKind = pgEnum("post_kind", ["text", "image", "video", "link", "clip"]);
export const postVisibility = pgEnum("post_visibility", ["public", "followers", "community"]);

export const posts = pgTable(
  "posts",
  {
    id: id().primaryKey(),
    authorId: id()
      .notNull()
      .references(() => users.id),
    /** Null = profile post. */
    communityId: id().references(() => communities.id),
    /** The `board` channel it was posted in. */
    channelId: id().references(() => channels.id),
    kind: postKind().notNull(),
    title: text(),
    body: text(),
    linkUrl: text(),
    visibility: postVisibility().notNull().default("public"),
    isNsfw: boolean().notNull().default(false),
    isSpoiler: boolean().notNull().default(false),
    score: integer().notNull().default(0),
    commentCount: integer().notNull().default(0),
    saveCount: integer().notNull().default(0),
    shareCount: integer().notNull().default(0),
    hotRank: doublePrecision().notNull().default(0),
    search: tsvector().generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))`,
    ),
    /** Music on a post or Clip (music.ts), and the part that plays. */
    soundId: id(),
    soundStartMs: integer(),
    soundPlayMs: integer(),
    lockedAt: tstz(),
    removedAt: tstz(),
    removedBy: id(),
    removalReason: text(),
    createdAt: createdAt(),
    editedAt: tstz(),
    deletedAt: tstz(),
  },
  (t) => [
    index("posts_community_hot_idx").on(t.communityId, t.hotRank.desc()),
    index("posts_community_new_idx").on(t.communityId, t.id.desc()),
    index("posts_author_idx").on(t.authorId, t.id.desc()),
    index("posts_search_idx").using("gin", t.search),
  ],
);

export const postMedia = pgTable(
  "post_media",
  {
    postId: id()
      .notNull()
      .references(() => posts.id),
    position: smallint().notNull(),
    mediaId: id()
      .notNull()
      .references(() => media.id),
    altText: text(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.position] })],
);

export const comments = pgTable(
  "comments",
  {
    id: id().primaryKey(),
    postId: id()
      .notNull()
      .references(() => posts.id),
    authorId: id()
      .notNull()
      .references(() => users.id),
    parentId: id(),
    /** Materialized path of zero-padded IDs: one ordered range scan returns a thread. */
    path: text().notNull(),
    depth: smallint().notNull().default(0),
    body: text().notNull(),
    score: integer().notNull().default(0),
    replyCount: integer().notNull().default(0),
    createdAt: createdAt(),
    editedAt: tstz(),
    deletedAt: tstz(),
    removedAt: tstz(),
    removedBy: id(),
  },
  (t) => [
    index("comments_thread_idx").on(t.postId, t.path),
    index("comments_author_idx").on(t.authorId, t.id.desc()),
  ],
);

export const voteTarget = pgEnum("vote_target", ["post", "comment"]);

export const votes = pgTable(
  "votes",
  {
    userId: id()
      .notNull()
      .references(() => users.id),
    targetType: voteTarget().notNull(),
    targetId: id().notNull(),
    /** +1 or −1. */
    value: smallint().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);

export const saves = pgTable(
  "saves",
  {
    userId: id()
      .notNull()
      .references(() => users.id),
    postId: id()
      .notNull()
      .references(() => posts.id),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.postId] }),
    index("saves_user_idx").on(t.userId, t.createdAt.desc()),
  ],
);
