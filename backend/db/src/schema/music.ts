import { index, integer, pgEnum, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, id, tstz } from "./_columns";
import { media } from "./media";
import { users } from "./users";

/**
 * Music: sounds (free library tracks and creators' own) and Stories. Posts and Clips point at a
 * sound with the part that plays (content.ts).
 */

export const soundKind = pgEnum("sound_kind", ["library", "original"]);

export const sounds = pgTable(
  "sounds",
  {
    id: id().primaryKey(),
    kind: soundKind().notNull(),
    title: text().notNull(),
    artist: text().notNull(),
    /** Original sounds: who made it and the upload it plays. */
    creatorId: id().references(() => users.id),
    mediaId: id().references(() => media.id),
    /** Library tracks: where they came from ("openverse:<id>"), and where they stream from. */
    externalId: text(),
    audioUrl: text(),
    coverUrl: text(),
    durationMs: integer().notNull(),
    licence: text(),
    sourceUrl: text(),
    uses: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sounds_external_key").on(t.externalId),
    index("sounds_uses_idx").on(t.uses.desc()),
    index("sounds_creator_idx").on(t.creatorId),
  ],
);

export const storyVisibility = pgEnum("story_visibility", ["public", "followers"]);

export const stories = pgTable(
  "stories",
  {
    id: id().primaryKey(),
    authorId: id()
      .notNull()
      .references(() => users.id),
    mediaId: id()
      .notNull()
      .references(() => media.id),
    caption: text(),
    soundId: id().references(() => sounds.id),
    soundStartMs: integer(),
    soundPlayMs: integer(),
    visibility: storyVisibility().notNull().default("public"),
    createdAt: createdAt(),
    expiresAt: tstz().notNull(),
    deletedAt: tstz(),
  },
  (t) => [index("stories_author_idx").on(t.authorId, t.expiresAt.desc())],
);

export const storyViews = pgTable(
  "story_views",
  {
    storyId: id()
      .notNull()
      .references(() => stories.id),
    viewerId: id()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.viewerId] })],
);
