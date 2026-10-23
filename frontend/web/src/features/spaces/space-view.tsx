"use client";

import {
  CaretDown,
  CaretLeft,
  Headphones,
  Lock,
  SpeakerHigh,
  Timer,
  UserPlus,
} from "@phosphor-icons/react";
import type { Channel, SpaceDetail } from "@realm/contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { pill, textLink } from "@/components/pill";
import { useHerePanel } from "@/features/app/here-context";
import { roomScope } from "@/features/chat/scope";
import { loadMembers } from "@/features/realtime/actions";
import {
  chatRooms,
  findSpaceBySlug,
  openInvite,
  roomUnread,
  spaceRooms,
  useRealm,
} from "@/features/realtime/store";
import { VoiceRoom } from "@/features/voice/voice-room";
import { cx } from "@/lib/cx";
import { Chat } from "./chat";
import { Permission, spaceCan } from "./permissions";
import { Avatar } from "./person";
import { SpaceBadge } from "./space-badge";
import { SpaceMenu } from "./space-menu";

/** A Space: its name, its rooms as tabs across the top, and the room you're in below. */
export function SpaceView({ slug, room: roomName }: { slug: string; room?: string }) {
  const space = useRealm((s) => findSpaceBySlug(s, slug));
  const loaded = useRealm((s) => s.spacesLoaded);
  const router = useRouter();
  const params = useSearchParams();
  const rooms = space ? spaceRooms(space) : [];
  const room =
    rooms.find((r) => r.name === roomName?.toLowerCase()) ??
    (space ? chatRooms(space)[0] : undefined);
  const wantsInvite = params.get("invite") === "1";

  // The address always names the room you're in. `?invite=1` (from Home) opens the invite sheet.
  useEffect(() => {
    if (!space || !room) return;
    if (wantsInvite) openInvite(space.id);
    if (wantsInvite || room.name !== roomName || space.slug !== slug) {
      router.replace(`/spaces/${space.slug}/${room.name}`);
    }
  }, [space, room, roomName, slug, router, wantsInvite]);

  const spaceId = space?.id;
  useEffect(() => {
    if (spaceId) void loadMembers(spaceId).catch(() => {});
  }, [spaceId]);

  useEffect(() => {
    if (space && room) document.title = `#${room.name} · ${space.name} | Realm`;
  }, [space, room]);

  if (!space) {
    if (!loaded) {
      return (
        <p role="status" className="px-6 py-16 text-center text-fg-soft">
          Opening the Space…
        </p>
      );
    }
    return (
      <div className="mx-auto max-w-[40rem] px-6 py-16">
        <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-[-0.035em] text-fg">
          This Space isn't here.
        </h1>
        <p className="mt-3 text-fg-soft">
          It may have been deleted, or you're not in it. Ask someone inside for an invite.
        </p>
        <Link href="/spaces" className={cx(textLink, "mt-6 inline-block")}>
          Your Spaces
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col md:h-auto md:flex-1">
      <SpaceHeader space={space} roomId={room?.id ?? null} />
      <div className="flex min-h-0 flex-1">
        <RoomsColumn space={space} roomId={room?.id ?? null} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {room && <LiveStrip space={space} here={room} />}
          {room ? (
            room.type === "voice" ? (
              <VoiceRoom key={room.id} space={space} room={room} />
            ) : (
              <RoomChat key={room.id} space={space} room={room} />
            )
          ) : (
            <p className="px-6 py-16 text-center text-fg-soft">
              This Space has no rooms you can see yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SpaceHeader({ space, roomId }: { space: SpaceDetail; roomId: string | null }) {
  const reads = useRealm((s) => s.reads);
  const members = useRealm((s) => s.members[space.id]);
  const presence = useRealm((s) => s.presence);
  const here = useHerePanel();
  const voice = useRealm((s) => s.voice);
  const strip = useRef<HTMLElement>(null);

  // The room you're in scrolls into view in the strip.
  useEffect(() => {
    strip.current
      ?.querySelector(`[data-room="${roomId}"]`)
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [roomId]);
  const rooms = spaceRooms(space);
  const canInvite = spaceCan(space, Permission.CREATE_INVITES);
  const hereNow = members?.filter((m) => {
    const p = presence[m.user.id];
    return p && p !== "offline";
  }).length;

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-line px-2 pt-2 pb-2.5 md:px-6 md:pt-0">
      {/* flex-1 with a zero basis: the name shrinks and truncates before the row would wrap. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          href="/spaces"
          className="-mr-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg md:hidden"
        >
          <CaretLeft aria-hidden="true" size={22} />
          <span className="sr-only">Your Spaces</span>
        </Link>
        <SpaceBadge name={space.name} accent={space.accent} size={40} />
        <div className="min-w-0">
          <h1 className="truncate font-display text-[1.2rem] leading-tight font-bold tracking-[-0.02em] text-fg md:text-[1.5rem]">
            {space.name}
          </h1>
          <p className="flex items-center gap-1.5 text-[0.85rem] text-fg-soft">
            <span className="max-sm:hidden">
              {space.memberCount} {space.memberCount === 1 ? "member" : "members"}
            </span>
            {hereNow !== undefined && (
              <>
                <span aria-hidden="true" className="max-sm:hidden">
                  ·
                </span>
                <button
                  type="button"
                  onClick={here.toggle}
                  aria-expanded={here.open}
                  aria-controls="here-now"
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full font-bold hover:underline",
                    hereNow > 0 ? "text-presence" : "text-fg-soft",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "size-2 rounded-full",
                      hereNow > 0 ? "bg-presence" : "bg-fg-muted/50",
                    )}
                  />
                  {hereNow} here now
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Rooms get a row of their own: it scrolls sideways, fading at the edges, and keeps the
          room you're in in view. */}
      <nav
        ref={strip}
        aria-label={`Rooms in ${space.name}`}
        className="lg:hidden order-last -mx-1 w-full min-w-0 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-2rem),transparent)] [scrollbar-width:none]"
      >
        <ul className="flex w-max items-center gap-1 px-1">
          {rooms.map((r) => {
            const active = r.id === roomId;
            const unread = !active && roomUnread(reads, r);
            return (
              <li key={r.id}>
                <Link
                  href={`/spaces/${space.slug}/${r.name}`}
                  aria-current={active ? "page" : undefined}
                  data-room={r.id}
                  className={cx(
                    "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.95rem] font-bold whitespace-nowrap transition-colors duration-150 ease-out",
                    active
                      ? "bg-fg/8 text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]"
                      : unread
                        ? "text-fg hover:bg-fg/6"
                        : "text-fg-soft hover:bg-fg/6 hover:text-fg",
                  )}
                >
                  {r.type === "voice" ? (
                    <SpeakerHigh aria-hidden="true" size={16} className="text-fg-soft" />
                  ) : (
                    <span aria-hidden="true" className="text-fg-soft">
                      #
                    </span>
                  )}
                  {r.name}
                  {r.type === "voice" && (voice[r.id]?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-presence/15 px-1.5 text-[0.78rem] font-bold text-presence">
                      {voice[r.id]?.length}
                      <span className="sr-only"> in voice</span>
                    </span>
                  )}
                  {unread && (
                    <>
                      <span aria-hidden="true" className="size-2 rounded-full bg-fg" />
                      <span className="sr-only"> (new messages)</span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {canInvite && (
          <button
            type="button"
            onClick={() => openInvite(space.id)}
            className={pill("ghost", "sm", "max-sm:hidden")}
          >
            <UserPlus aria-hidden="true" size={17} />
            Invite
          </button>
        )}
        <SpaceMenu space={space} />
      </div>
    </header>
  );
}

/**
 * When people are in one of this Space's voice rooms (and you're not on that room, or already in
 * the call), a strip under the tabs says who and lets you drop in.
 */
function LiveStrip({ space, here }: { space: SpaceDetail; here: Channel }) {
  const voice = useRealm((s) => s.voice);
  const members = useRealm((s) => s.members[space.id]);
  const meId = useRealm((s) => s.me?.id);
  const room = spaceRooms(space).find(
    (r) => r.type === "voice" && r.id !== here.id && (voice[r.id]?.length ?? 0) > 0,
  );
  if (!room) return null;
  const people = voice[room.id] ?? [];
  if (meId && people.includes(meId)) return null;
  const users = people
    .map((id) => members?.find((m) => m.user.id === id)?.user)
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  const names = users.map((u) => u.displayName);
  const who =
    names.length === 0
      ? `${people.length} in the room`
      : names.length <= 2
        ? `${names.join(" and ")} ${names.length === 1 ? "is" : "are"} in`
        : `${names.slice(0, 2).join(", ")} and ${people.length - 2} more are in`;
  return (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-[1.1rem] bg-[linear-gradient(100deg,rgb(78_224_138/0.1),rgb(78_224_138/0.02)_70%)] py-2 pr-2 pl-3.5 shadow-[inset_0_0_0_1px_rgb(78_224_138/0.24)] md:mx-6">
      <SpeakerHigh aria-hidden="true" size={19} className="shrink-0 text-presence" />
      <p className="min-w-0 flex-1 truncate text-[0.95rem]">
        <span className="font-bold text-fg">{room.name}</span>
        <span className="text-fg-soft"> · {who}</span>
      </p>
      <span className="flex shrink-0 max-sm:hidden">
        {users.slice(0, 3).map((u, i) => (
          <Avatar
            key={u.id}
            user={u}
            size={28}
            className={cx("shadow-[0_0_0_2.5px_#15201b]", i > 0 && "-ml-2")}
          />
        ))}
      </span>
      <Link
        href={`/spaces/${space.slug}/${room.name}`}
        className={pill("action", "sm", "shrink-0")}
      >
        <Headphones aria-hidden="true" size={17} />
        Join<span className="sr-only"> {room.name}</span>
      </Link>
    </div>
  );
}

/** A Space's chat room: the shared chat, with this room's rights and this Space's names. */
function RoomChat({ space, room }: { space: SpaceDetail; room: Channel }) {
  const members = useRealm((s) => s.members[space.id]);
  const teen = useRealm((s) => s.me?.teen ?? false);
  const scope = useMemo(() => roomScope(space, room, members, teen), [space, room, members, teen]);
  return <Chat room={room} scope={scope} />;
}

/** A room only some roles can see: Everyone may not view it. */
const isPrivate = (space: SpaceDetail, room: Channel) =>
  room.overwrites.some(
    (o) =>
      o.targetType === "role" &&
      o.targetId === space.id &&
      (BigInt(o.deny) & Permission.VIEW_CHANNEL) === Permission.VIEW_CHANNEL,
  );

/**
 * On computers, the Space's rooms down the side, the way its moderators grouped them: rooms with
 * no group first, then each group (click its name to fold it). Voice rooms show who's in them.
 */
function RoomsColumn({ space, roomId }: { space: SpaceDetail; roomId: string | null }) {
  const reads = useRealm((s) => s.reads);
  const voice = useRealm((s) => s.voice);
  const members = useRealm((s) => s.members[space.id]);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const groups = space.channels
    .filter((c) => c.type === "category")
    .sort((a, b) => a.position - b.position);
  const known = new Set(groups.map((g) => g.id));
  const rooms = spaceRooms(space).sort((a, b) => a.position - b.position);
  const sections = [
    {
      group: null as Channel | null,
      rooms: rooms.filter((r) => !r.parentId || !known.has(r.parentId)),
    },
    ...groups.map((g) => ({
      group: g as Channel | null,
      rooms: rooms.filter((r) => r.parentId === g.id),
    })),
  ];

  const row = (r: Channel) => {
    const active = r.id === roomId;
    const unread = !active && r.type === "text" && roomUnread(reads, r);
    const people = r.type === "voice" ? (voice[r.id] ?? []) : [];
    return (
      <li key={r.id}>
        <Link
          href={`/spaces/${space.slug}/${r.name}`}
          aria-current={active ? "page" : undefined}
          className={cx(
            "flex h-9 items-center gap-2 rounded-[10px] px-2.5 text-[0.95rem] font-bold transition-colors duration-150",
            active
              ? "bg-fg/10 text-fg"
              : unread
                ? "text-fg hover:bg-fg/6"
                : "text-fg-soft hover:bg-fg/6 hover:text-fg",
          )}
        >
          {r.type === "voice" ? (
            <SpeakerHigh aria-hidden="true" size={17} className="shrink-0 opacity-80" />
          ) : (
            <span aria-hidden="true" className="w-[17px] shrink-0 text-center opacity-80">
              #
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{r.name}</span>
          {isPrivate(space, r) && (
            <Lock aria-label="Private" size={13} className="shrink-0 opacity-70" />
          )}
          {r.slowmodeSeconds > 0 && (
            <Timer aria-label="Slow mode" size={13} className="shrink-0 opacity-70" />
          )}
          {unread && (
            <>
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-fg" />
              <span className="sr-only"> (new messages)</span>
            </>
          )}
        </Link>
        {people.length > 0 && (
          <ul className="mb-1 ml-8 space-y-0.5">
            {people.map((id) => {
              const u = members?.find((m) => m.user.id === id)?.user;
              return (
                <li key={id} className="flex items-center gap-2 text-[0.85rem] text-fg-soft">
                  {u ? (
                    <Avatar user={u} size={20} />
                  ) : (
                    <span className="size-5 rounded-full bg-fg/10" />
                  )}
                  <span className="truncate">{u?.displayName ?? "Someone"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav
      aria-label={`Rooms in ${space.name}`}
      className="w-60 shrink-0 overflow-y-auto border-r border-line px-2.5 py-3 max-lg:hidden"
    >
      {sections.map((sec) => {
        if (!sec.group && sec.rooms.length === 0) return null;
        const id = sec.group?.id ?? "top";
        const shut = folded.has(id);
        return (
          <div key={id} className={sec.group ? "mt-4" : undefined}>
            {sec.group && (
              <button
                type="button"
                aria-expanded={!shut}
                onClick={() =>
                  setFolded((f) => {
                    const next = new Set(f);
                    next.has(id) ? next.delete(id) : next.add(id);
                    return next;
                  })
                }
                className="mb-1 flex w-full items-center gap-1 px-1 text-[0.75rem] font-bold tracking-[0.08em] text-fg-soft uppercase hover:text-fg"
              >
                <CaretDown
                  aria-hidden="true"
                  size={11}
                  weight="bold"
                  className={cx("transition-transform duration-150", shut && "-rotate-90")}
                />
                <span className="truncate">{sec.group.name}</span>
              </button>
            )}
            {!shut && <ul className="space-y-0.5">{sec.rooms.map(row)}</ul>}
          </div>
        );
      })}
    </nav>
  );
}
