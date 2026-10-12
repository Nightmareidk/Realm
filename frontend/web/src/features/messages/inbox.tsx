"use client";

import { BellSlash, MagnifyingGlass, NotePencil, PushPin } from "@phosphor-icons/react";
import type { Conversation, PresenceStatus } from "@realm/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { pill } from "@/components/pill";
import { openConversation } from "@/features/realtime/actions";
import {
  conversationTitle,
  conversationUnread,
  isMuted,
  useRealm,
} from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { cx } from "@/lib/cx";
import { ConversationAvatar, previewLine, shortWhen } from "./parts";

type Filter = "all" | "unread" | "groups";

/**
 * The inbox: who's around (a row of faces you can tap to talk to), then your conversations,
 * pinned first, each with its newest line, when, and whether something's waiting for you.
 */
export function Inbox({ activeId, onNew }: { activeId: string | null; onNew: () => void }) {
  const conversations = useRealm((s) => s.conversations);
  const loaded = useRealm((s) => s.conversationsLoaded);
  const reads = useRealm((s) => s.reads);
  const presence = useRealm((s) => s.presence);
  const meId = useRealm((s) => s.me?.id);
  const state = useRealm((s) => s);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && !conversationUnread(reads, c, meId)) return false;
      if (filter === "groups" && c.type !== "group_dm") return false;
      if (!q) return true;
      return (
        conversationTitle(c).toLowerCase().includes(q) ||
        c.recipients.some(
          (r) => r.displayName.toLowerCase().includes(q) || r.username.toLowerCase().includes(q),
        )
      );
    });
  }, [conversations, filter, query, reads, meId]);

  // People you talk to one-to-one who are around right now.
  const around = conversations
    .filter((c) => c.type === "dm")
    .flatMap((c) => c.recipients.slice(0, 1).map((r) => ({ r, c })))
    .filter(({ r }) => presence[r.id] === "online" || presence[r.id] === "idle")
    .slice(0, 12);

  const unreadCount = conversations.filter((c) => conversationUnread(reads, c, meId)).length;

  return (
    <div className="flex min-h-0 flex-col md:h-full">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 md:px-5 md:pt-1">
        <h1 className="flex-1 font-display text-[1.75rem] leading-[1.1] font-bold tracking-[-0.025em] text-fg md:text-[1.9rem]">
          Messages
        </h1>
        <button
          type="button"
          onClick={onNew}
          title="New message"
          className="inline-flex size-10 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
        >
          <NotePencil aria-hidden="true" size={22} />
          <span className="sr-only">New message</span>
        </button>
      </div>

      <div className="px-4 md:px-5">
        <div className="relative">
          <MagnifyingGlass
            aria-hidden="true"
            size={17}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-soft"
          />
          <label htmlFor="inbox-search" className="sr-only">
            Search your messages
          </label>
          <input
            id="inbox-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people and groups"
            autoComplete="off"
            className="h-10 w-full rounded-full bg-fg/[0.05] pr-3 pl-10 text-[0.95rem] text-fg outline-none placeholder:text-fg-muted focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
          />
        </div>
        <fieldset className="mt-3 flex min-w-0 gap-1.5 border-0 p-0">
          <legend className="sr-only">Show</legend>
          {(
            [
              ["all", "All"],
              ["unread", unreadCount ? `Unread ${unreadCount}` : "Unread"],
              ["groups", "Groups"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cx(
                "h-8 rounded-full px-3.5 text-[0.88rem] font-semibold transition-colors duration-150",
                filter === id
                  ? "bg-fg/8 text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
                  : "text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)] hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </div>

      {around.length > 0 && !query && filter === "all" && (
        <section aria-labelledby="inbox-around" className="mt-4">
          <h2 id="inbox-around" className="sr-only">
            Around now
          </h2>
          <ul className="flex gap-3 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none] md:px-5">
            {around.map(({ r, c }) => (
              <li key={r.id} className="w-[3.75rem] shrink-0 text-center">
                <Link
                  href={`/messages/${c.id}`}
                  className="flex flex-col items-center rounded-[0.9rem] outline-offset-2"
                >
                  <span className="grid size-[3.5rem] place-items-center rounded-full shadow-[inset_0_0_0_2.5px_var(--r-presence)]">
                    <Avatar user={r} size={46} />
                  </span>
                  <span className="mt-1 block w-full truncate text-[0.78rem] font-semibold text-fg">
                    {r.displayName.split(/\s+/)[0]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Conversations" className="mt-3 min-h-0 flex-1 md:overflow-y-auto">
        {!loaded ? (
          <p role="status" className="px-5 py-6 text-fg-soft">
            Loading your messages…
          </p>
        ) : conversations.length === 0 ? (
          <div className="px-5 py-8">
            <p className="font-display text-[1.2rem] font-bold tracking-[-0.02em] text-fg">
              No messages yet
            </p>
            <p className="mt-2 max-w-[30ch] text-[0.95rem] text-fg-soft">
              Message someone from your Spaces, one to one or as a group.
            </p>
            <button type="button" onClick={onNew} className={pill("action", "md", "mt-5")}>
              <NotePencil aria-hidden="true" size={18} />
              New message
            </button>
          </div>
        ) : shown.length === 0 ? (
          <p className="px-5 py-6 text-[0.95rem] text-fg-soft">
            {query ? "Nobody by that name here." : "Nothing here right now."}
          </p>
        ) : (
          <ul className="px-2 pb-6 md:px-3">
            {shown.map((c) => (
              <li key={c.id}>
                <Row
                  conversation={c}
                  active={c.id === activeId}
                  unread={conversationUnread(reads, c, meId)}
                  muted={isMuted(state, "channel", c.id)}
                  meId={meId}
                  presence={presence}
                />
              </li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}

function Row({
  conversation: c,
  active,
  unread,
  muted,
  meId,
  presence,
}: {
  conversation: Conversation;
  active: boolean;
  unread: boolean;
  muted: boolean;
  meId: string | undefined;
  presence: Record<string, PresenceStatus>;
}) {
  const title = conversationTitle(c);
  return (
    <Link
      href={`/messages/${c.id}`}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center gap-3 rounded-[1rem] px-2.5 py-2.5 transition-colors duration-150 ease-out hover:bg-fg/[0.05]",
        active && "bg-fg/8 hover:bg-fg/8",
      )}
    >
      <ConversationAvatar
        conversation={c}
        presence={presence}
        ring={active ? "#1e1e24" : "var(--r-surface)"}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={cx(
              "min-w-0 flex-1 truncate text-[0.98rem]",
              unread ? "font-bold text-fg" : "font-semibold text-fg",
            )}
          >
            {title}
          </span>
          {c.lastMessage && (
            <time
              dateTime={c.lastMessage.createdAt}
              className={cx(
                "shrink-0 text-[0.78rem]",
                unread ? "font-bold text-fg" : "text-fg-soft",
              )}
            >
              {shortWhen(c.lastMessage.createdAt)}
            </time>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <span
            className={cx(
              "min-w-0 flex-1 truncate text-[0.88rem]",
              unread ? "font-semibold text-fg" : "text-fg-soft",
            )}
          >
            {previewLine(c, meId)}
          </span>
          {c.pinned && (
            <PushPin
              aria-label="Pinned"
              size={14}
              weight="fill"
              className="shrink-0 text-fg-soft"
            />
          )}
          {muted && <BellSlash aria-label="Muted" size={14} className="shrink-0 text-fg-soft" />}
          {unread && (
            <>
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-accent" />
              <span className="sr-only">(new messages)</span>
            </>
          )}
        </span>
      </span>
    </Link>
  );
}

/** Start (or reopen) a DM with someone, then go there. */
export function useMessagePerson() {
  const router = useRouter();
  return async (userId: string) => {
    const c = await openConversation([userId]);
    router.push(`/messages/${c.id}`);
  };
}
