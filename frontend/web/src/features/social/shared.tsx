"use client";

import { SealCheck } from "@phosphor-icons/react";
import type { SoundUse, VerifiedKind } from "@realm/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { player, usePlayer } from "@/features/music/player";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";

/** The badge beside a verified name: blue for notable people and businesses, mint for Realm. */
export function Verified({ kind, size = 16 }: { kind?: VerifiedKind | null; size?: number }) {
  if (!kind) return null;
  return (
    <SealCheck
      size={size}
      weight="fill"
      className="shrink-0"
      color={kind === "official" ? "#7ef2c4" : "#3b9cff"}
      aria-label={kind === "official" ? "Realm's official account" : "Verified"}
      role="img"
    />
  );
}

/** "now", "5m", "2h", "3d", then a short date. */
export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** 1,234 → "1.2K". */
export function compact(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** Loads something from the API, with reload and a way to change it in place. */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const live = useRef(true);
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const next = await api<T>(path);
      if (live.current) {
        setData(next);
        setError(null);
      }
    } catch (err) {
      if (live.current) setError(err instanceof ApiError ? err.message : "That didn't load.");
    } finally {
      if (live.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
    };
  }, [load]);
  return { data, setData, error, loading, reload: load };
}

/** The moving bars beside a song that's playing. */
export function Eq({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-on={on ? "" : undefined}
      className="r-eq flex h-3.5 items-end gap-0.5"
    >
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/**
 * The song chip on a photo (Look B): its cover, title and artist, and bars while it plays. Tap
 * to play or pause it in the Now Playing bar.
 */
export function SongChip({
  sound,
  playKey,
  from,
  className,
}: {
  sound: SoundUse;
  playKey: string;
  from: string;
  className?: string;
}) {
  const { now, playing } = usePlayer();
  const on = now?.key === playKey && playing;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (on) player.pause();
        else player.play(sound, { from, startMs: sound.startMs, key: playKey });
      }}
      className={cx(
        "flex h-10 max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full bg-[rgb(9_9_12/0.78)] py-0 pr-3.5 pl-[5px] text-[0.82rem] text-fg backdrop-blur-sm transition-transform duration-150 ease-out active:scale-[0.97]",
        className,
      )}
    >
      {sound.coverUrl ? (
        // biome-ignore lint/performance/noImgElement: covers come from the music library's hosts.
        <img
          src={sound.coverUrl}
          alt=""
          className="size-[30px] shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="size-[30px] shrink-0 rounded-full bg-surface-raised" />
      )}
      <b className="truncate font-bold">{sound.title}</b>
      <span className="truncate text-fg-soft">{sound.artist}</span>
      <Eq on={on} />
      <span className="sr-only">{on ? "Pause the song" : "Play the song"}</span>
    </button>
  );
}
