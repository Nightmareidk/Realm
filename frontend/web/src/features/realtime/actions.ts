"use client";

import type {
  Channel,
  Conversation,
  CreateInviteBody,
  Invite,
  MediaRef,
  MemberList,
  Message,
  Place,
  SpaceDetail,
  ThemeAccent,
} from "@realm/contracts";
import { ApiError, api } from "@/lib/api";
import { newId } from "@/lib/id";
import { realtime } from "./client";
import {
  getState,
  later,
  mergeMessages,
  type Outgoing,
  type RealmState,
  setState,
  upsertConversation,
  upsertSpace,
} from "./store";

const PAGE = 50;

/** Open a room: its latest messages, once. */
export async function loadRoom(channelId: string) {
  const log = getState().rooms[channelId];
  if (log?.loaded || log?.loading) return;
  setState((s) => ({
    ...s,
    rooms: {
      ...s.rooms,
      [channelId]: { messages: [], loaded: false, hasMore: false, loading: true },
    },
  }));
  try {
    const { messages } = await api<{ messages: Message[] }>(
      `/channels/${channelId}/messages?limit=${PAGE}`,
    );
    setState((s) => ({
      ...s,
      rooms: {
        ...s.rooms,
        [channelId]: {
          // Anything that arrived live while this loaded is kept.
          messages: mergeMessages(s.rooms[channelId]?.messages ?? [], messages),
          loaded: true,
          hasMore: messages.length === PAGE,
          loading: false,
        },
      },
    }));
  } catch (err) {
    setState((s) => {
      const { [channelId]: _, ...rest } = s.rooms;
      return { ...s, rooms: rest };
    });
    throw err;
  }
}

/** Scrolled to the top: the page before. */
export async function loadOlder(channelId: string) {
  const log = getState().rooms[channelId];
  const first = log?.messages[0]?.id;
  if (!log?.loaded || log.loading || !log.hasMore || !first) return;
  setState((s) => ({ ...s, rooms: { ...s.rooms, [channelId]: { ...log, loading: true } } }));
  try {
    const { messages } = await api<{ messages: Message[] }>(
      `/channels/${channelId}/messages?before=${first}&limit=${PAGE}`,
    );
    setState((s) => {
      const cur = s.rooms[channelId] ?? log;
      return {
        ...s,
        rooms: {
          ...s.rooms,
          [channelId]: {
            ...cur,
            messages: mergeMessages(cur.messages, messages),
            hasMore: messages.length === PAGE,
            loading: false,
          },
        },
      };
    });
  } catch {
    setState((s) => ({
      ...s,
      rooms: { ...s.rooms, [channelId]: { ...(s.rooms[channelId] ?? log), loading: false } },
    }));
  }
}

function settle(
  channelId: string,
  nonce: string,
  patch: Partial<{ state: "failed"; error: string }> | null,
) {
  setState((s) => ({
    ...s,
    outgoing: {
      ...s.outgoing,
      [channelId]: patch
        ? (s.outgoing[channelId] ?? []).map((o) => (o.nonce === nonce ? { ...o, ...patch } : o))
        : (s.outgoing[channelId] ?? []).filter((o) => o.nonce !== nonce),
    },
  }));
}

async function post(item: Outgoing) {
  const { channelId, nonce, content, replyTo } = item;
  try {
    const message = await api<Message>(`/channels/${channelId}/messages`, {
      body: {
        content,
        nonce,
        ...(replyTo ? { replyToId: replyTo.id } : {}),
        ...(item.attachments.length ? { attachmentIds: item.attachments.map((a) => a.id) } : {}),
        ...(item.place ? { place: item.place } : {}),
      },
    });
    setState((s) => {
      const log = s.rooms[channelId];
      return {
        ...s,
        rooms: log
          ? {
              ...s.rooms,
              [channelId]: { ...log, messages: mergeMessages(log.messages, [message]) },
            }
          : s.rooms,
        reads: later(message.id, s.reads[channelId])
          ? { ...s.reads, [channelId]: message.id }
          : s.reads,
      };
    });
    settle(channelId, nonce, null);
  } catch (err) {
    settle(channelId, nonce, {
      state: "failed",
      error: err instanceof ApiError ? err.message : "Couldn't send.",
    });
  }
}

/** Send at once, show it straight away, and reconcile when the server echoes the nonce. */
export function send(
  channelId: string,
  content: string,
  replyTo: Message | null = null,
  extras: { attachments?: MediaRef[]; place?: Place | null } = {},
) {
  const item: Outgoing = {
    nonce: newId(),
    channelId,
    content,
    replyTo,
    attachments: extras.attachments ?? [],
    place: extras.place ?? null,
    createdAt: new Date().toISOString(),
    state: "sending",
  };
  realtime.sent(channelId);
  setState((s) => ({
    ...s,
    outgoing: { ...s.outgoing, [channelId]: [...(s.outgoing[channelId] ?? []), item] },
  }));
  void post(item);
}

export function retry(channelId: string, nonce: string) {
  const item = getState().outgoing[channelId]?.find((o) => o.nonce === nonce);
  if (!item) return;
  setState((s) => ({
    ...s,
    outgoing: {
      ...s.outgoing,
      [channelId]: (s.outgoing[channelId] ?? []).map((o) =>
        o.nonce === nonce ? { ...o, state: "sending", error: undefined } : o,
      ),
    },
  }));
  void post(item);
}

export function discard(channelId: string, nonce: string) {
  settle(channelId, nonce, null);
}

export async function edit(channelId: string, messageId: string, content: string) {
  const message = await api<Message>(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    body: { content },
  });
  setState((s) => {
    const log = s.rooms[channelId];
    if (!log) return s;
    return {
      ...s,
      rooms: {
        ...s.rooms,
        [channelId]: {
          ...log,
          messages: log.messages.map((m) => (m.id === message.id ? message : m)),
        },
      },
    };
  });
}

export async function remove(channelId: string, messageId: string) {
  await api(`/channels/${channelId}/messages/${messageId}`, { method: "DELETE" });
  setState((s) => {
    const log = s.rooms[channelId];
    if (!log) return s;
    return {
      ...s,
      rooms: {
        ...s.rooms,
        [channelId]: { ...log, messages: log.messages.filter((m) => m.id !== messageId) },
      },
    };
  });
}

const acking = new Map<string, ReturnType<typeof setTimeout>>();

/** "Read up to here", sent a moment after you've actually seen it, and only ever forwards. */
export function markRead(channelId: string, messageId: string) {
  if (!later(messageId, getState().reads[channelId])) return;
  setState((s) => ({ ...s, reads: { ...s.reads, [channelId]: messageId } }));
  const pending = acking.get(channelId);
  if (pending) clearTimeout(pending);
  acking.set(
    channelId,
    setTimeout(() => {
      acking.delete(channelId);
      void api(`/channels/${channelId}/ack`, { body: { messageId } }).catch(() => {});
    }, 800),
  );
}

export function typing(channelId: string) {
  realtime.typing(channelId);
}

export async function loadMembers(spaceId: string) {
  const list = await api<MemberList>(`/communities/${spaceId}/members`);
  setState((s) => ({
    ...s,
    members: { ...s.members, [spaceId]: list.members },
    presence: {
      ...s.presence,
      ...Object.fromEntries(list.presences.map((p) => [p.userId, p.status])),
    },
  }));
}

export async function createSpace(body: {
  name: string;
  visibility: "private" | "public";
  accent: ThemeAccent;
}) {
  const space = await api<SpaceDetail>("/communities", { body });
  setState((s) => ({ ...s, spaces: upsertSpace(s.spaces, space), spacesLoaded: true }));
  return space;
}

export async function joinWithInvite(code: string) {
  const space = await api<SpaceDetail>(`/invites/${code}`, { method: "POST" });
  setState((s) => ({ ...s, spaces: upsertSpace(s.spaces, space) }));
  return space;
}

export async function joinOpenSpace(idOrSlug: string) {
  const space = await api<SpaceDetail>(`/communities/${idOrSlug}/join`, { method: "POST" });
  setState((s) => ({ ...s, spaces: upsertSpace(s.spaces, space) }));
  return space;
}

export async function leaveSpace(spaceId: string) {
  await api(`/communities/${spaceId}/members/@me`, { method: "DELETE" });
  setState((s) => ({ ...s, spaces: s.spaces.filter((x) => x.id !== spaceId) }));
}

export async function deleteSpace(spaceId: string) {
  await api(`/communities/${spaceId}`, { method: "DELETE" });
  setState((s) => ({ ...s, spaces: s.spaces.filter((x) => x.id !== spaceId) }));
}

export async function createRoom(spaceId: string, name: string, type: "text" | "voice" = "text") {
  const room = await api<Channel>(`/communities/${spaceId}/channels`, { body: { name, type } });
  setState((s) => ({
    ...s,
    spaces: s.spaces.map((sp) =>
      sp.id === spaceId && !sp.channels.some((c) => c.id === room.id)
        ? { ...sp, channels: [...sp.channels, room] }
        : sp,
    ),
  }));
  return room;
}

export function createInvite(spaceId: string, body: Partial<CreateInviteBody> = {}) {
  return api<Invite>(`/communities/${spaceId}/invites`, { body });
}

// ── Conversations (DMs and group chats) ──────────────────────────────────────

const putConversation = (c: Conversation) =>
  setState((s) => ({ ...s, conversations: upsertConversation(s.conversations, c, s.me?.id) }));

/** Open a DM with one person (the same one each time) or start a group with several. */
export async function openConversation(recipientIds: string[], name?: string) {
  const c = await api<Conversation>("/users/@me/channels", {
    body: { recipientIds, ...(name ? { name } : {}) },
  });
  putConversation(c);
  return c;
}

/** Rename a group, or pin it to the top of your list. */
export async function updateConversation(
  id: string,
  body: { name?: string | null; pinned?: boolean },
) {
  const c = await api<Conversation>(`/users/@me/channels/${id}`, { method: "PATCH", body });
  putConversation(c);
  return c;
}

export async function addToGroup(id: string, userId: string) {
  putConversation(
    await api<Conversation>(`/users/@me/channels/${id}/recipients/${userId}`, { method: "PUT" }),
  );
}

/** Leave a group, or close a DM (it comes back when someone says something). */
export async function leaveConversation(id: string) {
  await api(`/users/@me/channels/${id}/recipients/@me`, { method: "DELETE" });
  setState((s) => ({ ...s, conversations: s.conversations.filter((c) => c.id !== id) }));
}

// ── Reactions and pins ───────────────────────────────────────────────────────

function withReaction(
  s: RealmState,
  channelId: string,
  messageId: string,
  emoji: string,
  on: boolean,
) {
  const log = s.rooms[channelId];
  if (!log) return s;
  const messages = log.messages.map((m) => {
    if (m.id !== messageId) return m;
    const found = m.reactions.find((r) => r.emoji === emoji);
    if (on && found?.me) return m;
    if (!on && !found?.me) return m;
    const reactions = found
      ? m.reactions
          .map((r) => (r.emoji === emoji ? { ...r, count: r.count + (on ? 1 : -1), me: on } : r))
          .filter((r) => r.count > 0)
      : [...m.reactions, { emoji, count: 1, me: true }];
    return { ...m, reactions };
  });
  return { ...s, rooms: { ...s.rooms, [channelId]: { ...log, messages } } };
}

/** React (or take it back). Shown at once; undone if the server says no. */
export async function react(channelId: string, messageId: string, emoji: string, on: boolean) {
  setState((s) => withReaction(s, channelId, messageId, emoji, on));
  try {
    await api(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
      { method: on ? "PUT" : "DELETE" },
    );
  } catch (err) {
    setState((s) => withReaction(s, channelId, messageId, emoji, !on));
    throw err;
  }
}

export async function pinMessage(channelId: string, messageId: string, on: boolean) {
  await api<Message>(`/channels/${channelId}/pins/${messageId}`, { method: on ? "PUT" : "DELETE" });
}

export async function loadPins(channelId: string) {
  const { messages } = await api<{ messages: Message[] }>(`/channels/${channelId}/pins`);
  setState((s) => ({ ...s, pins: { ...s.pins, [channelId]: messages } }));
}
