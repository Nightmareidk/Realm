import { z } from "zod";
import { Snowflake } from "../ids";
import { Limits } from "../limits";
import { IsoDateTime, MediaRef } from "./common";
import { Place } from "./media";
import { UserSummary } from "./users";

export const MessageType = z.enum([
  "default",
  "reply",
  "system_join",
  "system_pin",
  "system_channel_rename",
  "system_recipient_add",
  "system_recipient_remove",
]);
export type MessageType = z.infer<typeof MessageType>;

export const ReactionSummary = z.object({
  emoji: z.string(),
  count: z.number().int(),
  me: z.boolean(),
});

export const MessageReference = z.object({
  id: Snowflake,
  author: UserSummary,
  /** Truncated preview; null if the referenced message was deleted. */
  content: z.string().nullable(),
});

export const Message = z
  .object({
    id: Snowflake,
    channelId: Snowflake,
    author: UserSummary,
    type: MessageType,
    content: z.string(),
    attachments: z.array(MediaRef),
    reactions: z.array(ReactionSummary),
    replyTo: MessageReference.nullable(),
    mentions: z.array(Snowflake),
    mentionEveryone: z.boolean(),
    pinned: z.boolean(),
    /** A place the author chose to share. */
    place: Place.nullable(),
    /**
     * Hidden after several members reported it, until a moderator decides. Its text and files are
     * left out for everyone but the Space's moderators.
     */
    hidden: z.boolean(),
    editedAt: IsoDateTime.nullable(),
    createdAt: IsoDateTime,
    /** Echo of the client's nonce, for reconciling optimistic sends. */
    nonce: z.string().nullable(),
    /**
     * A photo to be seen once or twice (null: kept in the chat). Others get its photos without a
     * link; opening one asks for it and uses up a view.
     */
    viewLimit: z.number().int().nullable(),
    /** For others: views you have left. For its sender: null. */
    viewsLeft: z.number().int().nullable(),
    /** For its sender: someone has opened it. */
    opened: z.boolean(),
  })
  .meta({ id: "Message" });
export type Message = z.infer<typeof Message>;

export const CreateMessageBody = z
  .object({
    content: z.string().max(Limits.message.max).default(""),
    replyToId: Snowflake.optional(),
    attachmentIds: z.array(Snowflake).max(Limits.messageAttachments.max).default([]),
    place: Place.optional(),
    nonce: z.string().max(64).optional(),
    /** Photos only, in conversations: seen once (1) or twice (2), then gone for them. */
    viewLimit: z.union([z.literal(1), z.literal(2)]).optional(),
  })
  .refine((b) => b.content.trim().length > 0 || b.attachmentIds.length > 0 || b.place, {
    message: "A message needs text, a file or a place",
    path: ["content"],
  })
  .refine((b) => !b.viewLimit || b.attachmentIds.length > 0, {
    message: "Only photos can be sent to view once",
    path: ["viewLimit"],
  });
export type CreateMessageBody = z.infer<typeof CreateMessageBody>;

/**
 * How long after sending a message can still be edited, as in WhatsApp and Messenger: long enough
 * to fix a typo, short enough that a conversation can't be quietly rewritten later.
 */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Unsending, Instagram's way with a limit: a message nobody has seen yet can be unsent any time;
 * once someone has seen it, for 2 minutes. After that you can still delete it for yourself.
 */
export const MESSAGE_UNSEND_WINDOW_MS = 2 * 60 * 1000;

/** Opened photos show for this long before closing (view once and view twice). */
export const VIEW_ONCE_SECONDS = 10;

/** The link to a view-once photo, handed out when you open it. */
export const OpenedPhoto = z
  .object({ urls: z.array(z.string()), viewsLeft: z.number().int(), seconds: z.number().int() })
  .meta({ id: "OpenedPhoto" });
export type OpenedPhoto = z.infer<typeof OpenedPhoto>;

/** Whether a message sent at `createdAt` can still be edited. */
export function canStillEdit(createdAt: string | Date, now = Date.now()): boolean {
  return now - new Date(createdAt).getTime() <= MESSAGE_EDIT_WINDOW_MS;
}

export const UpdateMessageBody = z.object({
  content: z.string().trim().min(1).max(Limits.message.max),
});

export const MessagesQuery = z.object({
  before: Snowflake.optional(),
  after: Snowflake.optional(),
  around: Snowflake.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
