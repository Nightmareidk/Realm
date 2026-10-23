"use client";

import { Plus, ShieldCheck, SpeakerHigh } from "@phosphor-icons/react";
import type { Conversation, SelfUser, SpaceDetail } from "@realm/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/features/home/chrome";
import {
  conversationUnread,
  isMuted,
  openCreateSpace,
  type RealmState,
  spaceRooms,
  spaceUnread,
  useRealm,
} from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { SpaceBadge } from "@/features/spaces/space-badge";
import { VoiceDock } from "@/features/voice/voice-dock";
import { cx } from "@/lib/cx";
import { CreateMenu, YouMenu } from "./menus";
import { DESTINATIONS, isActive } from "./nav";

/** Look B's menu rows: 46px, bold, soft until you're there. */
export const navRow =
  "flex h-[46px] w-full items-center gap-3.5 rounded-xl px-3 text-[1rem] font-bold text-fg-soft transition-colors duration-150 ease-out hover:bg-fg/6 hover:text-fg aria-[current=page]:bg-fg/8 aria-[current=page]:text-fg aria-expanded:bg-fg/8 aria-expanded:text-fg";

/** How many people are in this Space's voice rooms. */
const inVoice = (voice: RealmState["voice"], space: SpaceDetail) =>
  new Set(spaceRooms(space).flatMap((r) => (r.type === "voice" ? (voice[r.id] ?? []) : []))).size;

/** A Space's badge, with a small green speaker on its corner while someone's in voice there. */
export function LiveBadge({
  space,
  live,
  size,
  cut = "var(--r-surface)",
}: {
  space: SpaceDetail;
  live: boolean;
  size: number;
  /** The colour behind the badge, so the speaker dot reads as cut out of it. */
  cut?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <SpaceBadge name={space.name} accent={space.accent} size={size} />
      {live && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-presence"
          style={{ boxShadow: `0 0 0 2.5px ${cut}` }}
        >
          <SpeakerHigh size={10} weight="bold" className="text-[#04150f]" />
        </span>
      )}
    </span>
  );
}

type Filter = "all" | "spaces" | "groups";

/**
 * "Your places" (Look B): your Spaces and your chats in one list, with what's live in each (who's
 * in voice, who's active). All, Spaces, or Groups and chats.
 */
function Places({ pathname }: { pathname: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const spaces = useRealm((s) => s.spaces);
  const loaded = useRealm((s) => s.spacesLoaded);
  const conversations = useRealm((s) => s.conversations);
  const reads = useRealm((s) => s.reads);
  const voice = useRealm((s) => s.voice);
  const presence = useRealm((s) => s.presence);
  const me = useRealm((s) => s.me?.id);
  const state = useRealm((s) => s);
  const chats = conversations
    .filter((c) => !c.request)
    .slice()
    .sort((a, b) => (b.lastMessage?.id ?? b.id).localeCompare(a.lastMessage?.id ?? a.id))
    .slice(0, 12);

  const spaceRow = (sp: SpaceDetail) => {
    const n = inVoice(voice, sp);
    const unread = spaceUnread(reads, sp) && !isMuted(state, "community", sp.id);
    const current = isActive(pathname, `/spaces/${sp.slug}`);
    return (
      <li key={`s${sp.id}`}>
        <Link
          href={`/spaces/${sp.slug}`}
          aria-current={current ? "page" : undefined}
          className="flex items-center gap-3 rounded-xl px-3 py-[7px] transition-colors duration-150 hover:bg-fg/6 aria-[current=page]:bg-fg/8"
        >
          <LiveBadge space={sp} live={n > 0} size={46} />
          <span className="min-w-0 flex-1">
            <span
              className={cx(
                "block truncate text-[0.95rem] font-bold",
                unread ? "text-fg" : "text-fg",
              )}
            >
              {sp.name}
            </span>
            {n > 0 ? (
              <span className="block truncate text-[0.82rem] text-presence">● {n} in voice</span>
            ) : (
              <span className="block truncate text-[0.82rem] text-fg-soft">
                Space · {sp.memberCount} {sp.memberCount === 1 ? "member" : "members"}
              </span>
            )}
          </span>
          {unread && (
            <>
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
              <span className="sr-only"> (new messages)</span>
            </>
          )}
        </Link>
      </li>
    );
  };

  const chatRow = (c: Conversation) => {
    const others = c.recipients.filter((r) => r.id !== me);
    const group = c.type === "group_dm";
    const first = others[0];
    const name = c.name ?? (others.map((o) => o.displayName).join(", ") || "Just you");
    const active = !group && first && presence[first.id] === "online";
    const unread = conversationUnread(reads, c, me) && !isMuted(state, "channel", c.id);
    const current = isActive(pathname, `/messages/${c.id}`);
    return (
      <li key={`c${c.id}`}>
        <Link
          href={`/messages/${c.id}`}
          aria-current={current ? "page" : undefined}
          className="flex items-center gap-3 rounded-xl px-3 py-[7px] transition-colors duration-150 hover:bg-fg/6 aria-[current=page]:bg-fg/8"
        >
          {group && others.length > 1 ? (
            <span className="relative size-[46px] shrink-0">
              <span className="absolute top-0 left-0 rounded-full shadow-[0_0_0_3px_var(--r-surface)]">
                <Avatar user={others[0] as (typeof others)[number]} size={32} />
              </span>
              <span className="absolute right-0 bottom-0 rounded-full shadow-[0_0_0_3px_var(--r-surface)]">
                <Avatar user={others[1] as (typeof others)[number]} size={32} />
              </span>
            </span>
          ) : first ? (
            <span className="relative shrink-0">
              <Avatar user={first} size={46} />
              {active && (
                <span className="absolute right-0 bottom-0 size-3.5 rounded-full bg-presence shadow-[0_0_0_2.5px_var(--r-surface)]" />
              )}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span
              className={cx(
                "block truncate text-[0.95rem]",
                unread ? "font-extrabold text-fg" : "font-bold text-fg",
              )}
            >
              {name}
            </span>
            <span
              className={cx(
                "block truncate text-[0.82rem]",
                active ? "text-presence" : "text-fg-soft",
              )}
            >
              {group ? `Group · ${others.length + 1} people` : active ? "● Active now" : "Message"}
            </span>
          </span>
          {unread && (
            <>
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
              <span className="sr-only"> (new messages)</span>
            </>
          )}
        </Link>
      </li>
    );
  };

  const shown = [
    ...(filter !== "groups" ? spaces.map(spaceRow) : []),
    ...(filter !== "spaces" ? chats.map(chatRow) : []),
  ];

  return (
    <section aria-labelledby="your-places" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between pr-2 pl-3">
        <h2 id="your-places" className="font-display text-[1rem] font-bold text-fg">
          Your places
        </h2>
        <button
          type="button"
          onClick={() => openCreateSpace()}
          title="Start a Space"
          className="inline-flex size-8 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
        >
          <Plus aria-hidden="true" size={18} />
          <span className="sr-only">Start a Space</span>
        </button>
      </div>
      <div className="flex gap-1.5 px-3 pt-2.5 pb-3">
        {(
          [
            ["all", "All"],
            ["spaces", "Spaces"],
            ["groups", "Chats"],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={cx(
              "h-[30px] rounded-full px-3 text-[0.82rem] font-bold transition-colors duration-150",
              filter === k ? "bg-fg text-base" : "bg-fg/8 text-fg-soft hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
        {!loaded ? (
          <p role="status" className="px-3 text-[0.92rem] text-fg-soft">
            Loading your places…
          </p>
        ) : shown.length === 0 ? (
          <p className="px-3 text-[0.92rem] leading-snug text-fg-soft">
            {filter === "groups"
              ? "No chats yet. Message someone from their profile."
              : "No Spaces yet. Start one with the +, or open an invite link."}
          </p>
        ) : (
          <ul className="space-y-0.5">{shown}</ul>
        )}
        {filter !== "groups" && loaded && (
          <Link
            href="/spaces"
            className="mt-1 block rounded-xl px-3 py-2 text-[0.88rem] font-bold text-fg-soft hover:text-fg"
          >
            All Spaces and Explore
          </Link>
        )}
      </div>
    </section>
  );
}

/**
 * The left of the Look B frame: a panel with where you can go (and Create), and a panel with your
 * places and you at the foot. A call you're in docks above you.
 */
export function NavColumn({ viewer }: { viewer: SelfUser }) {
  const pathname = usePathname();
  const waiting = useMessagesWaiting();
  const live = useRealm((s) => s.me);
  const username = live?.username ?? viewer.username;
  return (
    <>
      <div className="r-panel shrink-0 px-3 pt-5 pb-2.5">
        <Link
          href="/home"
          aria-label="Realm home"
          className="mb-[18px] ml-3 inline-flex rounded-full text-fg [&_span:last-child]:text-[1.6rem]"
        >
          <Wordmark />
        </Link>
        <nav aria-label="Realm">
          <ul>
            {DESTINATIONS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link href={href} aria-current={active ? "page" : undefined} className={navRow}>
                    <Icon aria-hidden="true" size={24} weight={active ? "fill" : "regular"} />
                    <span className="flex-1">{label}</span>
                    {href === "/messages" && waiting > 0 && (
                      <>
                        <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
                        <span className="sr-only"> ({waiting} with new messages)</span>
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
            <li>
              <CreateMenu variant="row" />
            </li>
            <li>
              <Link
                href={`/u/${username}`}
                aria-current={isActive(pathname, `/u/${username}`) ? "page" : undefined}
                className={navRow}
              >
                <Avatar
                  user={{
                    id: viewer.id,
                    displayName: live?.displayName ?? viewer.displayName,
                    avatarUrl: live?.avatarUrl ?? viewer.avatarUrl,
                  }}
                  size={24}
                />
                <span className="flex-1">You</span>
              </Link>
            </li>
            {viewer.staff && (
              <li>
                <Link
                  href="/admin"
                  aria-current={isActive(pathname, "/admin") ? "page" : undefined}
                  className={navRow}
                >
                  <ShieldCheck aria-hidden="true" size={24} />
                  <span className="flex-1">Admin</span>
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
      <div className="r-panel flex min-h-0 flex-1 flex-col px-3 pt-4 pb-2">
        <Places pathname={pathname} />
        <div className="pt-2">
          <VoiceDock className="mb-2" />
          <YouMenu viewer={viewer} variant="row" />
        </div>
      </div>
    </>
  );
}

/** How many conversations have something new for you (muted ones stay quiet). */
export function useMessagesWaiting() {
  return useRealm(
    (s) =>
      s.conversations.filter(
        (c) =>
          !c.request && conversationUnread(s.reads, c, s.me?.id) && !isMuted(s, "channel", c.id),
      ).length,
  );
}
