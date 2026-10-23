import { z } from "zod";
import { Snowflake } from "../ids";
import { Limits } from "../limits";
import { Channel } from "./channels";
import { IsoDateTime } from "./common";
import { Community, Member, Role } from "./communities";
import { Message } from "./messages";
import { Presence } from "./users";

/**
 * A Space as a member sees it: the Space, its rooms, its roles and your own membership. The same
 * shape arrives in the gateway's READY and COMMUNITY_CREATE. (Spaces are `communities` and rooms
 * are `channels` in the API; only the interface uses the friendlier words.)
 */
export const SpaceDetail = Community.extend({
  channels: z.array(Channel),
  roles: z.array(Role),
  self: Member,
}).meta({ id: "SpaceDetail" });
export type SpaceDetail = z.infer<typeof SpaceDetail>;

/**
 * Room names read like `#late-night`: lowercase letters, numbers and dashes, so they work in
 * links. Spaces between words become dashes.
 */
export const RoomName = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) =>
    s
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, ""),
  )
  .pipe(
    z
      .string()
      .min(Limits.roomName.min, "Give the room a name, using letters or numbers")
      .max(Limits.roomName.max, `At most ${Limits.roomName.max} characters`),
  );

/** Any words up to the room limit: rooms are made link-shaped by the server, groups keep theirs. */
const RoomOrGroupName = z.string().trim().min(1).max(100);

/** How long people wait between messages in a slow room (0 is off). */
export const SLOWMODE_CHOICES = [0, 5, 10, 30, 60, 300, 900, 3600] as const;

/**
 * Who can see a room: everyone, or only people with the chosen roles (the owner and admins always
 * can). Changing it needs Manage roles as well as Manage rooms.
 */
export const RoomPrivacy = z.object({
  private: z.boolean(),
  roleIds: z.array(Snowflake).max(50).default([]),
});
export type RoomPrivacy = z.infer<typeof RoomPrivacy>;

export const CreateRoomBody = z.object({
  name: RoomOrGroupName,
  /** Chat, voice, or a group (category) to put rooms in. Boards arrive with posts. */
  type: z.enum(["text", "voice", "board", "category"]).default("text"),
  topic: z.string().trim().max(Limits.channelTopic.max).optional(),
  /** The group it goes in. */
  parentId: Snowflake.optional(),
  privacy: RoomPrivacy.optional(),
});
export type CreateRoomBody = z.infer<typeof CreateRoomBody>;

export const UpdateRoomBody = z
  .object({
    name: RoomOrGroupName,
    topic: z.string().trim().max(Limits.channelTopic.max).nullable(),
    /** Its group, or null for none. */
    parentId: Snowflake.nullable(),
    slowmodeSeconds: z.literal(SLOWMODE_CHOICES),
    isNsfw: z.boolean(),
    privacy: RoomPrivacy,
  })
  .partial();
export type UpdateRoomBody = z.infer<typeof UpdateRoomBody>;

/** Every room and group you can see, top to bottom, each with the group it sits in. */
export const ReorderRoomsBody = z.object({
  items: z
    .array(z.object({ id: Snowflake, parentId: Snowflake.nullable() }))
    .min(1)
    .max(Limits.roomsPerSpace),
});
export type ReorderRoomsBody = z.infer<typeof ReorderRoomsBody>;

/** A Space's members, and who among them is around (only people who share their presence). */
export const MemberList = z
  .object({
    members: z.array(Member),
    presences: z.array(Presence),
  })
  .meta({ id: "MemberList" });
export type MemberList = z.infer<typeof MemberList>;

/** A page of a room's history, newest first. */
export const MessagePage = z
  .object({
    messages: z.array(Message),
  })
  .meta({ id: "MessagePage" });
export type MessagePage = z.infer<typeof MessagePage>;

/** A public Space in Explore, with what's needed to say why it's listed. */
export const DiscoverSpace = Community.pick({
  id: true,
  slug: true,
  name: true,
  description: true,
  accent: true,
  memberCount: true,
  createdAt: true,
  city: true,
})
  .extend({
    hereNow: z.number().int(),
    joined: z.boolean(),
    /** With the nearby sort: roughly how far, in kilometres. */
    distanceKm: z.number().nullable(),
  })
  .meta({ id: "DiscoverSpace" });
export type DiscoverSpace = z.infer<typeof DiscoverSpace>;

export const DiscoverQuery = z.object({
  sort: z.enum(["active", "new", "members", "nearby"]).default("active"),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  /** Nearby only: where to measure from (the browser's location or a city you picked). */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/** Joining a voice room: where LiveKit is, and a short-lived pass for this person. */
export const VoiceJoin = z
  .object({
    url: z.string(),
    token: z.string(),
    canSpeak: z.boolean(),
    canVideo: z.boolean(),
    expiresAt: IsoDateTime,
  })
  .meta({ id: "VoiceJoin" });
export type VoiceJoin = z.infer<typeof VoiceJoin>;

/** Who's in a voice room right now. */
export const VoiceState = z.object({ channelId: Snowflake, userId: Snowflake });
export type VoiceState = z.infer<typeof VoiceState>;

export const AckBody = z.object({ messageId: Snowflake });
