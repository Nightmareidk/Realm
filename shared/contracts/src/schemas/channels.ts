import { z } from "zod";
import { Snowflake } from "../ids";
import { Limits } from "../limits";
import { IsoDateTime } from "./common";
import { PermissionBits } from "./communities";
import { UserSummary } from "./users";

export const ChannelType = z.enum([
  "text",
  "board",
  "announcement",
  "category",
  "voice",
  "dm",
  "group_dm",
]);
export type ChannelType = z.infer<typeof ChannelType>;

export const Encryption = z.enum(["none", "mls"]);
export type Encryption = z.infer<typeof Encryption>;

export const PermissionOverwrite = z
  .object({
    targetType: z.enum(["role", "member"]),
    targetId: Snowflake,
    allow: PermissionBits,
    deny: PermissionBits,
  })
  .meta({ id: "PermissionOverwrite" });
export type PermissionOverwrite = z.infer<typeof PermissionOverwrite>;

export const Channel = z
  .object({
    id: Snowflake,
    type: ChannelType,
    communityId: Snowflake.nullable(),
    parentId: Snowflake.nullable(),
    name: z.string().nullable(),
    topic: z.string().nullable(),
    position: z.number().int(),
    isNsfw: z.boolean(),
    slowmodeSeconds: z.number().int(),
    lastMessageId: Snowflake.nullable(),
    overwrites: z.array(PermissionOverwrite),
    /** DMs and group DMs only. */
    recipients: z.array(UserSummary).optional(),
    ownerId: Snowflake.nullable(),
    iconUrl: z.url().nullable(),
    /** `none` = readable by Realm's servers. `mls` = end-to-end encrypted (Phase 2). */
    encryption: Encryption,
    createdAt: IsoDateTime,
  })
  .meta({ id: "Channel" });
export type Channel = z.infer<typeof Channel>;

export const ChannelName = z
  .string()
  .trim()
  .min(Limits.channelName.min)
  .max(Limits.channelName.max);

export const CreateChannelBody = z.object({
  type: z.enum(["text", "board", "announcement", "category"]),
  name: ChannelName,
  topic: z.string().trim().max(Limits.channelTopic.max).optional(),
  parentId: Snowflake.nullable().optional(),
  isNsfw: z.boolean().optional(),
});
export type CreateChannelBody = z.infer<typeof CreateChannelBody>;

export const UpdateChannelBody = z
  .object({
    name: ChannelName,
    topic: z.string().trim().max(Limits.channelTopic.max).nullable(),
    parentId: Snowflake.nullable(),
    isNsfw: z.boolean(),
    slowmodeSeconds: z.number().int().min(0).max(21_600),
  })
  .partial();

/** Start a conversation: one person is a DM (reused if you already have one); more is a group. */
export const OpenDmBody = z.object({
  recipientIds: z
    .array(Snowflake)
    .min(1)
    .max(Limits.groupDmRecipients.max - 1),
  /** A group's name (optional; unnamed groups read as their members). */
  name: z.string().trim().min(1).max(100).optional(),
});
export type OpenDmBody = z.infer<typeof OpenDmBody>;

/** Rename a group (null clears it), or pin or unpin a conversation in your own list. */
export const UpdateConversationBody = z
  .object({
    name: z.string().trim().min(1).max(100).nullable(),
    pinned: z.boolean(),
  })
  .partial();
export type UpdateConversationBody = z.infer<typeof UpdateConversationBody>;

/** The last thing said in a conversation, for the inbox. */
export const MessagePreview = z
  .object({
    id: Snowflake,
    authorId: Snowflake,
    type: z.string(),
    /** The first 140 characters; empty when it's only files or a place. */
    content: z.string(),
    attachments: z.number().int(),
    /** What the first file is, for "Photo", "Voice message" and so on. */
    attachmentKind: z.enum(["image", "video", "audio", "file"]).nullable(),
    place: z.boolean(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "MessagePreview" });
export type MessagePreview = z.infer<typeof MessagePreview>;

/**
 * A DM or group chat as one of its members sees it: the others in it, the last message, whether
 * you pinned it, and how far the others have read (only between people who both share read
 * receipts).
 */
export const Conversation = Channel.extend({
  recipients: z.array(UserSummary),
  lastMessage: MessagePreview.nullable(),
  pinned: z.boolean(),
  seen: z.array(z.object({ userId: Snowflake, messageId: Snowflake })),
  /** A message request to you: it sits in Requests until you accept it or reply. */
  request: z.boolean(),
  /** You started it and they haven't accepted yet (a DM only). */
  awaiting: z.boolean(),
  /** Messages from others you haven't read yet (counted up to 99). */
  unread: z.number().int(),
}).meta({ id: "Conversation" });
export type Conversation = z.infer<typeof Conversation>;

export const ReadState = z
  .object({
    channelId: Snowflake,
    lastReadMessageId: Snowflake.nullable(),
    mentionCount: z.number().int(),
  })
  .meta({ id: "ReadState" });
export type ReadState = z.infer<typeof ReadState>;
