"use client";

import type {
  Channel,
  Community,
  Conversation,
  Member,
  Message,
  Presence,
  ReadState,
  SafetyLists,
  SelfUser,
  SpaceDetail,
  UserSettings,
  VoiceState,
} from "@realm/contracts";
import { applyAccent, currentAccent } from "@/features/auth/accent";
import { ApiError, api } from "@/lib/api";
import {
  getState,
  later,
  mergeMessages,
  patchSpace,
  type RealmState,
  resetState,
  setState,
  sortConversations,
  upsertConversation,
  upsertSpace,
} from "./store";

/** Where the gateway listens. In development the API serves it at /gateway on port 4000. */
export const GATEWAY_URL =
  process.env.NEXT_PUBLIC_REALM_GATEWAY_URL ??
  (typeof window === "undefined"
    ? "ws://localhost:4000/gateway"
    : // Development: the API's port on the same machine the page came from (a phone on the
      // Wi-Fi opens the PC's address, not its own localhost).
      `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:4000/gateway`);

const OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  RESUME: 6,
  TYPING: 8,
  INVALID: 9,
  HELLO: 10,
  ACK: 11,
  VOICE_STATE: 12,
};
const AUTH_FAILED = 4004;
const TYPING_MS = 8_000;

interface Frame {
  op: number;
  t?: string;
  s?: number;
  d: unknown;
}

/**
 * One live connection per tab: it signs in with a short-lived ticket, keeps a heartbeat, and
 * reconnects with growing pauses when the network drops. After a reconnect it fills in whatever
 * the open rooms missed. Everything it hears lands in the store.
 */
class Realtime {
  private ws: WebSocket | null = null;
  private stopped = true;
  private beat: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private awaitingAck = false;
  private lastTyping = new Map<string, number>();
  /** Bumped on every start: a connect from an earlier start (still fetching its ticket) gives up. */
  private generation = 0;

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.generation += 1;
    setState((s) => ({ ...s, status: "connecting" }));
    // The Spaces list doesn't wait for the socket: the sidebar fills in even if it never connects.
    void api<{ spaces: SpaceDetail[] }>("/users/@me/communities")
      .then(({ spaces }) => {
        if (!getState().spacesLoaded) setState((s) => ({ ...s, spaces, spacesLoaded: true }));
      })
      .catch(() => {});
    void api<{ voice: boolean; push: boolean }>("/discover/capabilities")
      .then((capabilities) => setState((s) => ({ ...s, capabilities })))
      .catch(() => {});
    void api<SafetyLists>("/users/@me/safety")
      .then((lists) =>
        setState((s) => ({ ...s, blocked: lists.blocked.map((u) => u.id), mutes: lists.mutes })),
      )
      .catch(() => {});
    void api<{ readStates: ReadState[] }>("/users/@me/read-states")
      .then(({ readStates }) =>
        setState((s) => ({ ...s, reads: { ...toReads(readStates), ...s.reads } })),
      )
      .catch(() => {});
    window.addEventListener("online", this.onOnline);
    void this.connect();
  }

  stop() {
    this.stopped = true;
    window.removeEventListener("online", this.onOnline);
    if (this.retry) clearTimeout(this.retry);
    if (this.beat) clearInterval(this.beat);
    this.ws?.close(1000, "bye");
    this.ws = null;
    resetState();
  }

  private onOnline = () => {
    if (this.stopped || this.ws?.readyState === WebSocket.OPEN) return;
    if (this.retry) clearTimeout(this.retry);
    this.attempts = 0;
    void this.connect();
  };

  private async connect() {
    if (this.stopped) return;
    const generation = this.generation;
    let ticket: string;
    try {
      ({ ticket } = await api<{ ticket: string }>("/gateway/tickets", { method: "POST" }));
    } catch (err) {
      if (err instanceof ApiError && err.signedOut) {
        window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      return this.later();
    }
    if (this.stopped || generation !== this.generation) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(GATEWAY_URL);
    } catch {
      return this.later();
    }
    this.ws = ws;
    ws.onmessage = (e) => {
      // Only one socket feeds the store; a stale one (from an earlier start) is closed.
      if (this.ws !== ws) {
        ws.close(1000, "replaced");
        return;
      }
      let frame: Frame;
      try {
        frame = JSON.parse(String(e.data)) as Frame;
      } catch {
        return;
      }
      this.receive(frame, ticket);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.beat) clearInterval(this.beat);
      if (this.stopped) return;
      setState((s) => ({ ...s, status: "reconnecting" }));
      // A refused ticket (used, or the session ended): a fresh ticket tells which it was.
      if (e.code === AUTH_FAILED) this.attempts = Math.max(this.attempts, 2);
      this.later();
    };
  }

  /** The next try: 1s, 2s, 4s… up to 30s, with a little jitter so a crowd doesn't return at once. */
  private later() {
    if (this.stopped) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.attempts) * (0.8 + Math.random() * 0.4);
    this.attempts += 1;
    if (this.retry) clearTimeout(this.retry);
    this.retry = setTimeout(() => void this.connect(), delay);
  }

  private send(frame: { op: number; d: unknown }) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(frame));
  }

  private receive(frame: Frame, ticket: string) {
    switch (frame.op) {
      case OP.HELLO: {
        const interval = (frame.d as { heartbeatInterval: number }).heartbeatInterval;
        this.send({ op: OP.IDENTIFY, d: { ticket, client: { platform: "web", version: "1" } } });
        if (this.beat) clearInterval(this.beat);
        this.awaitingAck = false;
        this.beat = setInterval(() => {
          // No answer to the last beat: the line is dead even if the socket doesn't know it yet.
          if (this.awaitingAck) return this.ws?.close(4000, "zombie");
          this.awaitingAck = true;
          this.send({ op: OP.HEARTBEAT, d: null });
        }, interval);
        return;
      }
      case OP.ACK:
        this.awaitingAck = false;
        return;
      case OP.HEARTBEAT:
        this.send({ op: OP.HEARTBEAT, d: null });
        return;
      case OP.INVALID:
        this.ws?.close(4000, "invalid session");
        return;
      case OP.DISPATCH:
        if (frame.t) dispatch(frame.t, frame.d);
        if (frame.t === "READY") {
          this.attempts = 0;
          this.resendVoice();
          void fillGaps();
        }
        return;
    }
  }

  /** Tell the room you're typing, at most once every few seconds. */
  typing(channelId: string) {
    const now = Date.now();
    if (now - (this.lastTyping.get(channelId) ?? 0) < 5_000) return;
    this.lastTyping.set(channelId, now);
    this.send({ op: OP.TYPING, d: { channelId } });
  }

  /** You sent something: your typing marker is done. */
  sent(channelId: string) {
    this.lastTyping.delete(channelId);
  }

  /** Tell your Spaces you joined a voice room, or left voice (null). Re-sent after reconnects. */
  private voiceRoom: string | null = null;
  voiceState(channelId: string | null) {
    this.voiceRoom = channelId;
    this.send({ op: OP.VOICE_STATE, d: { channelId } });
  }
  resendVoice() {
    if (this.voiceRoom) this.send({ op: OP.VOICE_STATE, d: { channelId: this.voiceRoom } });
  }
}

export const realtime = new Realtime();

function toReads(states: ReadState[]): Record<string, string | null> {
  return Object.fromEntries(states.map((r) => [r.channelId, r.lastReadMessageId]));
}

/** After a reconnect: fetch what the open rooms missed while the line was down. */
async function fillGaps() {
  const rooms = getState().rooms;
  await Promise.all(
    Object.entries(rooms).map(async ([channelId, log]) => {
      const last = log.messages.at(-1)?.id;
      if (!log.loaded || !last) return;
      try {
        const { messages } = await api<{ messages: Message[] }>(
          `/channels/${channelId}/messages?after=${last}&limit=100`,
        );
        if (messages.length) {
          setState((s) => {
            const cur = s.rooms[channelId];
            if (!cur) return s;
            return {
              ...s,
              rooms: {
                ...s.rooms,
                [channelId]: { ...cur, messages: mergeMessages(cur.messages, messages) },
              },
            };
          });
        }
      } catch {
        // The room may be gone; its page says so.
      }
    }),
  );
}

function withRoom(spaces: SpaceDetail[], room: Channel): SpaceDetail[] {
  if (!room.communityId) return spaces;
  return patchSpace(spaces, room.communityId, (sp) => {
    const rest = sp.channels.filter((c) => c.id !== room.id);
    return { ...sp, channels: [...rest, room].sort((a, b) => a.position - b.position) };
  });
}

/** What a conversation's row says about its newest message. */
function previewOf(m: Message): NonNullable<Conversation["lastMessage"]> {
  const first = m.attachments[0];
  return {
    id: m.id,
    authorId: m.author.id,
    type: m.type,
    content: m.content.slice(0, 140),
    attachments: m.attachments.length,
    attachmentKind: first ? first.kind : null,
    place: m.place !== null,
    createdAt: m.createdAt,
  };
}

/** A new message moves its conversation to the top of the list (after the pinned ones). */
function bumpConversation(s: RealmState, m: Message): Conversation[] {
  if (!s.conversations.some((c) => c.id === m.channelId)) return s.conversations;
  return sortConversations(
    s.conversations.map((c) =>
      c.id === m.channelId && later(m.id, c.lastMessageId)
        ? { ...c, lastMessageId: m.id, lastMessage: previewOf(m) }
        : c,
    ),
  );
}

/** A conversation this device hasn't heard of yet (someone just started it): fetch it. */
async function fetchConversation(id: string) {
  try {
    const c = await api<Conversation>(`/users/@me/channels/${id}`);
    setState((s) => ({ ...s, conversations: upsertConversation(s.conversations, c, s.me?.id) }));
  } catch {
    // Not ours after all.
  }
}

function patchReactions(
  s: RealmState,
  e: { messageId: string; channelId: string; userId: string; emoji: string },
  delta: 1 | -1,
): RealmState {
  const log = s.rooms[e.channelId];
  if (!log) return s;
  const mine = e.userId === s.me?.id;
  const messages = log.messages.map((m) => {
    if (m.id !== e.messageId) return m;
    const found = m.reactions.find((r) => r.emoji === e.emoji);
    // Your own reaction is already shown (it's applied the moment you tap).
    if (mine && (delta === 1 ? found?.me : !found?.me)) return m;
    const reactions = found
      ? m.reactions
          .map((r) =>
            r.emoji === e.emoji
              ? { ...r, count: r.count + delta, me: mine ? delta === 1 : r.me }
              : r,
          )
          .filter((r) => r.count > 0)
      : delta === 1
        ? [...m.reactions, { emoji: e.emoji, count: 1, me: mine }]
        : m.reactions;
    return { ...m, reactions };
  });
  return { ...s, rooms: { ...s.rooms, [e.channelId]: { ...log, messages } } };
}

function setLastMessage(spaces: SpaceDetail[], m: Message): SpaceDetail[] {
  return spaces.map((sp) =>
    sp.channels.some((c) => c.id === m.channelId)
      ? {
          ...sp,
          channels: sp.channels.map((c) =>
            c.id === m.channelId && later(m.id, c.lastMessageId)
              ? { ...c, lastMessageId: m.id }
              : c,
          ),
        }
      : sp,
  );
}

/** Apply one gateway event to the store. Unknown events are ignored (the protocol may grow). */
export function dispatch(t: string, d: unknown) {
  switch (t) {
    case "READY": {
      const r = d as {
        user: SelfUser;
        settings: UserSettings;
        communities: SpaceDetail[];
        readStates: ReadState[];
        presences: Presence[];
        voiceStates: VoiceState[];
        dmChannels: Conversation[];
      };
      if (r.settings.accent !== currentAccent()) applyAccent(r.settings.accent);
      setState((s) => ({
        ...s,
        status: "ready",
        me: r.user,
        spaces: r.communities,
        spacesLoaded: true,
        conversations: sortConversations(
          r.dmChannels.map((c) => ({
            ...c,
            recipients: c.recipients.filter((p) => p.id !== r.user.id),
          })),
        ),
        conversationsLoaded: true,
        reads: toReads(r.readStates),
        presence: Object.fromEntries(r.presences.map((p) => [p.userId, p.status])),
        voice: r.voiceStates.reduce<Record<string, string[]>>((acc, v) => {
          acc[v.channelId] = [...(acc[v.channelId] ?? []), v.userId];
          return acc;
        }, {}),
      }));
      return;
    }
    case "VOICE_STATE_UPDATE": {
      const v = d as { channelId: string; userId: string; joined: boolean };
      setState((s) => {
        const now = (s.voice[v.channelId] ?? []).filter((id) => id !== v.userId);
        return { ...s, voice: { ...s.voice, [v.channelId]: v.joined ? [...now, v.userId] : now } };
      });
      return;
    }
    case "COMMUNITY_MEMBER_UPDATE": {
      const m = d as Member;
      setState((s) => ({
        ...s,
        // Your own timeout or roles changed: the Space's rules for you change with it.
        spaces: patchSpace(s.spaces, m.communityId, (sp) =>
          sp.self.user.id === m.user.id ? { ...sp, self: m } : sp,
        ),
        members: s.members[m.communityId]
          ? {
              ...s.members,
              [m.communityId]: (s.members[m.communityId] ?? []).map((x) =>
                x.user.id === m.user.id ? m : x,
              ),
            }
          : s.members,
      }));
      return;
    }
    case "USER_UPDATE":
      setState((s) => ({ ...s, me: d as SelfUser }));
      return;
    case "USER_SETTINGS_UPDATE": {
      const settings = d as UserSettings;
      if (settings.accent !== currentAccent()) applyAccent(settings.accent);
      return;
    }
    case "COMMUNITY_CREATE":
      setState((s) => ({ ...s, spaces: upsertSpace(s.spaces, d as SpaceDetail) }));
      return;
    case "COMMUNITY_UPDATE": {
      const c = d as Community;
      setState((s) => ({ ...s, spaces: patchSpace(s.spaces, c.id, (sp) => ({ ...sp, ...c })) }));
      return;
    }
    case "COMMUNITY_DELETE": {
      const { id } = d as { id: string };
      setState((s) => ({ ...s, spaces: s.spaces.filter((x) => x.id !== id) }));
      return;
    }
    case "COMMUNITY_MEMBER_ADD": {
      const m = d as Member;
      setState((s) => ({
        ...s,
        spaces: patchSpace(s.spaces, m.communityId, (sp) =>
          sp.self.user.id === m.user.id ? sp : { ...sp, memberCount: sp.memberCount + 1 },
        ),
        members: s.members[m.communityId]
          ? {
              ...s.members,
              [m.communityId]: [
                ...(s.members[m.communityId] ?? []).filter((x) => x.user.id !== m.user.id),
                m,
              ],
            }
          : s.members,
      }));
      return;
    }
    case "COMMUNITY_MEMBER_REMOVE": {
      const { communityId, userId } = d as { communityId: string; userId: string };
      setState((s) => ({
        ...s,
        spaces: patchSpace(s.spaces, communityId, (sp) => ({
          ...sp,
          memberCount: Math.max(1, sp.memberCount - 1),
        })),
        members: s.members[communityId]
          ? {
              ...s.members,
              [communityId]: (s.members[communityId] ?? []).filter((x) => x.user.id !== userId),
            }
          : s.members,
      }));
      return;
    }
    case "CHANNEL_CREATE":
    case "CHANNEL_UPDATE": {
      const c = d as Channel;
      if (c.communityId === null) {
        setState((s) => ({
          ...s,
          conversations: upsertConversation(s.conversations, d as Conversation, s.me?.id),
        }));
        return;
      }
      setState((s) => ({ ...s, spaces: withRoom(s.spaces, c) }));
      return;
    }
    case "CHANNEL_DELETE": {
      const { id, communityId } = d as { id: string; communityId: string | null };
      if (!communityId) {
        setState((s) => ({ ...s, conversations: s.conversations.filter((c) => c.id !== id) }));
        return;
      }
      setState((s) => ({
        ...s,
        spaces: patchSpace(s.spaces, communityId, (sp) => ({
          ...sp,
          channels: sp.channels.filter((c) => c.id !== id),
        })),
      }));
      return;
    }
    case "MESSAGE_CREATE": {
      const m = d as Message;
      const known =
        getState().conversations.some((c) => c.id === m.channelId) ||
        getState().spaces.some((sp) => sp.channels.some((c) => c.id === m.channelId));
      if (!known) void fetchConversation(m.channelId);
      setState((s) => {
        const log = s.rooms[m.channelId];
        const mine =
          s.me?.id === m.author.id || s.spaces.some((sp) => sp.self.user.id === m.author.id);
        const typing = { ...(s.typing[m.channelId] ?? {}) };
        delete typing[m.author.id];
        return {
          ...s,
          spaces: setLastMessage(s.spaces, m),
          conversations: bumpConversation(s, m),
          rooms: log?.loaded
            ? { ...s.rooms, [m.channelId]: { ...log, messages: mergeMessages(log.messages, [m]) } }
            : s.rooms,
          outgoing: m.nonce
            ? {
                ...s.outgoing,
                [m.channelId]: (s.outgoing[m.channelId] ?? []).filter((o) => o.nonce !== m.nonce),
              }
            : s.outgoing,
          // What you send yourself is read by definition.
          reads:
            mine && !m.type.startsWith("system_") ? { ...s.reads, [m.channelId]: m.id } : s.reads,
          typing: { ...s.typing, [m.channelId]: typing },
        };
      });
      return;
    }
    case "MESSAGE_UPDATE": {
      const m = d as Message;
      setState((s) => {
        const log = s.rooms[m.channelId];
        // Reactions move by their own events (and "me" is per person), so keep what's shown.
        const keep = (x: Message) => (x.id === m.id ? { ...m, reactions: x.reactions } : x);
        const pins = s.pins[m.channelId];
        return {
          ...s,
          rooms: log
            ? { ...s.rooms, [m.channelId]: { ...log, messages: log.messages.map(keep) } }
            : s.rooms,
          pins: pins
            ? {
                ...s.pins,
                [m.channelId]: m.pinned
                  ? [m, ...pins.filter((p) => p.id !== m.id)]
                  : pins.filter((p) => p.id !== m.id),
              }
            : s.pins,
        };
      });
      return;
    }
    case "MESSAGE_REACTION_ADD":
    case "MESSAGE_REACTION_REMOVE": {
      const e = d as { messageId: string; channelId: string; userId: string; emoji: string };
      setState((s) => patchReactions(s, e, t === "MESSAGE_REACTION_ADD" ? 1 : -1));
      return;
    }
    case "MESSAGE_ACK": {
      const a = d as { channelId: string; userId: string; messageId: string };
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === a.channelId
            ? {
                ...c,
                seen: [
                  ...c.seen.filter((x) => x.userId !== a.userId),
                  { userId: a.userId, messageId: a.messageId },
                ],
              }
            : c,
        ),
      }));
      return;
    }
    case "MESSAGE_DELETE": {
      const { id, channelId } = d as { id: string; channelId: string };
      setState((s) => {
        const log = s.rooms[channelId];
        if (!log) return s;
        return {
          ...s,
          rooms: {
            ...s.rooms,
            [channelId]: { ...log, messages: log.messages.filter((x) => x.id !== id) },
          },
        };
      });
      return;
    }
    case "TYPING_START": {
      const { channelId, userId } = d as { channelId: string; userId: string };
      setState((s) => ({
        ...s,
        typing: {
          ...s.typing,
          [channelId]: { ...(s.typing[channelId] ?? {}), [userId]: Date.now() + TYPING_MS },
        },
      }));
      return;
    }
    case "PRESENCE_UPDATE": {
      const p = d as Presence;
      setState((s) => ({ ...s, presence: { ...s.presence, [p.userId]: p.status } }));
      return;
    }
    case "READ_STATE_UPDATE": {
      const r = d as ReadState;
      setState((s) =>
        later(r.lastReadMessageId, s.reads[r.channelId])
          ? { ...s, reads: { ...s.reads, [r.channelId]: r.lastReadMessageId } }
          : s,
      );
      return;
    }
  }
}
