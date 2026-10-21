"use client";

import {
  ArrowBendUpLeft,
  ArrowDown,
  Flag,
  PencilSimple,
  Plus,
  PushPin,
  PushPinSlash,
  Smiley,
  Trash,
  UserMinus,
  UserPlus,
} from "@phosphor-icons/react";
import type { Channel, Conversation, Message, SpaceDetail } from "@realm/contracts";
import { canStillEdit, Limits } from "@realm/contracts";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { pill, textLink } from "@/components/pill";
import { Popover } from "@/features/app/menus";
import { emojiName, QUICK_REACTIONS } from "@/features/chat/emoji";
import { EmojiPicker } from "@/features/chat/emoji-picker";
import type { ChatScope } from "@/features/chat/scope";
import {
  discard,
  edit,
  loadOlder,
  loadPins,
  loadRoom,
  markRead,
  pinMessage,
  react,
  remove,
  retry,
} from "@/features/realtime/actions";
import {
  conversationTitle,
  type Outgoing,
  openInvite,
  openReport,
  useRealm,
} from "@/features/realtime/store";
import { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";
import { FileList, isVisual, MediaGrid, PlaceCard } from "./attachments";
import { Composer } from "./composer";
import { Avatar } from "./person";

const GROUP_MS = 7 * 60_000;
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function dayLabel(d: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  }).format(d);
}

type Item =
  | { kind: "day"; key: string; label: string }
  | { kind: "new"; key: string }
  | { kind: "join"; key: string; message: Message }
  | { kind: "note"; key: string; message: Message }
  | { kind: "message"; key: string; message: Message; first: boolean; last: boolean };

/** Messages → what's drawn: day lines, the "new" line, join lines, and bubbles in runs. */
function arrange(messages: Message[], firstUnread: string | null): Item[] {
  const items: Item[] = [];
  let prev: Message | null = null;
  let day = "";
  messages.forEach((m, i) => {
    const at = new Date(m.createdAt);
    if (at.toDateString() !== day) {
      day = at.toDateString();
      items.push({ kind: "day", key: `day-${m.id}`, label: dayLabel(at) });
      prev = null;
    }
    if (m.id === firstUnread) {
      items.push({ kind: "new", key: "new" });
      prev = null;
    }
    if (m.type === "system_join") {
      items.push({ kind: "join", key: m.id, message: m });
      prev = null;
      return;
    }
    if (m.type.startsWith("system_")) {
      items.push({ kind: "note", key: m.id, message: m });
      prev = null;
      return;
    }
    const next = messages[i + 1];
    const continues = (a: Message | null, b: Message | undefined) =>
      Boolean(
        a &&
          b &&
          !b.type.startsWith("system_") &&
          a.author.id === b.author.id &&
          Date.parse(b.createdAt) - Date.parse(a.createdAt) < GROUP_MS &&
          new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString() &&
          b.id !== firstUnread,
      );
    items.push({
      kind: "message",
      key: m.id,
      message: m,
      first: !continues(prev, m),
      last: !continues(m, next),
    });
    prev = m;
  });
  return items;
}

/**
 * A chat, in a Space's room or a DM or group chat (docs/research/2026-10-phase1-messaging.md §7,
 * 2026-10-messaging-apps-survey.md): bubbles, others on the left and yours on the right in your
 * colour, grouped into runs; day lines; a "New" line where you left off; replies, reactions,
 * pins, edits and deletes; "Seen" in DMs; and a composer that floats at the foot.
 */
export function Chat({
  room,
  scope,
  presenceNote,
}: {
  room: Channel;
  scope: ChatScope;
  /** A quiet line above the composer while nobody's typing (a DM's "Kenji is here"). */
  presenceNote?: ReactNode;
}) {
  const log = useRealm((s) => s.rooms[room.id]);
  const outgoing = useRealm((s) => s.outgoing[room.id]);
  const typingNow = useRealm((s) => s.typing[room.id]);
  const status = useRealm((s) => s.status);
  const lastRead = useRealm((s) => s.reads[room.id]);
  const blocked = useRealm((s) => s.blocked);
  const pins = useRealm((s) => s.pins[room.id]);
  const meId = scope.meId;
  const space = scope.space;

  const [loadError, setLoadError] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [firstUnread, setFirstUnread] = useState<string | null>(null);

  const scroller = useRef<HTMLElement>(null);
  const atBottom = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const seenFirstLoad = useRef(false);
  const lastReadAtOpen = useRef(lastRead);

  const { canSend, canManage, canInvite, canReact, canPin } = scope;

  useEffect(() => {
    setLoadError("");
    loadRoom(room.id).catch((err) =>
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load this room."),
    );
    void loadPins(room.id).catch(() => {});
  }, [room.id]);

  const messages = log?.messages ?? [];

  // Where you left off, fixed when the room first loads (it doesn't jump as you read).
  useEffect(() => {
    if (!log?.loaded || seenFirstLoad.current) return;
    seenFirstLoad.current = true;
    const mark = lastReadAtOpen.current;
    const first = log.messages.find(
      (m) =>
        m.author.id !== meId &&
        !m.type.startsWith("system_") &&
        (!mark || BigInt(m.id) > BigInt(mark)),
    );
    if (first && mark) setFirstUnread(first.id);
  }, [log, meId]);

  const items = useMemo(() => arrange(messages, firstUnread), [messages, firstUnread]);
  const names = scope.names;

  // "Seen", under your newest message: who has read up to it (DMs and group chats only, and only
  // between people who both share read receipts).
  const seen = useMemo(() => {
    const c = scope.conversation;
    if (!c) return null;
    const mineLast = [...messages]
      .reverse()
      .find((m) => m.author.id === meId && !m.type.startsWith("system_"));
    if (!mineLast) return null;
    const readers = c.seen
      .filter((x) => x.userId !== meId && BigInt(x.messageId) >= BigInt(mineLast.id))
      .map((x) => names.get(x.userId)?.split(/\s+/)[0] ?? "Someone");
    if (readers.length === 0) return null;
    const label =
      c.type === "dm"
        ? "Seen"
        : readers.length === c.recipients.length
          ? "Seen by everyone"
          : `Seen by ${readers.slice(0, 3).join(", ")}${readers.length > 3 ? ` +${readers.length - 3}` : ""}`;
    return { id: mineLast.id, label };
  }, [scope.conversation, messages, meId, names]);

  const toBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
    setShowJump(false);
  }, []);

  // Keep the newest in view while you're at the bottom; keep your place when older ones load.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after every change to what's drawn.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (restore.current) {
      el.scrollTop = el.scrollHeight - restore.current.height + restore.current.top;
      restore.current = null;
      return;
    }
    if (atBottom.current) el.scrollTop = el.scrollHeight;
    else if (messages.length) setShowJump(true);
  }, [items.length, outgoing?.length]);

  // Read up to the newest you can see, once it's actually on screen and the tab is in front.
  useEffect(() => {
    const last = messages.at(-1);
    if (!last || !atBottom.current) return;
    if (document.visibilityState === "visible") markRead(room.id, last.id);
  }, [messages, room.id]);

  useEffect(() => {
    const onVisible = () => {
      const last = messages.at(-1);
      if (last && atBottom.current && document.visibilityState === "visible")
        markRead(room.id, last.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [messages, room.id]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) {
      setShowJump(false);
      const last = messages.at(-1);
      if (last) markRead(room.id, last.id);
    }
    if (el.scrollTop < 240 && log?.hasMore && !log.loading) {
      restore.current = { height: el.scrollHeight, top: el.scrollTop };
      void loadOlder(room.id);
    }
  };

  // Arrow keys move between messages (one tab stop for the whole list).
  const order = useMemo(
    () => items.flatMap((it) => (it.kind === "message" ? [it.message.id] : [])),
    [items],
  );
  const onListKey = (e: KeyboardEvent<HTMLOListElement>) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    if ((e.target as HTMLElement).closest("textarea,input,button")) return;
    e.preventDefault();
    const at = focusId ? order.indexOf(focusId) : order.length;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? order.length - 1
          : e.key === "ArrowUp"
            ? at - 1
            : at + 1;
    const id = order[Math.max(0, Math.min(order.length - 1, next))];
    if (!id) return;
    setFocusId(id);
    document.getElementById(`m-${id}`)?.focus();
  };
  const tabStop = focusId && order.includes(focusId) ? focusId : order.at(-1);

  const typists = Object.entries(typingNow ?? {})
    .filter(([id, until]) => id !== meId && until > Date.now())
    .map(([id]) => names.get(id) ?? "Someone");

  // Typing markers fade on their own; a tick re-reads them.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!typists.length) return;
    const t = setTimeout(() => tick((n) => n + 1), 2000);
    return () => clearTimeout(t);
  });

  // Screen readers hear new messages from others as they arrive, once each: not the history
  // loading above, not your own sends, not the typing line.
  const [heard, setHeard] = useState("");
  const announcedUpTo = useRef<string | null>(null);
  useEffect(() => {
    if (!log?.loaded) return;
    const last = messages.at(-1)?.id ?? null;
    if (announcedUpTo.current === null) {
      announcedUpTo.current = last ?? "0";
      return;
    }
    const since = announcedUpTo.current;
    const fresh = messages.filter((m) => BigInt(m.id) > BigInt(since) && m.author.id !== meId);
    if (last && BigInt(last) > BigInt(since)) announcedUpTo.current = last;
    const m = fresh.at(-1);
    if (!m) return;
    const who = names.get(m.author.id) ?? m.author.displayName;
    setHeard(
      m.type === "system_join"
        ? `${who} joined the Space.`
        : m.type.startsWith("system_")
          ? noteText(m, meId, names)
          : `${who}: ${m.content}`,
    );
  }, [log?.loaded, messages, meId, names]);

  const startEditLast = () => {
    const mine = [...messages]
      .reverse()
      .find((m) => m.author.id === meId && !m.type.startsWith("system_"));
    // Up-arrow edits your last message, while it can still be edited (15 minutes).
    if (mine && canStillEdit(mine.createdAt)) setEditing(mine.id);
  };

  const pinned = pins?.[0];
  const jumpTo = (id: string) => {
    const el = document.getElementById(`m-${id}`);
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
    return true;
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {pinned && (
        <PinnedBar
          pins={pins ?? []}
          names={names}
          onJump={jumpTo}
          canPin={canPin}
          channelId={room.id}
        />
      )}
      <section
        ref={scroller}
        onScroll={onScroll}
        aria-label={`Messages in ${scope.label}`}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-4 pb-2 md:px-6"
      >
        {loadError ? (
          <p className="px-2 py-10 text-center text-fg-soft">
            {loadError}{" "}
            <button
              type="button"
              className={textLink}
              onClick={() => {
                setLoadError("");
                loadRoom(room.id).catch((err) =>
                  setLoadError(err instanceof ApiError ? err.message : "Couldn't load this room."),
                );
              }}
            >
              Try again
            </button>
          </p>
        ) : !log?.loaded ? (
          <p role="status" className="px-2 py-10 text-center text-fg-soft">
            Loading {scope.label}…
          </p>
        ) : (
          <>
            {log.hasMore ? (
              <p className="py-3 text-center text-[0.9rem] text-fg-soft">
                {log.loading ? "Loading earlier messages…" : "Scroll up for earlier messages"}
              </p>
            ) : scope.conversation ? (
              <ConversationStart conversation={scope.conversation} />
            ) : space ? (
              <RoomStart room={room} space={space} canInvite={canInvite} />
            ) : null}
            <ol onKeyDown={onListKey} className="flex flex-col">
              {items.map((it) => {
                if (it.kind === "day") {
                  return (
                    <li key={it.key} className="my-4 flex justify-center">
                      <span className="rounded-full px-3 py-1 text-[0.82rem] font-bold text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)]">
                        {it.label}
                      </span>
                    </li>
                  );
                }
                if (it.kind === "new") {
                  return (
                    <li
                      key={it.key}
                      className="my-3 flex items-center gap-3"
                      aria-label="New messages from here"
                    >
                      <span aria-hidden="true" className="h-px flex-1 bg-accent/50" />
                      <span aria-hidden="true" className="text-[0.82rem] font-bold text-accent">
                        New
                      </span>
                      <span aria-hidden="true" className="h-px flex-1 bg-accent/50" />
                    </li>
                  );
                }
                if (it.kind === "note") {
                  return (
                    <li key={it.key} className="my-2 flex justify-center px-4 text-center">
                      <span className="inline-flex items-center gap-2 text-[0.9rem] text-fg-soft">
                        {it.message.type === "system_pin" ? (
                          <PushPin aria-hidden="true" size={15} />
                        ) : it.message.type === "system_recipient_remove" ? (
                          <UserMinus aria-hidden="true" size={15} />
                        ) : it.message.type === "system_recipient_add" ? (
                          <UserPlus aria-hidden="true" size={15} />
                        ) : (
                          <PencilSimple aria-hidden="true" size={15} />
                        )}
                        <span>
                          {noteText(it.message, meId, names)}
                          {it.message.type === "system_pin" && it.message.replyTo && (
                            <>
                              {" "}
                              <button
                                type="button"
                                className={textLink}
                                onClick={() => it.message.replyTo && jumpTo(it.message.replyTo.id)}
                              >
                                See it
                              </button>
                            </>
                          )}
                        </span>
                        <time dateTime={it.message.createdAt} className="text-[0.82rem]">
                          {timeFormat.format(new Date(it.message.createdAt))}
                        </time>
                      </span>
                    </li>
                  );
                }
                if (it.kind === "join") {
                  const who = it.message.author.id === meId ? "You" : it.message.author.displayName;
                  return (
                    <li key={it.key} className="my-2 flex justify-center">
                      <span className="inline-flex items-center gap-2 text-[0.9rem] text-fg-soft">
                        <UserPlus aria-hidden="true" size={16} />
                        <span>
                          <strong className="font-bold text-fg">{who}</strong>{" "}
                          {who === "You" ? "joined." : "joined. Say hi."}
                        </span>
                        <time dateTime={it.message.createdAt} className="text-[0.82rem]">
                          {timeFormat.format(new Date(it.message.createdAt))}
                        </time>
                      </span>
                    </li>
                  );
                }
                const m = it.message;
                return (
                  <Bubble
                    key={it.key}
                    message={m}
                    mine={m.author.id === meId}
                    first={it.first}
                    last={it.last}
                    name={names.get(m.author.id) ?? m.author.displayName}
                    showName={scope.conversation?.type !== "dm"}
                    tabIndex={m.id === tabStop ? 0 : -1}
                    onFocus={() => setFocusId(m.id)}
                    editing={editing === m.id}
                    canDelete={m.author.id === meId || canManage}
                    onReply={() => {
                      setReplyTo(m);
                      composer.current?.focus();
                    }}
                    onEdit={() => setEditing(m.id)}
                    onEditDone={() => {
                      setEditing(null);
                      document.getElementById(`m-${m.id}`)?.focus();
                    }}
                    channelId={room.id}
                    spaceId={space?.id ?? null}
                    blocked={blocked.includes(m.author.id)}
                    canReact={canReact}
                    canPin={canPin}
                    seen={seen?.id === m.id ? seen.label : null}
                    avatar={
                      scope.conversation?.type === "group_dm" && m.author.id !== meId
                        ? it.last
                          ? m.author
                          : null
                        : undefined
                    }
                  />
                );
              })}
              {(outgoing ?? []).map((o) => (
                <PendingBubble key={o.nonce} item={o} />
              ))}
            </ol>
          </>
        )}
      </section>

      <p aria-live="polite" className="sr-only">
        {heard}
      </p>

      {showJump && (
        <button
          type="button"
          onClick={() => toBottom(true)}
          className={pill(
            "ghost",
            "sm",
            "absolute bottom-[6.5rem] left-1/2 -translate-x-1/2 bg-surface-raised",
          )}
        >
          <ArrowDown aria-hidden="true" size={16} />
          New messages
        </button>
      )}

      <div className="px-3 pb-3 md:px-6 md:pb-4">
        <div className="flex h-7 items-center gap-2 px-1 text-[0.88rem] text-fg-soft">
          {status === "reconnecting" ? (
            <p role="status" className="truncate px-1">
              Reconnecting… what you send still goes through.
            </p>
          ) : typists.length > 0 ? (
            <>
              <span
                aria-hidden="true"
                className="inline-flex h-6 items-center gap-1 rounded-full bg-bubble-theirs px-2.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-fg-soft motion-safe:animate-[realm-typing_1.2s_ease-in-out_infinite]"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
              <p className="truncate">
                {typists.length === 1
                  ? `${typists[0]} is typing…`
                  : typists.length === 2
                    ? `${typists[0]} and ${typists[1]} are typing…`
                    : "Several people are typing…"}
              </p>
            </>
          ) : (
            (presenceNote ?? null)
          )}
        </div>
        {canSend ? (
          <Composer
            scope={scope}
            room={room}
            inputRef={composer}
            replyTo={replyTo}
            replyName={replyTo ? (names.get(replyTo.author.id) ?? replyTo.author.displayName) : ""}
            onCancelReply={() => setReplyTo(null)}
            onSent={() => {
              setReplyTo(null);
              atBottom.current = true;
            }}
            onEditLast={startEditLast}
          />
        ) : (
          <p className="rounded-[1.4rem] px-5 py-4 text-fg-soft shadow-[inset_0_0_0_1.5px_var(--r-border)]">
            {scope.cantSend}
          </p>
        )}
      </div>
    </div>
  );
}

function RoomStart({
  room,
  space,
  canInvite,
}: {
  room: Channel;
  space: SpaceDetail;
  canInvite: boolean;
}) {
  return (
    <div className="mx-auto max-w-[34rem] px-2 pt-10 pb-6 text-center">
      <p className="font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em] text-fg">
        This is the start of #{room.name}.
      </p>
      <p className="mt-2 text-fg-soft">
        Rooms in a Space aren't end-to-end encrypted, so Realm's servers can read them.
      </p>
      {canInvite && space.memberCount < 2 && (
        <button
          type="button"
          onClick={() => openInvite(space.id)}
          className={pill("ghost", "md", "mt-5")}
        >
          <UserPlus aria-hidden="true" size={18} />
          Invite your crew
        </button>
      )}
    </div>
  );
}

/** The top of a DM or group chat: who it's with, and plainly how private it is. */
function ConversationStart({ conversation: c }: { conversation: Conversation }) {
  const title = conversationTitle(c);
  const one = c.type === "dm" ? c.recipients[0] : undefined;
  return (
    <div className="mx-auto flex max-w-[34rem] flex-col items-center px-2 pt-10 pb-6 text-center">
      <span className="flex">
        {(one ? [one] : c.recipients.slice(0, 3)).map((r, i) => (
          <Avatar
            key={r.id}
            user={r}
            size={one ? 76 : 56}
            className={cx("shadow-[0_0_0_4px_var(--r-surface)]", i > 0 && "-ml-4")}
          />
        ))}
      </span>
      <p className="mt-4 font-display text-[1.5rem] leading-tight font-bold tracking-[-0.02em] text-fg">
        {title}
      </p>
      {one && <p className="text-fg-soft">@{one.username}</p>}
      <p className="mt-3 max-w-[30rem] text-[0.95rem] text-fg-soft">
        {c.type === "dm"
          ? "This is the start of your conversation."
          : `This is the start of the group, with ${c.recipients.length + 1} people.`}{" "}
        Direct messages aren't end-to-end encrypted yet, so Realm's servers can read them;
        end-to-end encryption is planned before public launch.
      </p>
    </div>
  );
}

/** What a system line says: "Noor pinned a message", "Kenji left", "Ama named the group …". */
function noteText(m: Message, meId: string, names: Map<string, string>) {
  const who = m.author.id === meId ? "You" : (names.get(m.author.id) ?? m.author.displayName);
  const target = m.mentions[0];
  const them =
    target === meId ? "you" : target ? (names.get(target) ?? m.content) : m.content || "someone";
  switch (m.type) {
    case "system_pin":
      return `${who} pinned a message.`;
    case "system_channel_rename":
      return m.content
        ? `${who} named the group ${m.content}.`
        : `${who} removed the group's name.`;
    case "system_recipient_add":
      return `${who} added ${them}.`;
    case "system_recipient_remove":
      return target === m.author.id ? `${who} left.` : `${who} removed ${them}.`;
    default:
      return `${who} changed something.`;
  }
}

/** The newest pinned message, at the top of the chat: tap to go to it, or see them all. */
function PinnedBar({
  pins,
  names,
  onJump,
  canPin,
  channelId,
}: {
  pins: Message[];
  names: Map<string, string>;
  onJump: (id: string) => boolean;
  canPin: boolean;
  channelId: string;
}) {
  const [missing, setMissing] = useState("");
  const top = pins[0];
  if (!top) return null;
  const preview = (m: Message) =>
    m.content || (m.attachments.length ? "A file" : m.place ? m.place.name : "A message");
  return (
    <div className="mx-3 mt-2 flex items-center gap-2 rounded-[1rem] bg-fg/[0.04] py-1.5 pr-1.5 pl-3 shadow-[inset_0_0_0_1px_var(--r-border)] md:mx-6">
      <PushPin aria-hidden="true" size={16} weight="fill" className="shrink-0 text-fg-soft" />
      <button
        type="button"
        onClick={() => setMissing(onJump(top.id) ? "" : "It's further up. Scroll to load it.")}
        className="min-w-0 flex-1 truncate text-left text-[0.92rem]"
      >
        <span className="font-bold text-fg">
          {names.get(top.author.id) ?? top.author.displayName}:
        </span>{" "}
        <span className="text-fg-soft">{preview(top)}</span>
      </button>
      {missing && (
        <span className="sr-only" role="status">
          {missing}
        </span>
      )}
      <Popover
        label={pins.length > 1 ? `All ${pins.length} pinned messages` : "Pinned message"}
        buttonClass="h-8 shrink-0 rounded-full px-3 text-[0.85rem] font-bold text-fg-soft hover:bg-fg/8 hover:text-fg"
        panelClass="w-[22rem]"
        button={pins.length > 1 ? `${pins.length} pinned` : "Pinned"}
      >
        {(close) => (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {pins.map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-2 rounded-[0.8rem] px-2 py-2 hover:bg-fg/6"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    close();
                    onJump(m.id);
                  }}
                >
                  <span className="block text-[0.82rem] font-bold text-fg-soft">
                    {names.get(m.author.id) ?? m.author.displayName}
                  </span>
                  <span className="line-clamp-2 text-[0.92rem] text-fg">{preview(m)}</span>
                </button>
                {canPin && (
                  <button
                    type="button"
                    title="Unpin"
                    onClick={() => void pinMessage(channelId, m.id, false)}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-fg-soft hover:bg-fg/10 hover:text-fg"
                  >
                    <PushPinSlash aria-hidden="true" size={16} />
                    <span className="sr-only">Unpin</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </div>
  );
}

/** Reaction chips under a message: tap one to add yours or take it back. */
function Reactions({
  message: m,
  mine,
  canReact,
  onToggle,
}: {
  message: Message;
  mine: boolean;
  canReact: boolean;
  onToggle: (emoji: string, on: boolean) => void;
}) {
  if (m.reactions.length === 0) return null;
  return (
    <ul
      aria-label="Reactions"
      className={cx("-mt-1 flex flex-wrap gap-1", mine ? "justify-end pr-1" : "justify-start pl-1")}
    >
      {m.reactions.map((r) => (
        <li key={r.emoji}>
          <button
            type="button"
            aria-disabled={!canReact || undefined}
            aria-pressed={r.me}
            onClick={() => canReact && onToggle(r.emoji, !r.me)}
            className={cx(
              "relative z-[1] inline-flex h-7 items-center gap-1 rounded-full px-2 text-[0.85rem] font-bold tabular-nums transition-[background-color,box-shadow,transform] duration-150 ease-out motion-safe:active:scale-95",
              r.me
                ? "bg-accent/15 text-fg shadow-[inset_0_0_0_1.5px_var(--r-accent)]"
                : "bg-surface-raised text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)] hover:text-fg",
            )}
          >
            <span aria-hidden="true" className="text-[1rem] leading-none">
              {r.emoji}
            </span>
            {r.count}
            <span className="sr-only">
              {" "}
              {emojiName(r.emoji)}
              {r.me ? ", including you" : ""}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** React: the six quick ones, or any emoji. */
function ReactButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [more, setMore] = useState(false);
  return (
    <Popover
      label="React"
      placement="above"
      buttonClass="inline-flex size-8 items-center justify-center rounded-full text-fg-soft hover:bg-fg/10 hover:text-fg aria-expanded:bg-fg/10 aria-expanded:text-fg pointer-coarse:size-11"
      panelClass="p-1.5"
      button={<Smiley aria-hidden="true" size={17} />}
    >
      {(close) =>
        more ? (
          <EmojiPicker
            label="React with"
            onPick={(e) => {
              close();
              setMore(false);
              onPick(e);
            }}
          />
        ) : (
          <div className="flex items-center gap-0.5">
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  close();
                  onPick(e);
                }}
                className="grid size-10 place-items-center rounded-full text-[1.4rem] transition-transform duration-150 ease-out hover:bg-fg/8 motion-safe:hover:scale-125"
              >
                <span aria-hidden="true">{e}</span>
                <span className="sr-only">{emojiName(e)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMore(true)}
              className="grid size-10 place-items-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
            >
              <Plus aria-hidden="true" size={18} />
              <span className="sr-only">More emoji</span>
            </button>
          </div>
        )
      }
    </Popover>
  );
}

function Bubble({
  message: m,
  mine,
  first,
  last,
  name,
  tabIndex,
  onFocus,
  editing,
  canDelete,
  onReply,
  onEdit,
  onEditDone,
  channelId,
  spaceId,
  blocked,
  canReact,
  canPin,
  seen,
  avatar,
  showName = true,
}: {
  message: Message;
  mine: boolean;
  first: boolean;
  last: boolean;
  name: string;
  tabIndex: number;
  onFocus: () => void;
  editing: boolean;
  canDelete: boolean;
  onReply: () => void;
  onEdit: () => void;
  onEditDone: () => void;
  channelId: string;
  /** The room's Space, for reports; null in a DM or group chat. */
  spaceId: string | null;
  /** You blocked the author: the message folds away until you choose to see it. */
  blocked: boolean;
  canReact: boolean;
  canPin: boolean;
  /** "Seen" or "Seen by Kenji", under your newest message in a conversation. */
  seen: string | null;
  /** The author's name above their run (left out in a one-to-one DM, where it's obvious). */
  showName?: boolean;
  /**
   * In a group chat, the author's picture beside the last message of their run (null keeps the
   * column for the others in the run); left out elsewhere.
   */
  avatar?: Message["author"] | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [unfold, setUnfold] = useState(false);
  const at = new Date(m.createdAt);
  const hiddenForMe = m.hidden && !m.content && m.attachments.length === 0 && !m.place;
  // Photos and videos stand outside the bubble; the bubble holds words, files and places.
  const visual = m.attachments.filter(isVisual);
  const files = m.attachments.filter((f) => !isVisual(f));
  const hasBubble = Boolean(m.content || files.length || m.place || m.replyTo || m.hidden);
  const folded = blocked && !unfold;
  const report = () =>
    openReport({
      targetType: "message",
      targetId: m.id,
      ...(spaceId ? { communityId: spaceId } : {}),
      label: `${name}'s message`,
      blockUserId: m.author.id,
    });
  const toggle = (emoji: string, on: boolean) =>
    react(channelId, m.id, emoji, on).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't react. Try again."),
    );
  // Double-click (or double-tap) a message to send a heart, the way photo apps do.
  const heart = () => {
    if (!canReact || mine) return;
    const has = m.reactions.find((r) => r.emoji === "❤️")?.me;
    void toggle("❤️", !has);
  };

  return (
    <li
      id={`m-${m.id}`}
      tabIndex={tabIndex}
      onFocus={(e) => {
        if (e.target === e.currentTarget) onFocus();
      }}
      aria-keyshortcuts={mine ? "R E" : "R"}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          onReply();
        }
        if ((e.key === "e" || e.key === "E") && mine && canStillEdit(m.createdAt)) {
          e.preventDefault();
          onEdit();
        }
      }}
      className={cx(
        "group relative flex flex-col rounded-[1rem] outline-none focus-visible:bg-fg/[0.04] focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]",
        mine ? "items-end" : "items-start",
        first ? "mt-3" : "mt-0.5",
      )}
    >
      {first && !mine && showName && (
        <p className="mb-1 px-1 text-[0.86rem] font-bold text-fg-soft">{name}</p>
      )}
      <span className="sr-only">
        {mine ? "You" : name}, {timeFormat.format(at)}
        {m.editedAt ? ", edited" : ""}:
      </span>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut (double-click for a heart); the React button does the same from the keyboard. */}
      <div
        className={cx("flex max-w-[min(38rem,86%)] items-end gap-2", mine && "flex-row-reverse")}
        onDoubleClick={heart}
      >
        {!mine && avatar !== undefined && (
          <span className="w-8 shrink-0 self-end">
            {avatar && <Avatar user={avatar} size={32} />}
          </span>
        )}
        {folded ? (
          <button
            type="button"
            onClick={() => setUnfold(true)}
            className="rounded-[1.15rem] px-3.5 py-2 text-[0.92rem] text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)] hover:text-fg"
          >
            A message from someone you blocked · Show
          </button>
        ) : hiddenForMe ? (
          <p className="rounded-[1.15rem] px-3.5 py-2 text-[0.92rem] text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)]">
            Hidden after reports. A moderator will decide.
          </p>
        ) : editing ? (
          <EditBox message={m} channelId={channelId} onDone={onEditDone} />
        ) : (
          <div className={cx("flex min-w-0 flex-col gap-1", mine ? "items-end" : "items-start")}>
            {visual.length > 0 && <MediaGrid files={visual} />}
            {hasBubble ? (
              <div
                className={cx(
                  "min-w-0 rounded-[1.15rem] px-3.5 py-2 text-[1rem] leading-snug [overflow-wrap:anywhere] whitespace-pre-wrap",
                  mine
                    ? "bg-bubble-mine text-on-bubble-mine"
                    : "bg-bubble-theirs text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]",
                  mine
                    ? cx(!first && "rounded-tr-[0.45rem]", !last && "rounded-br-[0.45rem]")
                    : cx(!first && "rounded-tl-[0.45rem]", !last && "rounded-bl-[0.45rem]"),
                )}
              >
                {m.replyTo && (
                  <span
                    className={cx(
                      "mb-1.5 flex items-center gap-1.5 rounded-[0.7rem] px-2.5 py-1 text-[0.86rem]",
                      mine ? "bg-[rgb(0_0_0/0.12)]" : "bg-fg/[0.06] text-fg-soft",
                    )}
                  >
                    <ArrowBendUpLeft aria-hidden="true" size={14} className="shrink-0" />
                    <span className="truncate">
                      <span className="font-bold">{m.replyTo.author.displayName}</span>{" "}
                      {m.replyTo.content ?? "(deleted)"}
                    </span>
                  </span>
                )}
                {m.hidden && (
                  <span
                    className={cx(
                      "mb-1 block text-[0.78rem] font-bold",
                      mine ? "opacity-75" : "text-fg-soft",
                    )}
                  >
                    Hidden from others after reports
                  </span>
                )}
                {(files.length > 0 || m.place) && (
                  <span className={cx("flex flex-col gap-2 py-0.5", m.content && "mb-1.5")}>
                    {files.length > 0 && <FileList files={files} mine={mine} />}
                    {m.place && <PlaceCard place={m.place} mine={mine} />}
                  </span>
                )}
                {m.content}
                {(last || m.editedAt) && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      "ml-2 inline-block translate-y-px text-[0.74rem] whitespace-nowrap",
                      mine ? "opacity-70" : "text-fg-soft",
                    )}
                  >
                    {m.editedAt ? "edited" : ""}
                    {m.editedAt && last ? " · " : ""}
                    {last ? timeFormat.format(at) : ""}
                  </span>
                )}
              </div>
            ) : (
              last && (
                <span aria-hidden="true" className="px-1 text-[0.74rem] text-fg-soft">
                  {timeFormat.format(at)}
                </span>
              )
            )}
          </div>
        )}
        {!editing && !folded && !hiddenForMe && (
          <div
            className={cx(
              "hidden shrink-0 items-center gap-0.5 rounded-full bg-surface-raised p-0.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)] group-hover:flex group-focus-within:flex",
              confirming && "flex",
            )}
          >
            {confirming ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    remove(channelId, m.id).catch((err) => {
                      setConfirming(false);
                      setError(err instanceof ApiError ? err.message : "Couldn't delete it.");
                    })
                  }
                  className="h-8 rounded-full px-3 text-[0.86rem] font-bold text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)] hover:bg-danger-line/10"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="h-8 rounded-full px-3 text-[0.86rem] font-bold text-fg-soft hover:text-fg"
                >
                  Keep
                </button>
              </>
            ) : (
              <>
                {!last && (
                  <span
                    aria-hidden="true"
                    className="px-2 text-[0.78rem] whitespace-nowrap text-fg-soft"
                  >
                    {timeFormat.format(at)}
                  </span>
                )}
                {canReact && <ReactButton onPick={(e) => void toggle(e, true)} />}
                <ToolButton label="Reply" keys="R" onClick={onReply}>
                  <ArrowBendUpLeft size={16} />
                </ToolButton>
                {canPin && (
                  <ToolButton
                    label={m.pinned ? "Unpin" : "Pin"}
                    onClick={() =>
                      pinMessage(channelId, m.id, !m.pinned).catch((err) =>
                        setError(err instanceof ApiError ? err.message : "Couldn't pin it."),
                      )
                    }
                  >
                    {m.pinned ? <PushPinSlash size={16} /> : <PushPin size={16} />}
                  </ToolButton>
                )}
                {mine && canStillEdit(m.createdAt) && (
                  <ToolButton label="Edit" keys="E" onClick={onEdit}>
                    <PencilSimple size={16} />
                  </ToolButton>
                )}
                {canDelete && (
                  <ToolButton label="Delete" onClick={() => setConfirming(true)}>
                    <Trash size={16} />
                  </ToolButton>
                )}
                {!mine && (
                  <ToolButton label="Report" onClick={report}>
                    <Flag size={16} />
                  </ToolButton>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {!folded && !hiddenForMe && (
        <Reactions
          message={m}
          mine={mine}
          canReact={canReact}
          onToggle={(e, on) => void toggle(e, on)}
        />
      )}
      {seen && <p className="mt-0.5 px-1 text-[0.78rem] font-bold text-fg-soft">{seen}</p>}
      {error && (
        <p role="alert" className="mt-1 px-1 text-[0.86rem] text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

function ToolButton({
  label,
  keys,
  onClick,
  children,
}: {
  label: string;
  /** The key that does the same while the message is focused. */
  keys?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={keys ? `${label} (${keys})` : label}
      className="inline-flex size-8 items-center justify-center rounded-full text-fg-soft hover:bg-fg/10 hover:text-fg pointer-coarse:size-11"
    >
      <span aria-hidden="true">{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

function EditBox({
  message,
  channelId,
  onDone,
}: {
  message: Message;
  channelId: string;
  onDone: () => void;
}) {
  const [text, setText] = useState(message.content);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const save = async () => {
    const content = text.trim();
    if (!content || content === message.content) return onDone();
    setPending(true);
    try {
      await edit(channelId, message.id, content);
      onDone();
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiError ? err.message : "Couldn't save the edit.");
    }
  };

  return (
    <div className="w-[min(34rem,80vw)] rounded-[1.15rem] bg-surface-raised p-2 shadow-[inset_0_0_0_1.5px_var(--r-focus)]">
      <label htmlFor={`edit-${message.id}`} className="sr-only">
        Edit your message
      </label>
      <textarea
        id={`edit-${message.id}`}
        ref={ref}
        value={text}
        rows={Math.min(8, text.split("\n").length)}
        maxLength={Limits.message.max}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onDone();
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          }
        }}
        className="block w-full resize-none bg-transparent px-2 py-1.5 text-fg outline-none"
      />
      {error && (
        <p role="alert" className="px-2 text-[0.86rem] text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <span className="mr-auto px-2 text-[0.82rem] text-fg-soft">Enter saves · Esc cancels</span>
        <button type="button" onClick={onDone} className={pill("quiet", "sm")}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          aria-disabled={pending || undefined}
          className={pill("ghost", "sm")}
        >
          {pending ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}

function PendingBubble({ item }: { item: Outgoing }) {
  const failed = item.state === "failed";
  return (
    <li className="mt-0.5 flex flex-col items-end">
      <div
        className={cx(
          "max-w-[min(38rem,86%)] rounded-[1.15rem] px-3.5 py-2 leading-snug [overflow-wrap:anywhere] whitespace-pre-wrap",
          failed
            ? "bg-transparent text-fg shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]"
            : "bg-bubble-mine text-on-bubble-mine opacity-70",
        )}
      >
        {(item.attachments.length > 0 || item.place) && (
          <span className={cx("flex flex-col gap-2", item.content && "mb-1.5")}>
            {item.attachments.some(isVisual) && (
              <MediaGrid files={item.attachments.filter(isVisual)} />
            )}
            {item.attachments.some((f) => !isVisual(f)) && (
              <FileList files={item.attachments.filter((f) => !isVisual(f))} mine />
            )}
            {item.place && <PlaceCard place={item.place} mine />}
          </span>
        )}
        {item.content}
      </div>
      <p className="mt-1 px-1 text-[0.82rem] text-fg-soft" role={failed ? "alert" : undefined}>
        {failed ? (
          <>
            <span className="text-danger">{item.error ?? "Couldn't send."}</span>{" "}
            <button
              type="button"
              className={textLink}
              onClick={() => retry(item.channelId, item.nonce)}
            >
              Try again
            </button>{" "}
            ·{" "}
            <button
              type="button"
              className={textLink}
              onClick={() => discard(item.channelId, item.nonce)}
            >
              Discard
            </button>
          </>
        ) : (
          "Sending…"
        )}
      </p>
    </li>
  );
}
