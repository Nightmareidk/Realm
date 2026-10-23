"use client";

import { Plus, ShieldCheck, SpeakerHigh } from "@phosphor-icons/react";
import type { SelfUser, SpaceDetail } from "@realm/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { SpaceBadge } from "@/features/spaces/space-badge";
import { VoiceDock } from "@/features/voice/voice-dock";
import { cx } from "@/lib/cx";
import { YouMenu } from "./menus";
import { DESTINATIONS, isActive } from "./nav";

const navRow =
  "flex h-12 items-center gap-3.5 rounded-[0.9rem] px-3 text-[1rem] font-semibold text-fg-soft transition-colors duration-150 ease-out hover:bg-fg/6 hover:text-fg aria-[current=page]:bg-fg/8 aria-[current=page]:text-fg";
const spaceRow =
  "flex h-11 items-center gap-3 rounded-[0.8rem] px-2.5 text-[0.95rem] font-semibold text-fg-soft transition-colors duration-150 ease-out hover:bg-fg/6 hover:text-fg aria-[current=page]:bg-fg/8 aria-[current=page]:text-fg";

/** Someone's in one of this Space's voice rooms right now. */
export const spaceLive = (s: Pick<RealmState, "voice">, space: SpaceDetail) =>
  spaceRooms(space).some((r) => r.type === "voice" && (s.voice[r.id]?.length ?? 0) > 0);

/** A Space's badge, with a small green speaker on its corner while someone's in voice there. */
export function LiveBadge({
  space,
  live,
  size,
  cut = "var(--r-bg)",
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

/** Your Spaces by name, with a dot where something new was said and a speaker where it's live. */
function SpacesList({ pathname }: { pathname: string }) {
  const spaces = useRealm((s) => s.spaces);
  const loaded = useRealm((s) => s.spacesLoaded);
  const reads = useRealm((s) => s.reads);
  const mutes = useRealm((s) => s.mutes);
  const voice = useRealm((s) => s.voice);
  const muted = (id: string) =>
    mutes.some(
      (m) =>
        m.targetType === "community" &&
        m.targetId === id &&
        (!m.until || Date.parse(m.until) > Date.now()),
    );
  return (
    <section aria-labelledby="nav-spaces" className="min-h-0">
      <div className="flex items-center justify-between pr-1 pl-3">
        <p id="nav-spaces" className="r-heading py-1.5 text-[0.82rem] font-bold">
          Your Spaces
        </p>
        <button
          type="button"
          onClick={() => openCreateSpace()}
          title="Start a Space"
          className="inline-flex size-8 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
        >
          <Plus aria-hidden="true" size={17} />
          <span className="sr-only">Start a Space</span>
        </button>
      </div>
      {!loaded ? (
        <p role="status" className="px-3 pt-1 text-[0.92rem] text-fg-soft">
          Loading your Spaces…
        </p>
      ) : spaces.length === 0 ? (
        <p className="px-3 pt-1 text-[0.92rem] leading-snug text-fg-soft">
          None yet. Start one with the +, or open an invite link.
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {spaces.map((sp) => {
            // A muted Space stays quiet: no dot.
            const unread = spaceUnread(reads, sp) && !muted(sp.id);
            const live = spaceLive({ voice }, sp);
            const current = isActive(pathname, `/spaces/${sp.slug}`);
            return (
              <li key={sp.id}>
                <Link
                  href={`/spaces/${sp.slug}`}
                  aria-current={current ? "page" : undefined}
                  className={cx(spaceRow, unread && "text-fg")}
                >
                  <LiveBadge
                    space={sp}
                    live={live}
                    size={28}
                    cut={current ? "#1a1a1f" : undefined}
                  />
                  <span className="min-w-0 flex-1 truncate">{sp.name}</span>
                  {live && <span className="sr-only"> (someone's in voice)</span>}
                  {unread && (
                    <>
                      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-fg" />
                      <span className="sr-only"> (new messages)</span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * The nav column (from 48rem): the wordmark, the five destinations with their names (never bare
 * icons), your Spaces, and you at the foot. A call you're in docks above you from 64rem.
 */
export function NavColumn({ viewer }: { viewer: SelfUser }) {
  const pathname = usePathname();
  const waiting = useMessagesWaiting();
  return (
    <>
      <Link
        href="/home"
        aria-label="Realm home"
        className="mb-5 ml-2.5 self-start rounded-full text-fg [&_span:last-child]:text-[1.45rem]"
      >
        <Wordmark />
      </Link>
      <nav aria-label="Realm">
        <ul className="space-y-0.5">
          {DESTINATIONS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={navRow}>
                  <Icon aria-hidden="true" size={22} weight={active ? "fill" : "regular"} />
                  <span className="flex-1">{label}</span>
                  {href === "/messages" && waiting > 0 && (
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-[0.78rem] font-bold text-on-accent tabular-nums">
                      {waiting}
                      <span className="sr-only"> conversations with new messages</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          {viewer.staff && (
            <li>
              <Link
                href="/admin"
                aria-current={isActive(pathname, "/admin") ? "page" : undefined}
                className={navRow}
              >
                <ShieldCheck
                  aria-hidden="true"
                  size={22}
                  weight={isActive(pathname, "/admin") ? "fill" : "regular"}
                />
                <span className="flex-1">Admin</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      <div aria-hidden="true" className="mx-3 my-4 h-px shrink-0 bg-line" />
      <SpacesList pathname={pathname} />
      <div className="mt-auto pt-4">
        <VoiceDock className="mb-2 max-lg:hidden" />
        <YouMenu viewer={viewer} variant="row" />
      </div>
    </>
  );
}

/** How many conversations have something new for you (muted ones stay quiet). */
export function useMessagesWaiting() {
  return useRealm(
    (s) =>
      s.conversations.filter(
        (c) => conversationUnread(s.reads, c, s.me?.id) && !isMuted(s, "channel", c.id),
      ).length,
  );
}
