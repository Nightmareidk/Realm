"use client";

import {
  ArrowCounterClockwise,
  Heart,
  MusicNotes,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
} from "@phosphor-icons/react";
import type { Sound } from "@realm/contracts";
import { useEffect, useRef } from "react";
import { openComposer } from "@/features/social/composer";
import { api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { clock, player, usePlayer } from "./player";

/**
 * The Now Playing bar along the foot of every page (Look B): the song, where it came from, play
 * and the part it's at, Like, and the volume. Before anything has played it shows the last song
 * from this device, or a popular one, ready to play.
 */
export function NowPlayingBar({ className }: { className?: string }) {
  const { now, playing, positionMs, durationMs, volume } = usePlayer();
  const lastVolume = useRef(0.8);

  // Only once, when the bar first appears.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount.
  useEffect(() => {
    player.restore();
    if (player && !now) {
      void api<{ items: Sound[] }>("/sounds/trending")
        .then((r) => {
          const first = r.items.find((s) => s.audioUrl);
          if (first) player.cue(first, "Popular on Realm");
        })
        .catch(() => {});
    }
  }, []);

  const total = durationMs || now?.sound.durationMs || 0;
  const share = total ? Math.min(1, positionMs / total) : 0;

  if (!now) {
    return (
      <div className={cx("flex items-center gap-3 px-5 text-fg-soft", className)}>
        <MusicNotes aria-hidden="true" size={22} />
        <span className="text-[0.95rem]">Songs you play keep going while you look around.</span>
      </div>
    );
  }
  const s = now.sound;
  return (
    <section aria-label="Now playing" className={cx("flex items-center gap-4 px-5", className)}>
      <div className="flex w-[21rem] min-w-0 items-center gap-3 max-lg:w-auto max-lg:flex-1">
        {s.coverUrl ? (
          // biome-ignore lint/performance/noImgElement: covers come from the music library's hosts.
          <img
            src={s.coverUrl}
            alt=""
            className="size-[52px] shrink-0 rounded-[10px] object-cover"
          />
        ) : (
          <span className="grid size-[52px] shrink-0 place-items-center rounded-[10px] bg-surface-raised text-fg-soft">
            <MusicNotes aria-hidden="true" size={24} />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate font-bold text-fg">{s.title}</span>
          <span className="block truncate text-[0.82rem] text-fg-soft">
            {s.artist}
            {now.from ? ` · from ${now.from}` : ""}
          </span>
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center gap-2 max-lg:flex-none">
        <div className="flex items-center gap-5 text-fg-soft">
          <button
            type="button"
            onClick={() => player.restart()}
            className="grid size-9 place-items-center rounded-full hover:text-fg max-lg:hidden"
          >
            <ArrowCounterClockwise aria-hidden="true" size={19} />
            <span className="sr-only">Play from the start</span>
          </button>
          <button
            type="button"
            onClick={() => player.toggle()}
            className="grid size-10 place-items-center rounded-full bg-fg text-base transition-transform duration-150 ease-out active:scale-95"
          >
            {playing ? (
              <Pause aria-hidden="true" size={18} weight="fill" />
            ) : (
              <Play aria-hidden="true" size={18} weight="fill" />
            )}
            <span className="sr-only">{playing ? "Pause" : "Play"}</span>
          </button>
          <button
            type="button"
            aria-pressed={Boolean(s.liked)}
            onClick={() => void player.like(!s.liked)}
            className={cx(
              "grid size-9 place-items-center rounded-full hover:text-fg",
              s.liked && "text-[#ff6b8b] hover:text-[#ff6b8b]",
            )}
          >
            <Heart aria-hidden="true" size={20} weight={s.liked ? "fill" : "regular"} />
            <span className="sr-only">{s.liked ? "Liked" : "Like"}</span>
          </button>
        </div>
        <div className="flex w-full max-w-[32.5rem] items-center gap-2.5 text-[0.75rem] text-fg-soft tabular-nums max-lg:hidden">
          <span className="w-9 text-right">{clock(positionMs)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.round(total))}
            step={500}
            value={Math.round(Math.min(positionMs, total))}
            onChange={(e) => player.seek(Number(e.target.value))}
            aria-label="Where in the song"
            aria-valuetext={`${clock(positionMs)} of ${clock(total)}`}
            className="r-range flex-1"
            style={{ ["--fill" as string]: `${share * 100}%` }}
          />
          <span className="w-9">{clock(total)}</span>
        </div>
      </div>

      <div className="flex w-[21rem] items-center justify-end gap-3.5 text-fg-soft max-lg:hidden">
        <button
          type="button"
          onClick={() => openComposer({ mode: "post", sound: s })}
          className="h-9 rounded-full bg-fg/10 px-4 text-[0.88rem] font-bold text-fg hover:bg-fg/15"
        >
          Use this sound
        </button>
        <button
          type="button"
          onClick={() => {
            if (volume > 0) {
              lastVolume.current = volume;
              player.setVolume(0);
            } else player.setVolume(lastVolume.current || 0.8);
          }}
          className="grid size-9 place-items-center rounded-full hover:text-fg"
        >
          {volume > 0 ? (
            <SpeakerHigh aria-hidden="true" size={20} />
          ) : (
            <SpeakerSlash aria-hidden="true" size={20} />
          )}
          <span className="sr-only">{volume > 0 ? "Mute" : "Unmute"}</span>
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => player.setVolume(Number(e.target.value) / 100)}
          aria-label="Volume"
          className="r-range w-[5.75rem]"
          style={{ ["--fill" as string]: `${volume * 100}%` }}
        />
      </div>
    </section>
  );
}
