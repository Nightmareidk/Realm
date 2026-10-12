"use client";

import { EnvelopeSimple, Headphones, SpeakerHigh, UserPlus } from "@phosphor-icons/react";
import type { Channel, PresenceStatus, SpaceDetail, UserSummary } from "@realm/contracts";
import Link from "next/link";
import { useEffect } from "react";
import { pill, textLink } from "@/components/pill";
import { useMessagePerson } from "@/features/messages/inbox";
import { loadMembers } from "@/features/realtime/actions";
import {
  openCreateSpace,
  openInvite,
  spaceRooms,
  spaceUnread,
  useRealm,
} from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { SpaceBadge, spaceLight } from "@/features/spaces/space-badge";
import { NewSpacePoster, SpacePoster } from "@/features/spaces/space-poster";
import { cx } from "@/lib/cx";

/** How many Spaces Home reads members from (enough for a friend group's handful). */
const PEOPLE_FROM = 8;

type Live = { space: SpaceDetail; room: Channel; people: string[] };
type Face = { user: UserSummary; status: PresenceStatus; voice: Live | null };

const rowScroll =
  "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none]";

/**
 * Home, "Wall" (the owner's pick, 2026-10-05): who's around from your Spaces as a row of faces,
 * what's live right now as a big tile you can drop into, then your Spaces as posters. Everything
 * is real: faces come from your Spaces' members and their presence, tiles from voice rooms with
 * people in them, posters from your Spaces (their banner, or their own colours).
 */
export function HomeWall({
  firstName,
  emailVerified,
}: {
  firstName: string;
  emailVerified: boolean;
}) {
  const spaces = useRealm((s) => s.spaces);
  const loaded = useRealm((s) => s.spacesLoaded);
  const voice = useRealm((s) => s.voice);
  const presence = useRealm((s) => s.presence);
  const members = useRealm((s) => s.members);
  const reads = useRealm((s) => s.reads);
  const meId = useRealm((s) => s.me?.id);

  // Faces need names: read the member lists of your first few Spaces (once each).
  const ids = spaces.slice(0, PEOPLE_FROM).map((sp) => sp.id);
  const key = ids.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the Space IDs, not the array.
  useEffect(() => {
    for (const id of ids) void loadMembers(id).catch(() => {});
  }, [key]);

  const users = new Map<string, UserSummary>();
  for (const id of ids) for (const m of members[id] ?? []) users.set(m.user.id, m.user);

  const live: Live[] = spaces.flatMap((space) =>
    spaceRooms(space)
      .filter((r) => r.type === "voice" && (voice[r.id]?.length ?? 0) > 0)
      .map((room) => ({ space, room, people: voice[room.id] ?? [] })),
  );
  const inVoice = new Map<string, Live>();
  for (const l of live) for (const id of l.people) inVoice.set(id, l);

  const rank = (f: Face) => (f.voice ? 0 : f.status === "online" ? 1 : 2);
  const faces: Face[] = [...users.values()]
    .filter((u) => u.id !== meId)
    .map((user) => ({
      user,
      status: presence[user.id] ?? "offline",
      voice: inVoice.get(user.id) ?? null,
    }))
    .filter((f) => f.status !== "offline")
    .sort((a, b) => rank(a) - rank(b) || a.user.displayName.localeCompare(b.user.displayName))
    .slice(0, 16);

  const hereIn = (space: SpaceDetail) =>
    (members[space.id] ?? []).filter(
      (m) => m.user.id !== meId && (presence[m.user.id] ?? "offline") !== "offline",
    ).length;

  return (
    <div className="mx-auto w-full max-w-[76rem] px-4 pt-5 pb-16 md:px-8 md:pt-1">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <h1 className="font-display text-[1.75rem] leading-[1.1] font-bold tracking-[-0.025em] text-fg md:text-[1.9rem]">
          Hey, {firstName}
        </h1>
        {!emailVerified && (
          <p className="text-[0.95rem] text-fg-soft">
            <EnvelopeSimple
              aria-hidden="true"
              size={17}
              className="mr-1.5 inline align-[-3px] text-fg-soft"
            />
            Confirm your email to finish setting up ·{" "}
            <Link href="/verify" className={cx(textLink, "whitespace-nowrap")}>
              Enter the code
            </Link>
          </p>
        )}
      </div>

      {loaded && spaces.length > 0 && (
        <section aria-labelledby="home-around" className="mt-6">
          <h2 id="home-around" className="sr-only">
            Around now
          </h2>
          <ul className={rowScroll}>
            {faces.map((f) => (
              <li key={f.user.id} className="w-[4.75rem] shrink-0 snap-start text-center">
                <FaceRing face={f} />
              </li>
            ))}
            <li className="w-[4.75rem] shrink-0 snap-start text-center">
              <button
                type="button"
                onClick={() => spaces[0] && openInvite(spaces[0].id)}
                className="group flex w-full flex-col items-center rounded-[1rem] outline-offset-2"
              >
                <span className="grid size-[4.25rem] place-items-center rounded-full border-[1.5px] border-dashed border-line-strong text-fg-soft transition-colors duration-150 ease-out group-hover:text-fg">
                  <UserPlus aria-hidden="true" size={24} />
                </span>
                <span className="mt-1.5 text-[0.85rem] font-bold text-fg">Invite</span>
                <span className="text-[0.75rem] text-fg-soft">Bring friends</span>
              </button>
            </li>
          </ul>
          {faces.length === 0 && (
            <p className="mt-1 text-[0.92rem] text-fg-soft">
              Nobody from your Spaces is around right now. They show up here when they are.
            </p>
          )}
        </section>
      )}

      {live.length > 0 && (
        <section aria-labelledby="home-live" className="mt-7">
          <h2 id="home-live" className="mb-3 text-[1.05rem] font-bold text-fg">
            Live now
          </h2>
          <ul
            className={cx(
              "grid grid-cols-[minmax(0,1fr)] gap-4",
              live.length > 1 && "lg:grid-cols-[repeat(2,minmax(0,1fr))]",
            )}
          >
            {live.slice(0, 4).map((l) => (
              <li key={l.room.id}>
                <LiveTile live={l} users={users} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="home-spaces" className="mt-8">
        <h2
          id="home-spaces"
          className="mb-3 flex items-baseline gap-2 text-[1.05rem] font-bold text-fg"
        >
          Your Spaces
          {spaces.length > 0 && (
            <span className="text-[0.92rem] font-semibold text-fg-soft">{spaces.length}</span>
          )}
        </h2>
        {!loaded ? (
          <p role="status" className="text-fg-soft">
            Loading your Spaces…
          </p>
        ) : spaces.length === 0 ? (
          <div className="max-w-[40rem] border-t border-line pt-6">
            <p className="font-display text-[1.3rem] font-bold tracking-[-0.02em] text-fg">
              Start a Space for your crew
            </p>
            <p className="mt-2 text-fg-soft">
              Rooms to talk in, voice to hang out in, and who's here now, for the people you
              actually hang out with. Or find a public one to join.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openCreateSpace()}
                className={pill("action", "md")}
              >
                Start a Space
              </button>
              <Link href="/explore" className={pill("ghost", "md")}>
                Explore public Spaces
              </Link>
            </div>
          </div>
        ) : (
          <ul className={rowScroll}>
            {spaces.map((sp) => {
              const l = live.find((x) => x.space.id === sp.id);
              const n = hereIn(sp);
              return (
                <li key={sp.id} className="shrink-0 snap-start">
                  <SpacePoster
                    space={sp}
                    unread={spaceUnread(reads, sp)}
                    className="w-[10rem] md:w-[11.75rem]"
                    status={
                      l ? (
                        <span className="inline-flex items-center gap-1.5 font-bold text-presence">
                          <span aria-hidden="true" className="size-2 rounded-full bg-presence" />
                          {l.room.name}
                        </span>
                      ) : n > 0 ? (
                        `${n} here now`
                      ) : (
                        "Quiet right now"
                      )
                    }
                  />
                </li>
              );
            })}
            <li className="shrink-0 snap-start">
              <NewSpacePoster className="w-[10rem] md:w-[11.75rem]" />
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}

/** One face: their picture in a presence ring (a speaker on it while they're in voice). */
function FaceRing({ face }: { face: Face }) {
  const { user, status, voice } = face;
  const message = useMessagePerson();
  const ring =
    status === "online"
      ? "shadow-[inset_0_0_0_2.5px_var(--r-presence)]"
      : "shadow-[inset_0_0_0_2.5px_var(--r-border-strong)]";
  const where = voice
    ? voice.room.name
    : status === "online"
      ? "Around"
      : status === "idle"
        ? "Away"
        : "Busy";
  const body = (
    <>
      <span className={cx("relative grid size-[4.25rem] place-items-center rounded-full", ring)}>
        <Avatar user={user} size={58} />
        {voice && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full bg-presence text-[#04150f] shadow-[0_0_0_3px_var(--r-surface)]"
          >
            <SpeakerHigh size={13} weight="bold" />
          </span>
        )}
      </span>
      <span className="mt-1.5 block w-full truncate text-[0.85rem] font-bold text-fg">
        {user.displayName}
      </span>
      <span className="block w-full truncate text-[0.75rem] text-fg-soft">
        {voice ? <span className="sr-only">In voice: </span> : null}
        {where}
      </span>
    </>
  );
  return voice ? (
    <Link
      href={`/spaces/${voice.space.slug}/${voice.room.name}`}
      className="flex flex-col items-center rounded-[1rem] outline-offset-2"
    >
      {body}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => void message(user.id).catch(() => {})}
      className="flex w-full flex-col items-center rounded-[1rem] outline-offset-2"
    >
      {body}
      <span className="sr-only"> (send a message)</span>
    </button>
  );
}

/** A voice room with people in it: its Space's banner or colours, who's in, and Join. */
function LiveTile({ live, users }: { live: Live; users: Map<string, UserSummary> }) {
  const { space, room, people } = live;
  const shown = people.slice(0, 4);
  const names = people.map((id) => users.get(id)?.displayName).filter(Boolean) as string[];
  const who =
    names.length === 0
      ? `${people.length} in the room`
      : names.length <= 2
        ? `${names.join(" and ")} ${names.length === 1 ? "is" : "are"} in`
        : `${names.slice(0, 2).join(", ")} and ${people.length - 2} more are in`;
  return (
    <Link
      href={`/spaces/${space.slug}/${room.name}`}
      className="group relative flex min-h-[10.5rem] items-end gap-4 overflow-hidden rounded-[1.375rem] p-5 outline-offset-4 md:p-6"
    >
      {space.bannerUrl ? (
        // biome-ignore lint/performance/noImgElement: an uploaded banner behind an access check.
        <img
          src={space.bannerUrl}
          alt=""
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: spaceLight(space.accent) }}
        />
      )}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgb(11_11_14/0.86),rgb(11_11_14/0.35)_60%,rgb(11_11_14/0.1))] max-md:bg-[linear-gradient(180deg,rgb(11_11_14/0.1),rgb(11_11_14/0.85))]"
      />
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2.5">
          <SpaceBadge name={space.name} accent={space.accent} size={30} />
          <span className="truncate font-display text-[1.6rem] leading-tight font-bold tracking-[-0.02em] text-fg">
            {room.name}
          </span>
        </span>
        <span className="mt-1.5 block truncate text-[0.95rem] text-fg-soft">
          <span className="font-bold text-presence">
            <span
              aria-hidden="true"
              className="mr-1.5 inline-block size-2 rounded-full bg-presence align-[1px]"
            />
            Live
          </span>{" "}
          · {space.name} · {who}
        </span>
      </span>
      <span className="relative flex shrink-0 items-center gap-3 max-sm:hidden">
        <span className="flex">
          {shown.map((id, i) => {
            const u = users.get(id);
            return u ? (
              <Avatar
                key={id}
                user={u}
                size={44}
                className={cx("shadow-[0_0_0_3px_rgb(20_14_14)]", i > 0 && "-ml-3")}
              />
            ) : null;
          })}
        </span>
      </span>
      <span className={pill("action", "md", "relative shrink-0")}>
        <Headphones aria-hidden="true" size={19} />
        Join
        <span className="sr-only">
          {" "}
          {room.name} in {space.name}
        </span>
      </span>
    </Link>
  );
}
