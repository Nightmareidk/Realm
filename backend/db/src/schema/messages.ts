import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
} from "drizzle-orm/pg-core";
import { createdAt, id, tstz } from "./_columns";
import { channels } from "./communities";
import { media } from "./media";
import { users } from "./users";

export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

export type MessageEmbed = {
  type: "place";
  name: string;
  address: string | null;
  lat: number;
  lng: number;
};

export const messageType = pgEnum("message_type", [
  "default",
  "reply",
  "system_join",
  "system_pin",
  "system_channel_rename",
  "system_recipient_add",
  "system_recipient_remove",
]);

export const messages = pgTable(
  "messages",
  {
    id: id().primaryKey(),
    channelId: id()
      .notNull()
      .references(() => channels.id),
    authorId: id()
      .notNull()
      .references(() => users.id),
    type: messageType().notNull().default("default"),
    /** Null for E2EE (`mls`) channels and for deleted tombstones. */
    content: text(),
    /** Phase 2: MLS ciphertext for E2EE channels. */
    ciphertext: bytea(),
    replyToId: id(),
    mentions: bigint({ mode: "bigint" }).array().notNull().default([]),
    mentionRoles: bigint({ mode: "bigint" }).array().notNull().default([]),
    mentionEveryone: boolean().notNull().default(false),
    nonce: text(),
    /** A place someone chose to share (never live location). */
    embed: jsonb().$type<MessageEmbed>(),
    /** Bit 0: hidden after enough members reported it, until a moderator looks. */
    flags: integer().notNull().default(0),
    /** A photo sent to be seen once or twice (then it's gone for them); null keeps it. */
    viewLimit: smallint(),
    editedAt: tstz(),
    deletedAt: tstz(),
    pinnedAt: tstz(),
    pinnedBy: id(),
    createdAt: createdAt(),
  },
  (t) => [
    // The hot path: a channel's history, newest first.
    index("messages_channel_idx").on(t.channelId, t.id.desc()),
    index("messages_author_idx").on(t.authorId, t.id.desc()),
  ],
);

export const messageAttachments = pgTable(
  "message_attachments",
  {
    messageId: id()
      .notNull()
      .references(() => messages.id),
    position: smallint().notNull(),
    mediaId: id()
      .notNull()
      .references(() => media.id),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.position] })],
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    messageId: id()
      .notNull()
      .references(() => messages.id),
    /** Unicode emoji grapheme, or `custom:<id>` for community emoji (later). */
    emoji: text().notNull(),
    userId: id()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.emoji, t.userId] })],
);

export const readStates = pgTable(
  "read_states",
  {
    userId: id()
      .notNull()
      .references(() => users.id),
    channelId: id()
      .notNull()
      .references(() => channels.id),
    lastReadMessageId: id(),
    mentionCount: integer().notNull().default(0),
    updatedAt: tstz().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channelId] })],
);

/** How many times each person has opened a view-once (or view-twice) photo. */
export const messageViews = pgTable(
  "message_views",
  {
    messageId: bigint({ mode: "bigint" })
      .notNull()
      .references(() => messages.id),
    userId: bigint({ mode: "bigint" }).notNull(),
    count: smallint().notNull().default(0),
    lastAt: tstz().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId] })],
);

/** "Delete for you": a message one person no longer wants to see; others still do. */
export const messageHides = pgTable(
  "message_hides",
  {
    userId: bigint({ mode: "bigint" }).notNull(),
    messageId: bigint({ mode: "bigint" })
      .notNull()
      .references(() => messages.id),
    channelId: bigint({ mode: "bigint" }).notNull(),
    createdAt: tstz().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.messageId] }),
    index("message_hides_channel_idx").on(t.userId, t.channelId),
  ],
);
