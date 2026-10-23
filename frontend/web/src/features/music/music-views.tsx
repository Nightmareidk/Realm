"use client";

import { Heart, MagnifyingGlass, Play } from "@phosphor-icons/react";
import {
  MOODS,
  type MusicHome,
  type PlaylistDetail,
  type Sound,
  type SoundList,
} from "@realm/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAmbient } from "@/features/app/ambient";
import { useFetch } from "@/features/social/shared";
import { api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { player } from "./player";
import { Cover, PlayButtons, SongList } from "./song-list";

/** Up to four covers as one square (a playlist's picture). */
function Mosaic({ covers, size }: { covers: string[]; size: number }) {
  if (covers.length < 4)
    return <Cover url={covers[0] ?? null} size={size} className="rounded-[14px]" />;
  return (
    <span
      className="grid shrink-0 grid-cols-2 overflow-hidden rounded-[14px]"
      style={{ width: size, height: size }}
    >
      {covers.slice(0, 4).map((c) => (
        // biome-ignore lint/performance/noImgElement: covers come from the music library's hosts.
        <img key={c} src={c} alt="" className="size-full object-cover" />
      ))}
    </span>
  );
}

/** A row of songs as covers, each a tap from playing (Recently played, Popular). */
function Shelf({ title, items, from }: { title: string; items: Sound[]; from: string }) {
  if (!items.length) return null;
  return (
    <section aria-label={title} className="mt-9">
      <h2 className="mb-3 font-display text-[1.3rem] font-bold text-fg">{title}</h2>
      <ul className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.slice(0, 12).map((s, i) => (
          <li key={s.id} className="w-[9.5rem] shrink-0">
            <button
              type="button"
              onClick={() => player.playList(items, i, from)}
              className="group block w-full text-left"
            >
              <span className="relative block">
                <Cover url={s.coverUrl} size={152} className="rounded-[16px]" />
                <span className="absolute right-2 bottom-2 grid size-10 translate-y-1 place-items-center rounded-full bg-accent text-on-accent opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Play aria-hidden="true" size={16} weight="fill" />
                </span>
              </span>
              <b className="mt-2 block truncate text-[0.92rem] text-fg">{s.title}</b>
              <span className="block truncate text-[0.82rem] text-fg-soft">{s.artist}</span>
              <span className="sr-only">Play</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Music on the website (Realm's free library, like a music app): search, moods, Liked songs,
 * your playlists, what you played lately and what's popular. Songs play in the bar at the foot
 * while you go anywhere else.
 */
export function MusicHomeView() {
  const home = useFetch<MusicHome>("/music/home");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Sound[] | null>(null);
  const [searching, setSearching] = useState(false);
  const h = home.data;
  useAmbient(h?.recent[0]?.coverUrl ?? h?.popular[0]?.coverUrl ?? null);

  // Search a moment after typing stops; the library can be slow, so ask again while it looks.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFound(null);
      return;
    }
    const ctrl = new AbortController();
    let tries = 0;
    const run = () =>
      api<SoundList>(`/sounds?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => {
          setFound(r.items);
          setSearching(Boolean(r.searching));
          if (r.searching && tries++ < 4) setTimeout(run, 2500);
        })
        .catch(() => {});
    const t = setTimeout(run, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  return (
    <div className="mx-auto w-full max-w-[64rem] px-9 pb-12 max-md:px-4">
      <h1 className="pt-2 font-display text-[2.4rem] font-extrabold tracking-[-0.03em] text-fg">
        Music
      </h1>
      <div className="mt-4 flex h-12 max-w-[30rem] items-center gap-2.5 rounded-full bg-[rgb(9_9_12/0.55)] px-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
        <MagnifyingGlass aria-hidden="true" size={19} className="text-fg-soft" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs and artists"
          aria-label="Search songs and artists"
          className="h-full min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-muted"
        />
      </div>

      {found ? (
        <section aria-label="Search results" className="mt-6">
          {found.length ? (
            <SongList items={found} from={`"${query.trim()}"`} />
          ) : (
            <p className="py-8 text-fg-soft">
              {searching ? "Looking through the library…" : "No songs found."}
            </p>
          )}
          {searching && found.length > 0 && (
            <p className="pt-2 text-[0.88rem] text-fg-soft">Finding more…</p>
          )}
        </section>
      ) : (
        <>
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Moods">
            {MOODS.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/music/mood/${m.id}`}
                  className="inline-flex h-10 items-center rounded-full bg-fg/8 px-4 text-[0.92rem] font-bold text-fg hover:bg-fg/12"
                >
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>

          <section
            aria-label="Your music"
            className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3"
          >
            <Link
              href="/music/liked"
              className="flex items-center gap-3.5 rounded-[18px] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--r-accent)_55%,transparent),color-mix(in_srgb,var(--r-light-2)_45%,transparent))] p-3 hover:brightness-110"
            >
              <span className="grid size-16 place-items-center rounded-[14px] bg-[rgb(9_9_12/0.35)] text-fg">
                <Heart aria-hidden="true" size={26} weight="fill" />
              </span>
              <span>
                <b className="block text-fg">Liked songs</b>
                <span className="text-[0.88rem] text-fg/80">
                  {h ? `${h.liked.count} ${h.liked.count === 1 ? "song" : "songs"}` : "…"}
                </span>
              </span>
            </Link>
            {(h?.playlists ?? []).map((p) => (
              <Link
                key={p.id}
                href={`/music/playlist/${p.id}`}
                className="flex items-center gap-3.5 rounded-[18px] bg-fg/[0.05] p-3 hover:bg-fg/8"
              >
                <Mosaic covers={p.covers} size={64} />
                <span className="min-w-0">
                  <b className="block truncate text-fg">{p.name}</b>
                  <span className="text-[0.88rem] text-fg-soft">
                    {p.count} {p.count === 1 ? "song" : "songs"}
                    {p.isPublic ? "" : " · Private"}
                  </span>
                </span>
              </Link>
            ))}
          </section>

          {home.loading && !h ? (
            <p role="status" className="py-10 text-fg-soft">
              Loading music…
            </p>
          ) : (
            <>
              <Shelf title="New on Realm" items={h?.featured ?? []} from="New on Realm" />
              <Shelf title="Played lately" items={h?.recent ?? []} from="Played lately" />
              <Shelf title="Popular on Realm" items={h?.popular ?? []} from="Popular on Realm" />
            </>
          )}
          <p className="mt-10 text-[0.85rem] text-fg-soft">
            Songs come from Realm's free library (Creative Commons music from Jamendo), with their
            artists credited.
          </p>
        </>
      )}
    </div>
  );
}

/** One list of songs: a playlist, Liked songs, or a mood. */
export function SongListView({ kind, id }: { kind: "playlist" | "liked" | "mood"; id?: string }) {
  const mood = MOODS.find((m) => m.id === id);
  const path =
    kind === "playlist"
      ? `/music/playlists/${id}`
      : kind === "liked"
        ? "/music/liked"
        : `/music/moods/${id}`;
  const data = useFetch<PlaylistDetail | SoundList>(path);
  const items = (data.data && "items" in data.data ? data.data.items : []) as Sound[];
  const playlist = kind === "playlist" ? (data.data as PlaylistDetail | null) : null;
  const title = playlist?.name ?? (kind === "liked" ? "Liked songs" : (mood?.label ?? "Songs"));
  const covers =
    playlist?.covers ?? items.slice(0, 4).flatMap((s) => (s.coverUrl ? [s.coverUrl] : []));
  useAmbient(covers[0] ?? null);

  return (
    <div className="mx-auto w-full max-w-[64rem] px-9 pb-12 max-md:px-4">
      <Link href="/music" className="text-[0.9rem] font-bold text-fg-soft hover:text-fg">
        ← Music
      </Link>
      <header className="mt-4 flex items-end gap-6 max-sm:flex-col max-sm:items-start">
        {kind === "liked" ? (
          <span className="grid size-44 shrink-0 place-items-center rounded-[22px] bg-[linear-gradient(135deg,var(--r-accent),var(--r-light-2))] text-on-accent shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)]">
            <Heart aria-hidden="true" size={64} weight="fill" />
          </span>
        ) : (
          <span className="shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)]">
            <Mosaic covers={covers} size={176} />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[0.85rem] font-bold text-fg-soft">
            {kind === "playlist"
              ? playlist?.isPublic
                ? "Public playlist"
                : "Playlist"
              : kind === "mood"
                ? "Mood"
                : "Your songs"}
          </p>
          <h1 className="font-display text-[3rem] leading-none font-extrabold tracking-[-0.035em] text-fg max-sm:text-[2.2rem]">
            {title}
          </h1>
          {playlist?.description && <p className="mt-2 text-fg-soft">{playlist.description}</p>}
          <p className="mt-2 text-[0.9rem] text-fg-soft">
            {playlist ? `${playlist.owner.displayName} · ` : ""}
            {items.length} {items.length === 1 ? "song" : "songs"}
          </p>
        </div>
      </header>
      <div className="mt-6">
        <PlayButtons items={items} from={title} />
      </div>
      <div className={cx("mt-6")}>
        {data.loading && !data.data ? (
          <p role="status" className="text-fg-soft">
            Loading…
          </p>
        ) : data.error && !data.data ? (
          <p className="text-fg-soft">{data.error}</p>
        ) : items.length ? (
          <SongList items={items} from={title} />
        ) : (
          <p className="py-8 text-fg-soft">
            {kind === "liked" ? "Tap the heart on any song to keep it here." : "No songs here yet."}
          </p>
        )}
      </div>
    </div>
  );
}
