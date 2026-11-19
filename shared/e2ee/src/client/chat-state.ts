import { type ChatEvent, MESSAGE_EDIT_WINDOW_MS } from "@realm/contracts";

/**
 * One encrypted chat as this device knows it: the decrypted messages, kept only on the device
 * (sealed with AES-256-GCM by the SealedKeyStore). Events from the other side are applied with
 * `applyEvent`, which trusts nothing: who sent an event comes from MLS, not from the event.
 */

/** What lets a received message be reported with proof (docs/E2EE.md §17). Base64url fields. */
export interface MessageProof {
  serverId: string;
  payload: string;
  frankingKey: string;
  commitment: string;
  serverSignature: string;
}

export interface ChatMessage {
  /** The id the sending device made up; edits, deletes and reactions point at it. */
  id: string;
  /**
   * A number that only goes up, in the order this device first saw each message. It gives
   * screens a sortable id for a message that doesn't change when older messages are dropped.
   */
  seq: number;
  authorId: string;
  text: string;
  replyTo?: string;
  /** ISO time: the server's receipt time for delivered messages. */
  sentAt: string;
  editedAt?: string;
  deleted?: boolean;
  /** Emoji to the people who reacted with it. */
  reactions: Record<string, string[]>;
  /** Only on this device's own messages while they are on their way, or if sending failed. */
  status?: "sending" | "failed";
  /** Only on messages from other people. */
  proof?: MessageProof;
}

export interface ChatState {
  v: 1;
  channelId: string;
  messages: ChatMessage[];
  nextSeq: number;
  /** For each person, the last message they've read. */
  seen: Record<string, string>;
  /**
   * The last message this device told the others it had read. It can be behind `seen` for
   * this person: a message request is read here without the sender being told.
   */
  sharedSeen?: string;
  /** Key rotation bookkeeping (§7.5): messages sent since this device last changed its keys. */
  sentSinceRotation: number;
  rotatedAt: number;
  /** How many incoming items couldn't be read (wrong keys, damaged, or badly formed). */
  problems: number;
}

/** Older messages are dropped past this, so one chat's saved record stays small. */
export const MAX_MESSAGES_KEPT = 2000;
const MAX_EMOJI_PER_MESSAGE = 30;

export function emptyChat(channelId: string, now: number): ChatState {
  return {
    v: 1,
    channelId,
    messages: [],
    nextSeq: 1,
    seen: {},
    sentSinceRotation: 0,
    rotatedAt: now,
    problems: 0,
  };
}

export interface EventSource {
  /** Proven by MLS: the account whose device signed the message. */
  userId: string;
  at: string;
  proof?: MessageProof;
  status?: ChatMessage["status"];
}

/**
 * Delivered messages in the order the server received them, then this device's own messages
 * that are still on their way (or failed), in the order they were written. Both people in a chat
 * end up with the same order, whatever order things reached each device in.
 */
function inOrder(messages: ChatMessage[]): ChatMessage[] {
  const rank = (m: ChatMessage) => (m.status ? 1 : 0);
  return messages
    .map((m, i) => ({ m, i }))
    .sort(
      (a, b) =>
        rank(a.m) - rank(b.m) ||
        (a.m.sentAt < b.m.sentAt ? -1 : a.m.sentAt > b.m.sentAt ? 1 : 0) ||
        a.i - b.i,
    )
    .map(({ m }) => m);
}

function replace(state: ChatState, id: string, change: (m: ChatMessage) => ChatMessage) {
  return { ...state, messages: state.messages.map((m) => (m.id === id ? change(m) : m)) };
}

/**
 * Applies one decrypted event. Returns the same object when the event changes nothing, which
 * is what happens to anything not allowed: a repeat, an edit or delete of someone else's
 * message, a reaction to a message that isn't there.
 */
export function applyEvent(state: ChatState, event: ChatEvent, from: EventSource): ChatState {
  const find = (id: string) => state.messages.find((m) => m.id === id);

  switch (event.type) {
    case "text": {
      if (find(event.id)) return state;
      const message: ChatMessage = {
        id: event.id,
        seq: state.nextSeq,
        authorId: from.userId,
        text: event.text,
        sentAt: from.at,
        reactions: {},
        ...(event.replyTo ? { replyTo: event.replyTo } : {}),
        ...(from.status ? { status: from.status } : {}),
        ...(from.proof ? { proof: from.proof } : {}),
      };
      return {
        ...state,
        nextSeq: state.nextSeq + 1,
        messages: inOrder([...state.messages, message]).slice(-MAX_MESSAGES_KEPT),
      };
    }
    case "edit": {
      const target = find(event.target);
      // Only the author may edit, and never a deleted message.
      if (!target || target.authorId !== from.userId || target.deleted) return state;
      if (target.text === event.text) return state;
      // The same 15 minutes as everywhere in Realm, checked here because no server can: a
      // conversation can't be quietly rewritten later.
      if (Date.parse(from.at) - Date.parse(target.sentAt) > MESSAGE_EDIT_WINDOW_MS) return state;
      return replace(state, target.id, (m) => {
        const { proof: _proofOfOldText, ...rest } = m;
        return { ...rest, text: event.text, editedAt: from.at };
      });
    }
    case "delete": {
      const target = find(event.target);
      if (!target || target.authorId !== from.userId || target.deleted) return state;
      return replace(state, target.id, (m) => {
        const { proof: _gone, replyTo: _alsoGone, ...rest } = m;
        return { ...rest, text: "", deleted: true, reactions: {} };
      });
    }
    case "reaction": {
      const target = find(event.target);
      if (!target || target.deleted) return state;
      const had = target.reactions[event.emoji] ?? [];
      const has = had.includes(from.userId);
      if (event.remove ? !has : has) return state;
      const reactions = { ...target.reactions };
      if (event.remove) {
        const left = had.filter((u) => u !== from.userId);
        if (left.length > 0) reactions[event.emoji] = left;
        else delete reactions[event.emoji];
      } else {
        if (!reactions[event.emoji] && Object.keys(reactions).length >= MAX_EMOJI_PER_MESSAGE) {
          return state;
        }
        reactions[event.emoji] = [...had, from.userId];
      }
      return replace(state, target.id, (m) => ({ ...m, reactions }));
    }
    case "seen": {
      const index = state.messages.findIndex((m) => m.id === event.upTo);
      if (index < 0) return state;
      const before = state.messages.findIndex((m) => m.id === state.seen[from.userId]);
      // "Seen" only moves forward.
      if (before >= index) return state;
      return { ...state, seen: { ...state.seen, [from.userId]: event.upTo } };
    }
  }
}

/** Marks one of this device's own messages as delivered, as failed, or as being tried again. */
export function settle(
  state: ChatState,
  id: string,
  result: { sentAt: string } | "failed" | "sending",
): ChatState {
  const settled = replace(state, id, (m) => {
    const { status: _was, ...rest } = m;
    return typeof result === "string"
      ? { ...rest, status: result }
      : { ...rest, sentAt: result.sentAt };
  });
  return { ...settled, messages: inOrder(settled.messages) };
}
