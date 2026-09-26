import { z } from "zod";
import { Snowflake } from "../ids";
import { Limits } from "../limits";
import { IsoDateTime, MediaRef } from "./common";
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
    editedAt: IsoDateTime.nullable(),
    createdAt: IsoDateTime,
    /** Echo of the client's nonce, for reconciling optimistic sends. */
    nonce: z.string().nullable(),
  })
  .meta({ id: "Message" });
export type Message = z.infer<typeof Message>;

export const CreateMessageBody = z
  .object({
    content: z.string().max(Limits.message.max).default(""),
    replyToId: Snowflake.optional(),
    attachmentIds: z.array(Snowflake).max(Limits.messageAttachments.max).default([]),
    nonce: z.string().max(64).optional(),
  })
  .refine((b) => b.content.trim().length > 0 || b.attachmentIds.length > 0, {
    message: "A message needs text or an attachment",
    path: ["content"],
  });
export type CreateMessageBody = z.infer<typeof CreateMessageBody>;

export const UpdateMessageBody = z.object({
  content: z.string().trim().min(1).max(Limits.message.max),
});

export const MessagesQuery = z.object({
  before: Snowflake.optional(),
  after: Snowflake.optional(),
  around: Snowflake.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
