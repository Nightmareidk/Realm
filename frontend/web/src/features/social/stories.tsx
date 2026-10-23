"use client";

import { CaretLeft, CaretRight, Pause, Play, Plus, X } from "@phosphor-icons/react";
import type { Story, StoryRing } from "@realm/contracts";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { player } from "@/features/music/player";
import { Avatar } from "@/features/spaces/person";
import { api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { ago, Verified } from "./shared";

/** The ring around someone with new Stories: their colours, turning; grey once seen. */
export function Ring({
  unseen,
  size,
  children,
}: {
  unseen: boolean;
  size: number;
  children: React.ReactNode;
}) {
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full p-[3px]"
      style={{
        width: size,
        height: size,
        background: unseen
          ? "conic-gradient(from 200deg, var(--r-light-1), var(--r-accent), var(--r-light-2), var(--r-light-1))"
          : "var(--r-surface-raised)",
      }}
    >
      <span className="grid size-full place-items-center rounded-full shadow-[0_0_0_3px_var(--r-surface)]">
        {children}
      </span>
    </span>
  );
}

/**
 * The Stories row (Look B): you first with a +, then people with new Stories (their song's cover
 * on a little disc). Opens the viewer.
 */
export function StoryRings({
  rings,
  me,
  onOpen,
  onAdd,
}: {
  rings: StoryRing[];
  me: { id: string; displayName: string; avatarUrl: string | null };
  onOpen: (index: number) => void;
  onAdd: () => void;
}) {
  const mineAt = rings.findIndex((r) => r.author.id === me.id);
  const others = rings.map((r, i) => ({ r, i })).filter(({ r }) => r.author.id !== me.id);
  return (
    <ul
      className="flex gap-4 overflow-x-auto pt-1.5 pb-[22px] [scrollbar-width:none]"
      aria-label="Stories"
    >
      <li className="w-[72px] shrink-0 text-center">
        <span className="relative mx-auto block size-[72px]">
          <button
            type="button"
            onClick={() => (mineAt >= 0 ? onOpen(mineAt) : onAdd())}
            className="block rounded-full"
          >
            <Ring unseen={mineAt >= 0 && Boolean(rings[mineAt]?.unseen)} size={72}>
              <Avatar user={me} size={64} />
            </Ring>
            <span className="sr-only">{mineAt >= 0 ? "Your Story" : "Add to your Story"}</span>
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="absolute right-[-2px] bottom-0 grid size-[26px] place-items-center rounded-full bg-accent text-on-accent shadow-[0_0_0_3px_var(--r-surface)]"
          >
            <Plus aria-hidden="true" size={15} weight="bold" />
            <span className="sr-only">Add to your Story</span>
          </button>
        </span>
        <span className="mt-1.5 block truncate text-[0.75rem] text-fg-soft">Your story</span>
      </li>
      {others.map(({ r, i }) => {
        const song = r.stories.find((s) => s.sound)?.sound;
        return (
          <li key={r.author.id} className="w-[72px] shrink-0 text-center">
            <button type="button" onClick={() => onOpen(i)} className="relative mx-auto block">
              <Ring unseen={r.unseen} size={72}>
                <Avatar user={r.author} size={64} />
              </Ring>
              {song?.coverUrl && (
                <span className="absolute right-[-4px] bottom-[-2px] size-7">
                  {/* biome-ignore lint/performance/noImgElement: a song cover from the music library. */}
                  <img
                    src={song.coverUrl}
                    alt=""
                    className="size-7 rounded-full object-cover shadow-[0_0_0_3px_var(--r-surface)]"
                  />
                  <span className="absolute top-1/2 left-1/2 size-[7px] -translate-1/2 rounded-full bg-surface" />
                </span>
              )}
              <span className="sr-only">
                {r.author.displayName}'s Story{r.unseen ? ", new" : ""}
              </span>
            </button>
            <span className="mt-1.5 block truncate text-[0.75rem] text-fg-soft">
              {r.author.displayName.split(" ")[0]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Stories full screen: bars along the top, the picture or video, the song playing, and the next
 * one by itself. Click the right side (or →) for the next, the left (or ←) for the one before;
 * hold to pause; Escape closes.
 */
export function StoryViewer({
  rings,
  start,
  title,
  onClose,
  onSeen,
}: {
  rings: { author: Story["author"]; stories: Story[] }[];
  start: number;
  /** A highlight's name, shown instead of the time. */
  title?: string;
  onClose: () => void;
  onSeen?: (story: Story) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [ring, setRing] = useState(start);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const current = rings[ring];
  const story = current?.stories[at];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => player.pause();
  }, []);

  const next = useCallback(() => {
    if (!current) return onClose();
    if (at < current.stories.length - 1) setAt(at + 1);
    else if (ring < rings.length - 1) {
      setRing(ring + 1);
      setAt(0);
    } else onClose();
  }, [at, ring, current, rings.length, onClose]);
  const prev = useCallback(() => {
    if (at > 0) setAt(at - 1);
    else if (ring > 0) {
      setRing(ring - 1);
      setAt(0);
    }
  }, [at, ring]);

  // A new Story: count it seen, play its song, start its clock.
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    if (!story.seen) {
      void api(`/stories/${story.id}/view`, { method: "POST" }).catch(() => {});
      onSeen?.(story);
    }
    if (story.sound) {
      player.play(story.sound, {
        from: `${story.author.displayName}'s Story`,
        startMs: story.sound.startMs,
        key: `story:${story.id}`,
      });
    } else player.pause();
  }, [story, onSeen]);

  // The clock restarts only when the Story or pause changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: progress is read once on start.
  useEffect(() => {
    if (!story || paused || story.media.kind === "video") return;
    const length = story.durationMs;
    const began = performance.now() - progress * length;
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - began) / length);
      setProgress(p);
      if (p >= 1) next();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [story, paused, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={current ? `${current.author.displayName}'s Story` : "Story"}
      className="m-0 size-full max-h-none max-w-none bg-[rgb(5_5_7/0.96)] p-0 text-fg backdrop:bg-transparent"
    >
      {story && current && (
        <div className="relative flex size-full items-center justify-center">
          {story.media.kind === "image" && (
            // biome-ignore lint/performance/noImgElement: a decorative blur of the Story's photo.
            <img
              src={story.media.url}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full object-cover opacity-40 blur-[90px] saturate-150"
            />
          )}
          <button
            type="button"
            onClick={prev}
            className="absolute left-[max(1rem,calc(50%-19rem))] z-10 grid size-11 place-items-center rounded-full bg-fg/15 text-fg hover:bg-fg/25 max-md:hidden"
          >
            <CaretLeft aria-hidden="true" size={20} weight="bold" />
            <span className="sr-only">Previous</span>
          </button>
          <div className="relative aspect-[9/16] h-[min(92vh,52rem)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[22px] bg-[#050507]">
            {story.media.kind === "video" ? (
              <video
                key={story.id}
                src={story.media.url}
                autoPlay
                playsInline
                muted={Boolean(story.sound)}
                onEnded={next}
                onTimeUpdate={(e) =>
                  setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))
                }
                className="size-full object-cover"
              />
            ) : (
              // biome-ignore lint/performance/noImgElement: people's Story photos, behind an access check.
              <img
                key={story.id}
                src={story.media.url}
                alt={story.caption ?? `${current.author.displayName}'s Story`}
                className="size-full object-cover"
              />
            )}
            {/* Halves: back and forward; holding pauses. */}
            <button
              type="button"
              aria-label="Previous"
              onClick={prev}
              onPointerDown={() => setPaused(true)}
              onPointerUp={() => setPaused(false)}
              className="absolute inset-y-0 left-0 w-1/3"
            />
            <button
              type="button"
              aria-label="Next"
              onClick={next}
              onPointerDown={() => setPaused(true)}
              onPointerUp={() => setPaused(false)}
              className="absolute inset-y-0 right-0 w-2/3"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[rgb(0_0_0/0.55)] to-transparent" />
            <div className="absolute inset-x-3 top-3 flex gap-1">
              {current.stories.map((s, i) => (
                <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-fg/30">
                  <span
                    className="block h-full bg-fg"
                    style={{ width: `${i < at ? 100 : i === at ? progress * 100 : 0}%` }}
                  />
                </span>
              ))}
            </div>
            <div className="absolute inset-x-3 top-6 flex items-center gap-2.5">
              <Link
                href={`/u/${current.author.username}`}
                onClick={onClose}
                className="flex min-w-0 items-center gap-2.5"
              >
                <Avatar user={current.author} size={34} />
                <span className="flex min-w-0 items-center gap-1 font-bold">
                  <span className="truncate">{current.author.displayName}</span>
                  <Verified kind={current.author.verified} size={13} />
                </span>
              </Link>
              <span className="text-[0.85rem] text-fg/80">{title ?? ago(story.createdAt)}</span>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="ml-auto grid size-9 place-items-center rounded-full text-fg"
              >
                {paused ? (
                  <Play aria-hidden="true" size={18} weight="fill" />
                ) : (
                  <Pause aria-hidden="true" size={18} weight="fill" />
                )}
                <span className="sr-only">{paused ? "Play" : "Pause"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid size-9 place-items-center rounded-full text-fg"
              >
                <X aria-hidden="true" size={20} />
                <span className="sr-only">Close</span>
              </button>
            </div>
            {(story.caption || story.sound) && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgb(0_0_0/0.6)] to-transparent px-4 pt-16 pb-4">
                {story.caption && (
                  <p className="mb-2 text-[1rem] font-bold text-fg">{story.caption}</p>
                )}
                {story.sound && (
                  <p className="truncate text-[0.85rem] text-fg/85">
                    ♪ {story.sound.title} · {story.sound.artist}
                  </p>
                )}
              </div>
            )}
            {story.views !== null && (
              <p className="absolute right-4 bottom-4 rounded-full bg-[rgb(9_9_12/0.7)] px-3 py-1 text-[0.8rem] font-bold">
                {story.views} {story.views === 1 ? "view" : "views"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={next}
            className={cx(
              "absolute right-[max(1rem,calc(50%-19rem))] z-10 grid size-11 place-items-center rounded-full bg-fg/15 text-fg hover:bg-fg/25 max-md:hidden",
            )}
          >
            <CaretRight aria-hidden="true" size={20} weight="bold" />
            <span className="sr-only">Next</span>
          </button>
        </div>
      )}
    </dialog>
  );
}
