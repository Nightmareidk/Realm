"use client";

import { Heart, MusicNotes, Play, Plus, Shuffle } from "@phosphor-icons/react";
import type { Playlist, Sound } from "@realm/contracts";
import { type FormEvent, useState } from "react";
import { Popover, row } from "@/features/app/menus";
import { Eq, useFetch } from "@/features/social/shared";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { clock, player, usePlayer } from "./player";

/** A song's cover, or a soft square with a note. */
export function Cover({
  url,
  size,
  className,
}: {
  url: string | null;
  size: number;
  className?: string;
}) {
  return url ? (
    // biome-ignore lint/performance/noImgElement: covers come from the music library's hosts.
    <img
      src={url}
      alt=""
      loading="lazy"
      className={cx("shrink-0 rounded-[10px] object-cover", className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-[10px] bg-surface-raised text-fg-soft",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <MusicNotes aria-hidden="true" size={size * 0.42} />
    </span>
  );
}

/** Your playlists to add a song to, or a new one made with it. */
function Picker({ sound, close }: { sound: Sound; close: () => void }) {
  const lists = useFetch<{ items: Playlist[] }>("/music/playlists");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const add = async (id: string) => {
    try {
      await api(`/music/playlists/${id}/items/${sound.id}`, { method: "PUT" });
      close();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Not added. Try again.");
    }
  };
  const make = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const list = await api<Playlist>("/music/playlists", { body: { name: name.trim() } });
      await add(list.id);
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Not made. Try again.");
    }
  };
  return (
    <div>
      <p className="px-3 pt-2 pb-1.5 text-[0.85rem] font-bold text-fg-soft">Add to a playlist</p>
      {(lists.data?.items ?? []).map((l) => (
        <button key={l.id} type="button" className={row} onClick={() => void add(l.id)}>
          <MusicNotes aria-hidden="true" size={18} />
          <span className="min-w-0 flex-1 truncate">{l.name}</span>
        </button>
      ))}
      <form onSubmit={(e) => void make(e)} className="flex gap-1.5 px-2 pt-1.5 pb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="New playlist"
          aria-label="New playlist name"
          className="h-9 min-w-0 flex-1 rounded-full bg-fg/8 px-3 text-[0.9rem] text-fg outline-none placeholder:text-fg-muted"
        />
        <button
          type="submit"
          className="h-9 rounded-full bg-accent px-3 text-[0.85rem] font-bold text-on-accent"
        >
          Make
        </button>
      </form>
      {note && <p className="px-3 pb-2 text-[0.85rem] text-danger">{note}</p>}
    </div>
  );
}

/** Add a song to one of your playlists, or start a new one with it. */
function AddToPlaylist({ sound }: { sound: Sound }) {
  return (
    <Popover
      label={`Add ${sound.title} to a playlist`}
      buttonClass="grid size-9 place-items-center rounded-full text-fg-soft opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-fg/8 hover:text-fg aria-expanded:opacity-100"
      panelClass="w-[16rem]"
      button={<Plus aria-hidden="true" size={18} />}
    >
      {(close) => <Picker sound={sound} close={close} />}
    </Popover>
  );
}

/**
 * Songs in a list: click one to play the list from there (the rest follow in the bar). Each row
 * has its number (bars while it plays), cover, title and artist, its length, Like, and Add.
 */
export function SongList({ items, from }: { items: Sound[]; from: string }) {
  const { now, playing } = usePlayer();
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const like = async (s: Sound) => {
    const on = !(liked[s.id] ?? s.liked);
    setLiked((l) => ({ ...l, [s.id]: on }));
    try {
      await api(`/music/liked/${s.id}`, { method: on ? "PUT" : "DELETE" });
    } catch {
      setLiked((l) => ({ ...l, [s.id]: !on }));
    }
  };
  return (
    <ol className="space-y-0.5">
      {items.map((s, i) => {
        const current = now?.sound.id === s.id;
        const isLiked = liked[s.id] ?? Boolean(s.liked);
        return (
          <li
            key={s.id}
            className={cx(
              "group flex items-center gap-3 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-fg/6",
              current && "bg-fg/8",
            )}
          >
            <button
              type="button"
              onClick={() =>
                current && playing ? player.pause() : player.playList(items, i, from)
              }
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="grid w-6 shrink-0 place-items-center text-[0.88rem] text-fg-soft tabular-nums">
                {current && playing ? (
                  <Eq on />
                ) : (
                  <>
                    <span className="group-hover:hidden">{i + 1}</span>
                    <Play
                      aria-hidden="true"
                      size={15}
                      weight="fill"
                      className="hidden text-fg group-hover:block"
                    />
                  </>
                )}
              </span>
              <Cover url={s.coverUrl} size={44} />
              <span className="min-w-0 flex-1">
                <span
                  className={cx("block truncate font-bold", current ? "text-accent" : "text-fg")}
                >
                  {s.title}
                </span>
                <span className="block truncate text-[0.85rem] text-fg-soft">{s.artist}</span>
              </span>
              <span className="sr-only">{current && playing ? "Pause" : "Play"}</span>
            </button>
            <button
              type="button"
              aria-pressed={isLiked}
              onClick={() => void like(s)}
              className={cx(
                "grid size-9 place-items-center rounded-full hover:bg-fg/8",
                isLiked
                  ? "text-[#ff6b8b]"
                  : "text-fg-soft opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              )}
            >
              <Heart aria-hidden="true" size={18} weight={isLiked ? "fill" : "regular"} />
              <span className="sr-only">{isLiked ? "Liked" : "Like"}</span>
            </button>
            <AddToPlaylist sound={s} />
            <span className="w-11 shrink-0 text-right text-[0.85rem] text-fg-soft tabular-nums">
              {clock(s.durationMs)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Play all and Shuffle, for the top of a list. */
export function PlayButtons({ items, from }: { items: Sound[]; from: string }) {
  if (!items.length) return null;
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={() => player.playList(items, 0, from)}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-bold text-on-accent transition-transform duration-150 active:scale-[0.97]"
      >
        <Play aria-hidden="true" size={18} weight="fill" />
        Play
      </button>
      <button
        type="button"
        onClick={() => {
          const shuffled = [...items].sort(() => Math.random() - 0.5);
          player.playList(shuffled, 0, from);
        }}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-fg/10 px-5 font-bold text-fg hover:bg-fg/15"
      >
        <Shuffle aria-hidden="true" size={18} />
        Shuffle
      </button>
    </div>
  );
}
