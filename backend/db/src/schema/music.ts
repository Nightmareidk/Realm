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
    /** Realm's own library: the admin who added the track (null for Jamendo and creators). */
    addedBy: id().references(() => users.id),
    /** Taken out of the library by an admin: it no longer shows in search or lists. */
    hiddenAt: tstz(),
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
    /** How long a photo Story shows (5 to 60 seconds); a video shows for its own length. */
    durationMs: integer(),
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

/** Songs someone liked (their Liked songs). */
export const soundLikes = pgTable(
  "sound_likes",
  {
    userId: id()
      .notNull()
      .references(() => users.id),
    soundId: id()
      .notNull()
      .references(() => sounds.id),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.soundId] }),
    index("sound_likes_user_idx").on(t.userId, t.createdAt.desc()),
  ],
);

/** Playlists people make: their own (or shared publicly), in the order they choose. */
export const playlists = pgTable(
  "playlists",
  {
    id: id().primaryKey(),
    ownerId: id()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    description: text(),
    isPublic: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: tstz().notNull().defaultNow(),
  },
  (t) => [index("playlists_owner_idx").on(t.ownerId, t.updatedAt.desc())],
);

export const playlistItems = pgTable(
  "playlist_items",
  {
    playlistId: id()
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    soundId: id()
      .notNull()
      .references(() => sounds.id),
    position: integer().notNull(),
    addedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.playlistId, t.soundId] }),
    index("playlist_items_order_idx").on(t.playlistId, t.position),
  ],
);

/** What someone last played, for Recently played (one row per song, the latest time). */
export const soundPlays = pgTable(
  "sound_plays",
  {
    userId: id()
      .notNull()
      .references(() => users.id),
    soundId: id()
      .notNull()
      .references(() => sounds.id),
    playedAt: tstz().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.soundId] }),
    index("sound_plays_recent_idx").on(t.userId, t.playedAt.desc()),
  ],
);

/**
 * Story highlights: Stories kept on a profile after their day is up, in named circles. Who can
 * watch them follows the account (public, or followers for a private account).
 */
export const storyHighlights = pgTable(
  "story_highlights",
  {
    id: id().primaryKey(),
    ownerId: id()
      .notNull()
      .references(() => users.id),
    title: text().notNull(),
    /** The Story whose picture is the circle's cover (the first one when empty). */
    coverStoryId: id(),
    position: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("story_highlights_owner_idx").on(t.ownerId, t.position)],
);

export const storyHighlightItems = pgTable(
  "story_highlight_items",
  {
    highlightId: id()
      .notNull()
      .references(() => storyHighlights.id, { onDelete: "cascade" }),
    storyId: id()
      .notNull()
      .references(() => stories.id),
    position: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.highlightId, t.storyId] }),
    index("story_highlight_items_story_idx").on(t.storyId),
  ],
);
