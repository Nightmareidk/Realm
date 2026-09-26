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

export const OpenDmBody = z.object({
  recipientIds: z.array(Snowflake).min(1).max(Limits.groupDmRecipients.max),
});

export const ReadState = z
  .object({
    channelId: Snowflake,
    lastReadMessageId: Snowflake.nullable(),
    mentionCount: z.number().int(),
  })
  .meta({ id: "ReadState" });
export type ReadState = z.infer<typeof ReadState>;
