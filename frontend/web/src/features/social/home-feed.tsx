"use client";

import type { Post, PostPage, Sound, StoryFeed, Suggestion } from "@realm/contracts";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAmbient } from "@/features/app/ambient";
import { LiveBadge } from "@/features/app/nav-column";
import { player, usePlayer } from "@/features/music/player";
import { spaceRooms, useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { onMade, openComposer } from "./composer";
import { PostCard } from "./post-card";
import { PostDialog } from "./post-dialog";
import { Eq, useFetch, Verified } from "./shared";
import { StoryRings, StoryViewer } from "./stories";

const pill = "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[0.88rem] font-bold";

/** Here now: Spaces with people in voice, and friends who are active, to jump straight in. */
function HereNowSide() {
  const spaces = useRealm((s) => s.spaces);
  const voice = useRealm((s) => s.voice);
  const presence = useRealm((s) => s.presence);
  const conversations = useRealm((s) => s.conversations);
  const me = useRealm((s) => s.me?.id);
  const live = spaces
    .map((sp) => ({
      sp,
      n: new Set(spaceRooms(sp).flatMap((r) => (r.type === "voice" ? (voice[r.id] ?? []) : [])))
        .size,
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  const active = conversations
    .filter((c) => c.type === "dm" && !c.request)
    .map((c) => ({ c, them: c.recipients.find((r) => r.id !== me) }))
    .filter((x) => x.them && presence[x.them.id] === "online")
    .slice(0, 3);
  if (!live.length && !active.length) return null;
  return (
    <section aria-labelledby="here-now-side" className="mb-[26px]">
      <h2 id="here-now-side" className="mb-2.5 font-display text-[1.15rem] font-bold text-fg">
        Here now
      </h2>
      <ul>
        {live.map(({ sp, n }) => (
          <li key={sp.id} className="flex items-center gap-3 py-2">
            <LiveBadge space={sp} live={n > 0} size={46} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-fg">{sp.name}</p>
              <p className={cx("truncate text-[0.82rem]", n ? "text-presence" : "text-fg-soft")}>
                {n
                  ? `● ${n} in voice`
                  : `${sp.memberCount} ${sp.memberCount === 1 ? "member" : "members"}`}
              </p>
            </div>
            <Link
              href={`/spaces/${sp.slug}`}
              className={cx(pill, n ? "bg-accent text-on-accent" : "bg-fg/10 text-fg")}
            >
              {n ? "Join" : "Open"}
            </Link>
          </li>
        ))}
        {active.map(({ c, them }) =>
          them ? (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <Avatar user={them} size={46} presence="online" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-fg">{them.displayName}</p>
                <p className="truncate text-[0.82rem] text-presence">● Active now</p>
              </div>
              <Link href={`/messages/${c.id}`} className={cx(pill, "bg-fg/10 text-fg")}>
                Say hi
              </Link>
            </li>
          ) : null,
        )}
      </ul>
    </section>
  );
}

/** People you may know, with Follow (or Follow back) right there. */
function PeopleSide() {
  const list = useFetch<{ items: Suggestion[] }>("/users/@me/suggestions");
  const [done, setDone] = useState<Record<string, "following" | "requested">>({});
  const items = list.data?.items ?? [];
  if (!items.length) return null;
  const follow = async (s: Suggestion) => {
    try {
      const r = await api<{ follow: "none" | "requested" | "following" }>(
        `/users/${s.user.username}/follow`,
        { method: "PUT" },
      );
      if (r.follow !== "none")
        setDone((d) => ({ ...d, [s.user.id]: r.follow as "following" | "requested" }));
    } catch {}
  };
  return (
    <section aria-labelledby="people-side" className="mb-[26px]">
      <h2 id="people-side" className="mb-2.5 font-display text-[1.15rem] font-bold text-fg">
        People you may know
      </h2>
      <ul>
        {items.map((s) => {
          const state = done[s.user.id];
          return (
            <li key={s.user.id} className="flex items-center gap-3 py-2">
              <Link href={`/u/${s.user.username}`} className="shrink-0">
                <Avatar user={s.user} size={46} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/u/${s.user.username}`}
                  className="flex items-center gap-1 font-bold text-fg"
                >
                  <span className="truncate">{s.user.displayName}</span>
                  <Verified kind={s.user.verified} size={13} />
                </Link>
                <p className="truncate text-[0.82rem] text-fg-soft">{s.reason}</p>
              </div>
              <button
                type="button"
                disabled={Boolean(state)}
                onClick={() => void follow(s)}
                className={cx(
                  pill,
                  state
                    ? "bg-fg/10 text-fg-soft"
                    : s.followsYou
                      ? "bg-accent text-on-accent"
                      : "bg-fg/10 text-fg",
                )}
              >
                {state === "following"
                  ? "Following"
                  : state === "requested"
                    ? "Requested"
                    : s.followsYou
                      ? "Follow back"
                      : "Follow"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Sounds people use: popular songs, a tap away from playing. */
function SoundsSide() {
  const list = useFetch<{ items: Sound[] }>("/sounds/trending");
  const { now, playing } = usePlayer();
  const items = (list.data?.items ?? []).slice(0, 3);
  if (!items.length) return null;
  return (
    <section aria-labelledby="sounds-side">
      <h2 id="sounds-side" className="mb-2.5 font-display text-[1.15rem] font-bold text-fg">
        Sounds people use
      </h2>
      <ul className="flex gap-3">
        {items.map((s) => {
          const on = now?.sound.id === s.id && playing;
          return (
            <li key={s.id} className="w-24 shrink-0">
              <button
                type="button"
                onClick={() =>
                  on ? player.pause() : player.play(s, { from: "Sounds people use" })
                }
                className="group block w-full text-left"
              >
                <span className="relative block">
                  {s.coverUrl ? (
                    // biome-ignore lint/performance/noImgElement: a song cover from the library.
                    <img
                      src={s.coverUrl}
                      alt=""
                      className="mb-2 size-24 rounded-[20px] object-cover"
                    />
                  ) : (
                    <span className="mb-2 block size-24 rounded-[20px] bg-surface-raised" />
                  )}
                  {on && (
                    <span className="absolute right-2 bottom-4 rounded-full bg-[rgb(9_9_12/0.75)] p-1.5">
                      <Eq on />
                    </span>
                  )}
                </span>
                <b className="block truncate text-[0.88rem] text-fg">{s.title}</b>
                <span className="block truncate text-[0.75rem] text-fg-soft">{s.artist}</span>
                <span className="sr-only">{on ? "Pause" : "Play"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Home in Look B: Stories along the top, posts from people you follow (each photo lights the page,
 * its song on the photo), and beside them who's here now, people you may know and popular sounds.
 */
export function HomeFeed() {
  const me = useRealm((s) => s.me);
  const feed = useFetch<PostPage>("/feed");
  const stories = useFetch<StoryFeed>("/stories/feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [open, setOpen] = useState<Post | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [more, setMore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feed.data) {
      setPosts(feed.data.items);
      setMore(feed.data.nextCursor);
    }
  }, [feed.data]);
  useEffect(
    () =>
      onMade(({ post, story }) => {
        if (post) setPosts((p) => [post, ...p]);
        if (story) void stories.reload();
      }),
    [stories],
  );

  // The first photo lights the page.
  const lit = useMemo(
    () => posts.find((p) => p.media[0]?.kind === "image")?.media[0]?.url,
    [posts],
  );
  useAmbient(lit);

  // More posts as you reach the end.
  useEffect(() => {
    const el = end.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry?.isIntersecting || loadingMore || !more) return;
      setLoadingMore(true);
      try {
        const page = await api<PostPage>(`/feed?before=${more}`);
        setPosts((p) => [...p, ...page.items.filter((x) => !p.some((y) => y.id === x.id))]);
        setMore(page.nextCursor);
      } catch {
      } finally {
        setLoadingMore(false);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [more, loadingMore]);

  const change = (p: Post) => {
    setPosts((list) => list.map((x) => (x.id === p.id ? p : x)));
    if (open?.id === p.id) setOpen(p);
  };
  const rings = stories.data?.rings ?? [];

  return (
    <div className="flex gap-9 px-9 pb-10 max-xl:px-6 max-md:flex-col max-md:px-3">
      <div className="w-full max-w-[36.25rem] min-w-0 shrink-0 max-md:max-w-none">
        {me && (
          <StoryRings
            rings={rings}
            me={{ id: me.id, displayName: me.displayName, avatarUrl: me.avatarUrl }}
            onOpen={setViewing}
            onAdd={() => openComposer({ mode: "story" })}
          />
        )}
        {feed.loading && !feed.data ? (
          <p role="status" className="py-10 text-center text-fg-soft">
            Loading your feed…
          </p>
        ) : posts.length === 0 ? (
          <div className="rounded-[28px] bg-fg/[0.04] px-6 py-12 text-center">
            <p className="font-display text-[1.5rem] font-extrabold text-fg">
              Your feed starts here
            </p>
            <p className="mx-auto mt-2 max-w-[26rem] text-fg-soft">
              Follow people to see their posts, or share your first one. Songs on posts play right
              here.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => openComposer({ mode: "post" })}
                className="h-11 rounded-full bg-accent px-5 font-bold text-on-accent"
              >
                Share a post
              </button>
              <Link
                href="/explore"
                className="grid h-11 place-items-center rounded-full bg-fg/10 px-5 font-bold text-fg"
              >
                Find people
              </Link>
            </div>
          </div>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onChange={change}
              onOpen={() => setOpen(p)}
              onRemoved={() => setPosts((list) => list.filter((x) => x.id !== p.id))}
            />
          ))
        )}
        <div ref={end} aria-hidden="true" className="h-px" />
        {loadingMore && (
          <p role="status" className="py-4 text-center text-fg-soft">
            Loading more…
          </p>
        )}
        {!more && posts.length > 0 && (
          <p className="py-6 text-center text-[0.9rem] text-fg-soft">You're all caught up.</p>
        )}
      </div>
      <aside aria-label="Around you" className="min-w-0 flex-1 pt-1.5 max-lg:hidden">
        <HereNowSide />
        <PeopleSide />
        <SoundsSide />
      </aside>
      <PostDialog post={open} onChange={change} onClose={() => setOpen(null)} />
      {viewing !== null && (
        <StoryViewer
          rings={rings}
          start={viewing}
          onClose={() => {
            setViewing(null);
            void stories.reload();
          }}
        />
      )}
    </div>
  );
}
