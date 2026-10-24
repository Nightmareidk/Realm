"use client";

import {
  ChatCircle,
  Heart,
  MagnifyingGlass,
  MusicNotes,
  PlayCircle,
  X,
} from "@phosphor-icons/react";
import type {
  DiscoverSpace,
  FollowState,
  Post,
  PostPage,
  SearchResults,
  Sound,
  SoundList,
  UserSummary,
} from "@realm/contracts";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { player, usePlayer } from "@/features/music/player";
import { JoinOpenButton } from "@/features/spaces/join-open";
import { Avatar } from "@/features/spaces/person";
import { SpaceBadge } from "@/features/spaces/space-badge";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { PostDialog } from "./post-dialog";
import { compact, Eq, useFetch, Verified } from "./shared";

const RECENT = "realm:recent-searches";
type Recent = Pick<UserSummary, "id" | "username" | "displayName" | "avatarUrl" | "verified">;

function readRecent(): Recent[] {
  try {
    return (JSON.parse(localStorage.getItem(RECENT) ?? "[]") as Recent[]).slice(0, 12);
  } catch {
    return [];
  }
}
function remember(u: Recent) {
  try {
    const next = [u, ...readRecent().filter((x) => x.id !== u.id)].slice(0, 12);
    localStorage.setItem(RECENT, JSON.stringify(next));
  } catch {}
}

/** A person in results: their face, name, why, and Follow right there. */
function PersonRow({ u, onOpen }: { u: UserSummary; onOpen: () => void }) {
  const [state, setState] = useState<FollowState | null>(null);
  const [busy, setBusy] = useState(false);
  const follow = async () => {
    setBusy(true);
    try {
      const r = await api<{ follow: FollowState }>(`/users/${u.username}/follow`, {
        method: "PUT",
      });
      setState(r.follow);
    } catch (err) {
      if (err instanceof ApiError) setState(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-fg/[0.04]">
      <Link
        href={`/u/${u.username}`}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar user={u} size={48} />
        <span className="min-w-0">
          <span className="flex items-center gap-1 font-bold text-fg">
            <span className="truncate">{u.displayName}</span>
            <Verified kind={u.verified} size={14} />
          </span>
          <span className="block truncate text-[0.88rem] text-fg-soft">@{u.username}</span>
        </span>
      </Link>
      <button
        type="button"
        disabled={busy || Boolean(state)}
        onClick={() => void follow()}
        className={cx(
          "h-9 shrink-0 rounded-full px-4 text-[0.88rem] font-bold",
          state ? "bg-fg/10 text-fg-soft" : "bg-accent text-on-accent",
        )}
      >
        {state === "following" ? "Following" : state === "requested" ? "Requested" : "Follow"}
      </button>
    </li>
  );
}

/** The grid of what's good right now, in tall tiles; the first of every few is big. */
function ExploreGrid() {
  const first = useFetch<PostPage>("/explore");
  const [items, setItems] = useState<Post[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [open, setOpen] = useState<Post | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  useEffect(() => {
    if (first.data) {
      setItems(first.data.items);
      setNext(first.data.nextCursor);
    }
  }, [first.data]);
  useEffect(() => {
    const el = end.current;
    if (!el || !next) return;
    const io = new IntersectionObserver(async ([e]) => {
      if (!e?.isIntersecting || loading.current || !next) return;
      loading.current = true;
      try {
        const page = await api<PostPage>(`/explore?page=${next}`);
        setItems((l) => [...l, ...page.items.filter((p) => !l.some((x) => x.id === p.id))]);
        setNext(page.nextCursor);
      } catch {
      } finally {
        loading.current = false;
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [next]);

  if (first.loading && !first.data) {
    return (
      <div className="grid grid-cols-3 gap-1" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders while loading.
          <span key={i} className="aspect-[4/5] animate-pulse bg-fg/[0.06]" />
        ))}
      </div>
    );
  }
  if (!items.length) {
    return (
      <p className="rounded-[20px] bg-fg/[0.04] px-6 py-10 text-center text-fg-soft">
        Nothing to explore yet. As people share public posts, the best ones show up here.
      </p>
    );
  }
  return (
    <>
      <ul className="grid grid-flow-dense grid-cols-3 gap-1 overflow-hidden rounded-[18px]">
        {items.map((p, i) => {
          const m = p.media[0];
          const big = i % 10 === 2;
          return (
            <li key={p.id} className={big ? "col-span-1 row-span-2" : undefined}>
              <button
                type="button"
                onClick={() => setOpen(p)}
                className={cx(
                  "group relative block w-full overflow-hidden bg-surface-raised",
                  big ? "h-full min-h-full" : "aspect-[4/5]",
                )}
              >
                {m?.kind === "video" ? (
                  <video
                    src={m.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="size-full object-cover"
                  />
                ) : m ? (
                  // biome-ignore lint/performance/noImgElement: people's photos, behind an access check.
                  <img
                    src={m.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : null}
                {p.kind === "clip" && (
                  <PlayCircle
                    aria-hidden="true"
                    size={22}
                    weight="fill"
                    className="absolute top-2 right-2 text-fg drop-shadow"
                  />
                )}
                <span className="absolute inset-0 flex items-center justify-center gap-5 bg-[rgb(9_9_12/0.45)] font-bold text-fg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <span className="flex items-center gap-1.5">
                    <Heart aria-hidden="true" size={20} weight="fill" />
                    {compact(p.likeCount)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ChatCircle aria-hidden="true" size={20} weight="fill" />
                    {compact(p.commentCount)}
                  </span>
                </span>
                <span className="sr-only">Post by {p.author.displayName}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div ref={end} aria-hidden="true" className="h-px" />
      <PostDialog
        post={open}
        onChange={(x) => {
          setOpen(x);
          setItems((l) => l.map((y) => (y.id === x.id ? x : y)));
        }}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

/**
 * Search and Explore on the website: type to find people (Follow right there), Spaces and songs;
 * with nothing typed, the people you looked at lately, Spaces to join, and a grid of popular posts.
 */
export function SearchView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [songs, setSongs] = useState<Sound[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const spaces = useFetch<{ spaces: DiscoverSpace[] }>("/discover/communities?sort=active&limit=8");
  const { now, playing } = usePlayer();
  const q = query.trim().replace(/^@/, "");

  useEffect(() => setRecent(readRecent()), []);
  useEffect(() => {
    if (q.length < 1) {
      setResults(null);
      setSongs([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<SearchResults>(`/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(setResults)
        .catch(() => {});
      if (q.length >= 2) {
        api<SoundList>(`/sounds?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
          .then((r) => setSongs(r.items.slice(0, 5)))
          .catch(() => {});
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const visited = useCallback((u: UserSummary) => {
    remember({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      verified: u.verified,
    });
  }, []);
  const forget = (id: string | null) => {
    const next = id ? readRecent().filter((x) => x.id !== id) : [];
    try {
      localStorage.setItem(RECENT, JSON.stringify(next));
    } catch {}
    setRecent(next);
  };

  return (
    <div className="mx-auto w-full max-w-[58.5rem] px-8 pb-12 max-md:px-3">
      <div className="sticky top-0 z-10 -mx-2 bg-[linear-gradient(var(--r-surface)_70%,transparent)] px-2 pt-1 pb-4">
        <div className="flex h-12 items-center gap-2.5 rounded-full bg-[rgb(9_9_12/0.55)] px-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] focus-within:shadow-[inset_0_0_0_1.5px_var(--r-accent)]">
          <MagnifyingGlass aria-hidden="true" size={19} className="text-fg-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, Spaces and songs"
            aria-label="Search people, Spaces and songs"
            className="h-full min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="grid size-8 place-items-center rounded-full text-fg-soft hover:text-fg"
            >
              <X aria-hidden="true" size={16} />
              <span className="sr-only">Clear</span>
            </button>
          )}
        </div>
      </div>

      {q ? (
        <div className="space-y-7">
          <section aria-label="People">
            <h2 className="mb-1.5 px-2 font-display text-[1.1rem] font-bold text-fg">People</h2>
            {!results ? (
              <p className="px-2 text-fg-soft">Looking…</p>
            ) : results.users.length === 0 ? (
              <p className="px-2 text-fg-soft">Nobody by that name.</p>
            ) : (
              <ul>
                {results.users.slice(0, 8).map((u) => (
                  <PersonRow key={u.id} u={u} onOpen={() => visited(u)} />
                ))}
              </ul>
            )}
          </section>
          {results && results.spaces.length > 0 && (
            <section aria-label="Spaces">
              <h2 className="mb-1.5 px-2 font-display text-[1.1rem] font-bold text-fg">Spaces</h2>
              <ul>
                {results.spaces.slice(0, 5).map((sp) => (
                  <li
                    key={sp.id}
                    className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-fg/[0.04]"
                  >
                    <SpaceBadge name={sp.name} accent={sp.accent} size={48} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-fg">{sp.name}</b>
                      <span className="text-[0.88rem] text-fg-soft">
                        {compact(sp.memberCount)} members{sp.joined ? " · You're in it" : ""}
                      </span>
                    </span>
                    {sp.joined ? (
                      <Link
                        href={`/spaces/${sp.id}`}
                        className="h-9 rounded-full bg-fg/10 px-4 py-2 text-[0.88rem] font-bold text-fg"
                      >
                        Open
                      </Link>
                    ) : (
                      <JoinOpenButton slug={sp.id} name={sp.name} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {songs.length > 0 && (
            <section aria-label="Songs">
              <h2 className="mb-1.5 px-2 font-display text-[1.1rem] font-bold text-fg">Songs</h2>
              <ul>
                {songs.map((s) => {
                  const on = now?.sound.id === s.id && playing;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => (on ? player.pause() : player.play(s, { from: "Search" }))}
                        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-fg/[0.04]"
                      >
                        {s.coverUrl ? (
                          // biome-ignore lint/performance/noImgElement: a song cover.
                          <img
                            src={s.coverUrl}
                            alt=""
                            className="size-12 rounded-[12px] object-cover"
                          />
                        ) : (
                          <span className="grid size-12 place-items-center rounded-[12px] bg-surface-raised">
                            <MusicNotes aria-hidden="true" size={20} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-fg">{s.title}</b>
                          <span className="block truncate text-[0.88rem] text-fg-soft">
                            {s.artist}
                          </span>
                        </span>
                        {on && <Eq on />}
                        <span className="sr-only">{on ? "Pause" : "Play"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {recent.length > 0 && (
            <section aria-label="Recent">
              <div className="mb-2 flex items-center justify-between px-2">
                <h2 className="font-display text-[1.1rem] font-bold text-fg">Recent</h2>
                <button
                  type="button"
                  onClick={() => forget(null)}
                  className="text-[0.88rem] font-bold text-accent"
                >
                  Clear all
                </button>
              </div>
              <ul className="flex gap-4 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
                {recent.map((u) => (
                  <li key={u.id} className="relative w-[4.5rem] shrink-0 text-center">
                    <Link href={`/u/${u.username}`} className="block">
                      <Avatar user={u} size={64} className="mx-auto" />
                      <span className="mt-1.5 block truncate text-[0.78rem] text-fg">
                        {u.displayName.split(" ")[0]}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => forget(u.id)}
                      className="absolute top-0 right-0 grid size-5 place-items-center rounded-full bg-surface-raised text-fg-soft shadow hover:text-fg"
                    >
                      <X aria-hidden="true" size={11} weight="bold" />
                      <span className="sr-only">Remove {u.displayName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(spaces.data?.spaces ?? []).filter((s) => !s.joined).length > 0 && (
            <section aria-label="Spaces to join">
              <div className="mb-2 flex items-center justify-between px-2">
                <h2 className="font-display text-[1.1rem] font-bold text-fg">Spaces to join</h2>
                <Link
                  href="/explore/spaces"
                  className="text-[0.88rem] font-bold text-fg-soft hover:text-fg"
                >
                  See all
                </Link>
              </div>
              <ul className="flex gap-3 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
                {(spaces.data?.spaces ?? [])
                  .filter((s) => !s.joined)
                  .map((sp) => (
                    <li
                      key={sp.id}
                      className="w-[11rem] shrink-0 rounded-[18px] bg-fg/[0.05] p-3.5"
                    >
                      <SpaceBadge name={sp.name} accent={sp.accent} size={44} />
                      <b className="mt-2.5 block truncate text-fg">{sp.name}</b>
                      <span className="block text-[0.85rem] text-fg-soft">
                        {compact(sp.memberCount)} members
                      </span>
                      <span className="mt-2.5 block">
                        <JoinOpenButton slug={sp.slug} name={sp.name} />
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
          <section aria-label="Explore">
            <h2 className="mb-3 px-2 font-display text-[1.1rem] font-bold text-fg">Explore</h2>
            <ExploreGrid />
          </section>
        </div>
      )}
    </div>
  );
}
