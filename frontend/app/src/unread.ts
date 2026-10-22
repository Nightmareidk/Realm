import type { Conversation, Message, ReadState, SafetyLists } from "@realm/contracts";
import { useEffect, useState } from "react";
import { live } from "./live";
import { api } from "./server";

/**
 * What's unread in your conversations, for the Inbox and the badge on its tab: the newest message
 * in each, how far you've read, and which you've muted. Filled once when you sign in, then kept
 * fresh by the live connection; any screen can read it.
 */
interface State {
  me: string | null;
  conversations: Conversation[];
  reads: Record<string, string | null>;
  muted: Set<string>;
  loaded: boolean;
}

let state: State = { me: null, conversations: [], reads: {}, muted: new Set(), loaded: false };
const listeners = new Set<() => void>();
const emit = () => {
  for (const fn of listeners) fn();
};
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  emit();
};

/** Whether snowflake `a` is older than `b`. */
export const olderId = (a: string, b: string) =>
  a.length === b.length ? a < b : a.length < b.length;

export function isUnread(c: Conversation, s: State = state): boolean {
  const last = c.lastMessage;
  if (!last || last.authorId === s.me) return false;
  const read = s.reads[c.id];
  return !read || olderId(read, last.id);
}

/** How many unread messages a conversation has (at least 1 when it's unread at all). */
export function unreadCount(c: Conversation, s: State = state): number {
  return isUnread(c, s) ? Math.max(1, c.unread) : 0;
}

export const isMuted = (channelId: string, s: State = state) => s.muted.has(channelId);

/** Load (or reload) everything: after signing in, and when a new conversation appears. */
export async function refreshUnread(me: string) {
  const [list, reads, safety] = await Promise.all([
    api<{ conversations: Conversation[] }>("/users/@me/channels"),
    api<{ readStates: ReadState[] }>("/users/@me/read-states"),
    api<SafetyLists>("/users/@me/safety").catch(() => null),
  ]);
  set({
    me,
    conversations: list.conversations,
    reads: Object.fromEntries(reads.readStates.map((r) => [r.channelId, r.lastReadMessageId])),
    muted: new Set(
      (safety?.mutes ?? []).filter((m) => m.targetType === "channel").map((m) => m.targetId),
    ),
    loaded: true,
  });
}

export function resetUnread() {
  state = { me: null, conversations: [], reads: {}, muted: new Set(), loaded: false };
  emit();
}

/** You've read up to here (the chat screen says so as you read). */
export function markRead(channelId: string, messageId: string) {
  const now = state.reads[channelId];
  if (now && !olderId(now, messageId)) return;
  const c = state.conversations.find((x) => x.id === channelId);
  const caughtUp = !c?.lastMessage || !olderId(messageId, c.lastMessage.id);
  set({
    reads: { ...state.reads, [channelId]: messageId },
    conversations: caughtUp
      ? state.conversations.map((x) => (x.id === channelId ? { ...x, unread: 0 } : x))
      : state.conversations,
  });
}

export function setConversations(conversations: Conversation[]) {
  set({ conversations });
}

export function setMuted(channelId: string, on: boolean) {
  const muted = new Set(state.muted);
  if (on) muted.add(channelId);
  else muted.delete(channelId);
  set({ muted });
}

/** A message in one of your conversations: it becomes that conversation's newest, at the top. */
function onMessage(m: Message) {
  const c = state.conversations.find((x) => x.id === m.channelId);
  // A conversation that wasn't in the list yet (a new one, or one you'd closed): load it.
  if (!c) {
    if (state.me && m.author.id !== state.me) refreshUnread(state.me).catch(() => {});
    return;
  }
  const preview = {
    id: m.id,
    authorId: m.author.id,
    type: m.type,
    content: m.content.slice(0, 140),
    attachments: m.attachments.length,
    attachmentKind: m.attachments[0]?.kind ?? null,
    place: Boolean(m.place),
    createdAt: m.createdAt,
  };
  const fromThem = m.author.id !== state.me;
  set({
    conversations: state.conversations.map((x) =>
      x.id === c.id
        ? { ...x, lastMessage: preview, unread: fromThem ? Math.min(99, x.unread + 1) : x.unread }
        : x,
    ),
  });
  if (m.author.id === state.me) markRead(m.channelId, m.id);
}

live.on((type, data) => {
  if (!state.loaded) return;
  if (type === "MESSAGE_CREATE") onMessage(data as Message);
  if (type === "READ_STATE_UPDATE") {
    const r = data as ReadState;
    if (r.lastReadMessageId) markRead(r.channelId, r.lastReadMessageId);
  }
  // A new conversation, or one that changed (a request accepted): load the list again.
  if ((type === "CHANNEL_CREATE" || type === "CHANNEL_UPDATE") && state.me) {
    const c = data as { communityId?: string | null };
    if (!c.communityId) refreshUnread(state.me).catch(() => {});
  }
});

// Back online after a gap: catch up on whatever arrived meanwhile.
live.onStatus((status) => {
  if (status === "live" && state.loaded && state.me) refreshUnread(state.me).catch(() => {});
});

/** The whole picture, kept current. */
export function useUnreadState(): State {
  const [, rerender] = useState(0);
  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return state;
}

/**
 * How many conversations have something you haven't read, for the badge on the Inbox tab. Muted
 * ones and message requests don't count (requests wait quietly, as on Instagram).
 */
export function useUnreadCount(): number {
  const s = useUnreadState();
  return s.conversations.filter((c) => !c.request && isUnread(c, s) && !isMuted(c.id, s)).length;
}

/** How many message requests are waiting. */
export function useRequestCount(): number {
  const s = useUnreadState();
  return s.conversations.filter((c) => c.request).length;
}
