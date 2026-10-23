"use client";

import type {
  Channel,
  Conversation,
  MediaRef,
  Member,
  Message,
  Mute,
  Place,
  PresenceStatus,
  SelfUser,
  SpaceDetail,
} from "@realm/contracts";
import { useSyncExternalStore } from "react";

/** A room's history as loaded so far, oldest first. */
export interface RoomLog {
  messages: Message[];
  loaded: boolean;
  hasMore: boolean;
  loading: boolean;
}

/** A message on its way: shown at once, dimmed until the server has it. */
export interface Outgoing {
  nonce: string;
  channelId: string;
  content: string;
  replyTo: Message | null;
  /** Files already uploaded and ready, sent with the message. */
  attachments: MediaRef[];
  place: Place | null;
  createdAt: string;
  state: "sending" | "failed";
  error?: string;
}

export interface RealmState {
  /** "ready" once the gateway has said READY; "reconnecting" while it's trying to get back. */
  status: "idle" | "connecting" | "ready" | "reconnecting";
  /** Spaces arrived (from REST or the gateway): an empty list now means "none", not "loading". */
  spacesLoaded: boolean;
  me: SelfUser | null;
  spaces: SpaceDetail[];
  /** Your DMs and group chats, pinned first, then the most recently active. */
  conversations: Conversation[];
  conversationsLoaded: boolean;
  /** Room ID → its pinned messages, once someone has looked. */
  pins: Record<string, Message[]>;
  presence: Record<string, PresenceStatus>;
  /** Room ID → the last message you've read there. */
  reads: Record<string, string | null>;
  rooms: Record<string, RoomLog>;
  outgoing: Record<string, Outgoing[]>;
  /** Room ID → person ID → typing until (epoch ms). */
  typing: Record<string, Record<string, number>>;
  /** Space ID → its members, once someone has looked. */
  members: Record<string, Member[]>;
  /** Voice room ID → who's in it. */
  voice: Record<string, string[]>;
  /** People you've blocked (their messages fold away) and what you've muted. */
  blocked: string[];
  mutes: Mute[];
  /** What this Realm has set up (calls need LiveKit, push needs Firebase); null until known. */
  capabilities: { voice: boolean; push: boolean } | null;
  ui: {
    createSpace: boolean;
    invite: string | null;
    /** A Space's management sheet: settings, members, reports, activity. */
    manage: { spaceId: string; tab: ManageTab } | null;
    report: ReportTarget | null;
  };
}

export type ManageTab = "settings" | "members" | "roles" | "reports" | "activity";

export interface ReportTarget {
  targetType: "message" | "user" | "community" | "post" | "comment";
  targetId: string;
  communityId?: string;
  /** What's being reported, in words ("Kenji's message"). */
  label: string;
  /** Who could be blocked from the same sheet (a message's author, or the person). */
  blockUserId?: string;
}

const initial: RealmState = {
  status: "idle",
  spacesLoaded: false,
  me: null,
  spaces: [],
  conversations: [],
  conversationsLoaded: false,
  pins: {},
  presence: {},
  reads: {},
  rooms: {},
  outgoing: {},
  typing: {},
  members: {},
  voice: {},
  blocked: [],
  mutes: [],
  capabilities: null,
  ui: { createSpace: false, invite: null, manage: null, report: null },
};

let state: RealmState = initial;
const listeners = new Set<() => void>();

export const getState = () => state;

export function setState(update: (s: RealmState) => RealmState) {
  const next = update(state);
  if (next === state) return;
  state = next;
  for (const l of listeners) l();
}

export function resetState() {
  state = initial;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read a slice of Realm's live state; the component re-renders when that slice changes. */
export function useRealm<T>(select: (s: RealmState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(initial),
  );
}

// ── Small pure helpers ───────────────────────────────────────────────────────

export const later = (a: string | null | undefined, b: string | null | undefined) =>
  a != null && (b == null || BigInt(a) > BigInt(b));

const byPosition = (a: Channel, b: Channel) =>
  a.position - b.position || (BigInt(a.id) < BigInt(b.id) ? -1 : 1);

/** Rooms you can chat in, in the Space's order. */
export const chatRooms = (space: SpaceDetail): Channel[] =>
  space.channels.filter((c) => c.type === "text").sort(byPosition);

/** Every room shown as a tab: chat rooms, then voice rooms. */
export const spaceRooms = (space: SpaceDetail): Channel[] => [
  ...chatRooms(space),
  ...space.channels.filter((c) => c.type === "voice").sort(byPosition),
];

type Reads = RealmState["reads"];

export function roomUnread(reads: Reads, room: Channel): boolean {
  return later(room.lastMessageId, reads[room.id]);
}

export function spaceUnread(reads: Reads, space: SpaceDetail): boolean {
  return space.channels.some((c) => roomUnread(reads, c));
}

/** Something new in a conversation that you didn't say yourself. */
export function conversationUnread(reads: Reads, c: Conversation, meId: string | undefined) {
  return (
    Boolean(c.lastMessage) &&
    c.lastMessage?.authorId !== meId &&
    later(c.lastMessageId, reads[c.id])
  );
}

/** A conversation's name: the group's own, or its people ("Kenji", "Kenji and Ama", …). */
export function conversationTitle(c: Pick<Conversation, "name" | "recipients">): string {
  if (c.name) return c.name;
  const names = c.recipients.map((r) => r.displayName.split(/\s+/)[0] ?? r.displayName);
  if (c.recipients.length === 1) return c.recipients[0]?.displayName ?? "Conversation";
  if (names.length === 0) return "Just you";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/** Pinned first, then the most recently active. */
export function sortConversations(list: Conversation[]): Conversation[] {
  const activity = (c: Conversation) => BigInt(c.lastMessageId ?? c.id);
  return list.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const x = activity(a);
    const y = activity(b);
    return x === y ? 0 : x > y ? -1 : 1;
  });
}

/** Put a conversation in (or replace it), leaving you out of its people. */
export function upsertConversation(
  list: Conversation[],
  c: Conversation,
  meId: string | undefined,
): Conversation[] {
  const clean = { ...c, recipients: c.recipients.filter((r) => r.id !== meId) };
  return sortConversations([...list.filter((x) => x.id !== c.id), clean]);
}

export function findSpaceBySlug(s: RealmState, slug: string): SpaceDetail | undefined {
  const key = slug.toLowerCase();
  return s.spaces.find((x) => x.slug.toLowerCase() === key || x.id === slug);
}

/** Put a Space in (or replace it), keeping the join order. */
export function upsertSpace(spaces: SpaceDetail[], space: SpaceDetail): SpaceDetail[] {
  const i = spaces.findIndex((x) => x.id === space.id);
  if (i === -1) return [...spaces, space];
  const copy = spaces.slice();
  copy[i] = space;
  return copy;
}

export function patchSpace(
  spaces: SpaceDetail[],
  id: string,
  patch: (space: SpaceDetail) => SpaceDetail,
): SpaceDetail[] {
  return spaces.map((x) => (x.id === id ? patch(x) : x));
}

/** Add messages to a room's log, oldest first, without duplicates. */
export function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
}

export function openCreateSpace(open = true) {
  setState((s) => ({ ...s, ui: { ...s.ui, createSpace: open } }));
}

export function openInvite(spaceId: string | null) {
  setState((s) => ({ ...s, ui: { ...s.ui, invite: spaceId } }));
}

export function openManage(spaceId: string | null, tab: ManageTab = "settings") {
  setState((s) => ({ ...s, ui: { ...s.ui, manage: spaceId ? { spaceId, tab } : null } }));
}

export function openReport(target: ReportTarget | null) {
  setState((s) => ({ ...s, ui: { ...s.ui, report: target } }));
}

/** Whether something is muted right now (for unread dots and the Space list). */
export function isMuted(s: RealmState, targetType: Mute["targetType"], targetId: string) {
  return s.mutes.some(
    (m) =>
      m.targetType === targetType &&
      m.targetId === targetId &&
      (!m.until || Date.parse(m.until) > Date.now()),
  );
}
