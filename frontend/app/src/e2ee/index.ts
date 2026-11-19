import type { Message, UserSettings, UserSummary } from "@realm/contracts";
import {
  type ChatMessage,
  type ChatState,
  type DeviceState,
  E2eeClient,
  E2eeRequestError,
} from "@realm/e2ee";
import { useEffect, useState } from "react";
import { live } from "../live";
import { ApiError, api } from "../server";
import { type SecurePreview, setSecurePreview } from "../unread";
import { openDeviceStore } from "./device-store";

/**
 * End-to-end encrypted chats in the app (docs/E2EE.md, phase 2): one client per signed-in
 * account, started when you sign in. It keeps keys and decrypted messages in this device's sealed
 * store, fetches what's waiting whenever the server says something is, and tells screens when a
 * chat changed. When the server doesn't offer encrypted chats, nothing here makes or sends a key.
 */

export type E2eeStatus =
  | DeviceState
  /** Nobody is signed in, or it couldn't be started (offline): tried again when back online. */
  | "none"
  | "starting";

interface Snapshot {
  status: E2eeStatus;
  client: E2eeClient | null;
  userId: string | null;
  /** Whether "Seen" is shared with the other person (the account's read-receipts setting). */
  shareSeen: boolean;
}

let snap: Snapshot = { status: "none", client: null, userId: null, shareSeen: true };
const statusListeners = new Set<() => void>();
const chatListeners = new Set<(channelId: string) => void>();
const keyListeners = new Set<(userId: string) => void>();

function update(next: Partial<Snapshot>) {
  snap = { ...snap, ...next };
  for (const fn of statusListeners) fn();
}

const transport = {
  async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    try {
      return await api<T>(path, { method, ...(body === undefined ? {} : { body }) });
    } catch (err) {
      if (err instanceof ApiError) throw new E2eeRequestError(err.status, err.code, err.message);
      throw err;
    }
  },
};

/** What the Inbox shows for an encrypted chat: its last message and what's unread, from here. */
function previewOf(chat: ChatState, me: string): SecurePreview {
  const shown = chat.messages.filter((m) => !m.deleted);
  const last = shown.at(-1);
  const readSeq = chat.messages.find((m) => m.id === chat.seen[me])?.seq ?? 0;
  return {
    lastMessage: last
      ? {
          id: String(last.seq),
          authorId: last.authorId,
          type: "default",
          content: last.text.slice(0, 140),
          attachments: 0,
          attachmentKind: null,
          place: false,
          createdAt: last.sentAt,
        }
      : null,
    unread: Math.min(99, shown.filter((m) => m.authorId !== me && m.seq > readSeq).length),
    read: readSeq ? String(readSeq) : null,
  };
}

async function refreshPreview(client: E2eeClient, me: string, channelId: string) {
  const chat = await client.chat(channelId);
  if (chat) setSecurePreview(channelId, previewOf(chat, me));
}

let starting: Promise<void> | null = null;

/** Sets this device up for the signed-in account. Safe to call again (after coming back online). */
export function startE2ee(userId: string): Promise<void> {
  if (snap.userId === userId && (snap.status === "ready" || snap.status === "off")) {
    return Promise.resolve();
  }
  starting ??= (async () => {
    update({ status: "starting", userId });
    try {
      let client = snap.client;
      if (!client || snap.userId !== userId) {
        const store = await openDeviceStore(userId);
        if (!store) {
          update({ status: "unavailable", client: null });
          return;
        }
        client = new E2eeClient({
          userId,
          transport,
          store,
          onChange: (what) => {
            if (what.channelId) {
              const channelId = what.channelId;
              if (client) refreshPreview(client, userId, channelId).catch(() => {});
              for (const fn of chatListeners) fn(channelId);
            }
            if (what.keyChangedFor) for (const fn of keyListeners) fn(what.keyChangedFor);
          },
        });
      }
      const status = await client.start();
      const settings =
        status === "ready"
          ? await api<UserSettings>("/users/@me/settings").catch(() => null)
          : null;
      update({ status, client, shareSeen: settings?.showReadReceipts ?? true });
      if (status !== "ready") return;
      for (const channelId of await client.chats()) await refreshPreview(client, userId, channelId);
      await client.sync();
    } catch {
      // Offline, or the server is having a bad moment: the live connection coming back retries.
      update({ status: "none" });
    } finally {
      starting = null;
    }
  })();
  return starting;
}

/** Signed out: stop using this account's client. Its keys and chats stay sealed on the device. */
export function stopE2ee() {
  setSecurePreview(null);
  update({ status: "none", client: null, userId: null, shareSeen: true });
}

/** Fetches and decrypts whatever is waiting. Quietly does nothing when encrypted chats aren't on. */
export async function syncE2ee(): Promise<void> {
  if (snap.status === "ready") await snap.client?.sync().catch(() => {});
}

// The server says something encrypted is waiting (it never says what): go and get it.
live.on((type) => {
  if (type === "E2EE_PENDING") syncE2ee();
});
// Back online: finish setting up if that failed, and catch up on what arrived meanwhile.
live.onStatus((status) => {
  if (status !== "live" || !snap.userId) return;
  if (snap.status === "none") startE2ee(snap.userId);
  else syncE2ee();
});

export const e2ee = {
  get status() {
    return snap.status;
  },
  /** The client, only when this device is set up and encrypted chats are on. */
  get client() {
    return snap.status === "ready" ? snap.client : null;
  },
  get shareSeen() {
    return snap.shareSeen;
  },
  onChat(fn: (channelId: string) => void) {
    chatListeners.add(fn);
    return () => {
      chatListeners.delete(fn);
    };
  },
  onKeyChange(fn: (userId: string) => void) {
    keyListeners.add(fn);
    return () => {
      keyListeners.delete(fn);
    };
  },
};

/** Whether encrypted chats can be used right now, for screens that offer them. */
export function useE2eeStatus(): E2eeStatus {
  const [status, setStatus] = useState(snap.status);
  useEffect(() => {
    const fn = () => setStatus(snap.status);
    statusListeners.add(fn);
    fn();
    return () => {
      statusListeners.delete(fn);
    };
  }, []);
  return status;
}

const nobody = (id: string): UserSummary => ({
  id,
  username: "",
  displayName: "",
  avatarUrl: null,
  accentColor: null,
});

/**
 * A saved encrypted message in the shape the chat screen draws. `id` is its number on this
 * device (sortable, like the server's ids), and `nonce` carries the id the sender gave it, which
 * is what edits, deletes, reactions and reports must use.
 */
export function asMessage(
  m: ChatMessage,
  chat: ChatState,
  people: Map<string, UserSummary>,
  me: string | null,
): Message {
  const quoted = m.replyTo ? chat.messages.find((x) => x.id === m.replyTo) : undefined;
  return {
    id: String(m.seq),
    channelId: chat.channelId,
    author: people.get(m.authorId) ?? nobody(m.authorId),
    type: quoted ? "reply" : "default",
    content: m.text,
    attachments: [],
    reactions: Object.entries(m.reactions).map(([emoji, who]) => ({
      emoji,
      count: who.length,
      me: me !== null && who.includes(me),
    })),
    replyTo: quoted
      ? {
          id: String(quoted.seq),
          author: people.get(quoted.authorId) ?? nobody(quoted.authorId),
          content: quoted.deleted ? null : quoted.text.slice(0, 140),
        }
      : null,
    mentions: [],
    mentionEveryone: false,
    pinned: false,
    place: null,
    hidden: false,
    editedAt: m.editedAt ?? null,
    createdAt: m.sentAt,
    nonce: m.id,
    viewLimit: null,
    viewsLeft: null,
    opened: false,
  };
}
