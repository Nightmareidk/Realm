import { z } from "zod";
import { Snowflake } from "./ids";
import { Channel, ReadState } from "./schemas/channels";
import { Community, Member, Role } from "./schemas/communities";
import { Message } from "./schemas/messages";
import { Presence, PresenceStatus, Relationship, SelfUser, UserSettings } from "./schemas/users";

export const GATEWAY_VERSION = 1;

export const Op = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  PRESENCE_UPDATE: 3,
  SUBSCRIBE: 4,
  UNSUBSCRIBE: 5,
  RESUME: 6,
  RECONNECT: 7,
  TYPING: 8,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
} as const;
export type Op = (typeof Op)[keyof typeof Op];

/** WebSocket close codes the gateway uses (4000–4999 are application-defined). */
export const GatewayClose = {
  UNKNOWN_ERROR: 4000,
  UNKNOWN_OPCODE: 4001,
  DECODE_ERROR: 4002,
  NOT_AUTHENTICATED: 4003,
  AUTHENTICATION_FAILED: 4004,
  ALREADY_AUTHENTICATED: 4005,
  INVALID_SEQ: 4007,
  RATE_LIMITED: 4008,
  SESSION_TIMED_OUT: 4009,
  INVALID_VERSION: 4012,
} as const;

// ── Client → server payloads ────────────────────────────────────────────────

export const IdentifyPayload = z.object({
  /** Native clients: their session token. */
  token: z.string().optional(),
  /** Web clients: a single-use ticket from `POST /v1/gateway/tickets`. */
  ticket: z.string().optional(),
  client: z.object({ platform: z.string().max(16), version: z.string().max(32) }),
  presence: z.object({ status: PresenceStatus }).optional(),
});

export const ResumePayload = z.object({ sessionId: z.string(), seq: z.number().int() });

export const SubscribePayload = z.object({
  communityId: Snowflake,
  typing: z.boolean().default(true),
  presence: z.boolean().default(true),
});

export const TypingPayload = z.object({ channelId: Snowflake });

export const ClientFrame = z.discriminatedUnion("op", [
  z.object({ op: z.literal(Op.HEARTBEAT), d: z.number().int().nullable() }),
  z.object({ op: z.literal(Op.IDENTIFY), d: IdentifyPayload }),
  z.object({ op: z.literal(Op.RESUME), d: ResumePayload }),
  z.object({ op: z.literal(Op.PRESENCE_UPDATE), d: z.object({ status: PresenceStatus }) }),
  z.object({ op: z.literal(Op.SUBSCRIBE), d: SubscribePayload }),
  z.object({ op: z.literal(Op.UNSUBSCRIBE), d: z.object({ communityId: Snowflake }) }),
  z.object({ op: z.literal(Op.TYPING), d: TypingPayload }),
]);
export type ClientFrame = z.infer<typeof ClientFrame>;

// ── Server → client payloads ────────────────────────────────────────────────

export const HelloPayload = z.object({ heartbeatInterval: z.number().int() });

export const ReadyCommunity = Community.extend({
  channels: z.array(Channel),
  roles: z.array(Role),
  self: Member,
});

export const ReadyPayload = z.object({
  sessionId: z.string(),
  user: SelfUser,
  settings: UserSettings,
  relationships: z.array(Relationship),
  communities: z.array(ReadyCommunity),
  dmChannels: z.array(Channel),
  readStates: z.array(ReadState),
  presences: z.array(Presence),
});
export type ReadyPayload = z.infer<typeof ReadyPayload>;

/**
 * Every dispatch event type and its payload. The union is the contract:
 * servers may only emit these; clients must ignore unknown types (forward compatibility).
 */
export const DispatchEvents = {
  READY: ReadyPayload,
  RESUMED: z.object({}),
  USER_UPDATE: SelfUser,
  USER_SETTINGS_UPDATE: UserSettings,
  RELATIONSHIP_ADD: Relationship,
  RELATIONSHIP_REMOVE: z.object({ userId: Snowflake }),
  PRESENCE_UPDATE: Presence,
  COMMUNITY_CREATE: ReadyCommunity,
  COMMUNITY_UPDATE: Community,
  COMMUNITY_DELETE: z.object({ id: Snowflake, unavailable: z.boolean().default(false) }),
  COMMUNITY_MEMBER_ADD: Member,
  COMMUNITY_MEMBER_UPDATE: Member,
  COMMUNITY_MEMBER_REMOVE: z.object({ communityId: Snowflake, userId: Snowflake }),
  COMMUNITY_ROLE_CREATE: Role,
  COMMUNITY_ROLE_UPDATE: Role,
  COMMUNITY_ROLE_DELETE: z.object({ communityId: Snowflake, roleId: Snowflake }),
  CHANNEL_CREATE: Channel,
  CHANNEL_UPDATE: Channel,
  CHANNEL_DELETE: z.object({ id: Snowflake, communityId: Snowflake.nullable() }),
  CHANNEL_PINS_UPDATE: z.object({ channelId: Snowflake }),
  MESSAGE_CREATE: Message,
  MESSAGE_UPDATE: Message,
  MESSAGE_DELETE: z.object({ id: Snowflake, channelId: Snowflake }),
  MESSAGE_REACTION_ADD: z.object({
    messageId: Snowflake,
    channelId: Snowflake,
    userId: Snowflake,
    emoji: z.string(),
  }),
  MESSAGE_REACTION_REMOVE: z.object({
    messageId: Snowflake,
    channelId: Snowflake,
    userId: Snowflake,
    emoji: z.string(),
  }),
  TYPING_START: z.object({ channelId: Snowflake, userId: Snowflake, at: z.number() }),
  READ_STATE_UPDATE: ReadState,
  MESSAGE_ACK: z.object({ channelId: Snowflake, userId: Snowflake, messageId: Snowflake }),
} as const;

export type DispatchType = keyof typeof DispatchEvents;
export type DispatchPayload<T extends DispatchType> = z.infer<(typeof DispatchEvents)[T]>;

export type ServerFrame =
  | { op: typeof Op.HELLO; d: z.infer<typeof HelloPayload> }
  | { op: typeof Op.HEARTBEAT_ACK; d: null }
  | { op: typeof Op.HEARTBEAT; d: null }
  | { op: typeof Op.RECONNECT; d: null }
  | { op: typeof Op.INVALID_SESSION; d: { resumable: boolean } }
  | {
      [T in DispatchType]: { op: typeof Op.DISPATCH; t: T; s: number; d: DispatchPayload<T> };
    }[DispatchType];
