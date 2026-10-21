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
  set({ reads: { ...state.reads, [channelId]: messageId } });
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
  if (!c) return;
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
  set({
    conversations: state.conversations.map((x) =>
      x.id === c.id ? { ...x, lastMessage: preview } : x,
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
  if (type === "CHANNEL_CREATE" && state.me) refreshUnread(state.me).catch(() => {});
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

/** How many conversations have something you haven't read (muted ones don't count). */
export function useUnreadCount(): number {
  const s = useUnreadState();
  return s.conversations.filter((c) => isUnread(c, s) && !isMuted(c.id, s)).length;
}
