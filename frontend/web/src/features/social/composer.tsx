"use client";

import { ImageSquare, MagnifyingGlass, MusicNotes, X } from "@phosphor-icons/react";
import type { Post, Sound, SoundList, Story } from "@realm/contracts";
import { type FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { player } from "@/features/music/player";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { kindOf, uploadFile } from "@/lib/upload";

type Mode = "post" | "story";
interface Open {
  mode: Mode;
  sound?: Sound;
}

let opened: Open | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** Opens the maker for a post or a Story, optionally with a song already chosen. */
export function openComposer(o: Open | null) {
  opened = o;
  for (const l of listeners) l();
}
/** Pages listen for what was just made (Home adds it to the top). */
const made = new Set<(x: { post?: Post; story?: Story }) => void>();
export function onMade(fn: (x: { post?: Post; story?: Story }) => void) {
  made.add(fn);
  return () => {
    made.delete(fn);
  };
}

/** The part of a song that plays: 30 seconds on a post, the Story's length on a Story. */
const PART_MS = 30_000;

/**
 * Making a post or a Story on the website: a photo (or a short video for a Story), words, and a
 * song from Realm's free library. The photo shows large before it's shared.
 */
export function Composer() {
  const open = useSyncExternalStore(
    subscribe,
    () => opened,
    () => null,
  );
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("post");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [sound, setSound] = useState<Sound | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Sound[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setMode(open.mode);
      setSound(open.sound ?? null);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Songs: popular ones to start with, then what you search for.
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(
      () => {
        const q = query.trim();
        api<SoundList | { items: Sound[] }>(
          q ? `/sounds?q=${encodeURIComponent(q)}` : "/sounds/trending",
          {
            signal: ctrl.signal,
          },
        )
          .then((r) => setFound(r.items.slice(0, 8)))
          .catch(() => {});
      },
      query ? 350 : 0,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  const reset = () => {
    setFile(null);
    setCaption("");
    setSound(null);
    setQuery("");
    setProgress(null);
    setError("");
  };
  const close = () => {
    openComposer(null);
    reset();
  };

  const share = async (e: FormEvent) => {
    e.preventDefault();
    if (!file)
      return setError(mode === "post" ? "Pick a photo first." : "Pick a photo or video first.");
    const kind = kindOf(file);
    if (kind !== "image" && !(mode === "story" && kind === "video")) {
      return setError(mode === "post" ? "Posts take photos." : "Stories take a photo or a video.");
    }
    setError("");
    setProgress(0);
    try {
      const media = await uploadFile(file, { kind, filename: file.name }, setProgress);
      const pick = sound ? { soundId: sound.id, startMs: 0, durationMs: PART_MS } : undefined;
      if (mode === "post") {
        const post = await api<Post>("/posts", {
          body: {
            kind: "image",
            mediaIds: [media.id],
            ...(caption.trim() ? { caption: caption.trim() } : {}),
            ...(pick ? { sound: pick } : {}),
          },
        });
        for (const fn of made) fn({ post });
      } else {
        const story = await api<Story>("/stories", {
          body: {
            mediaId: media.id,
            ...(caption.trim() ? { caption: caption.trim().slice(0, 200) } : {}),
            ...(pick ? { sound: { ...pick, durationMs: 15_000 } } : {}),
          },
        });
        for (const fn of made) fn({ story });
      }
      close();
    } catch (err) {
      setProgress(null);
      setError(err instanceof ApiError ? err.message : "That didn't share. Try again.");
    }
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it (the dialog's own cancel).
    <dialog
      ref={ref}
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
      aria-label={mode === "post" ? "New post" : "New Story"}
      className="m-auto max-h-[92vh] w-[min(56rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] bg-surface p-0 text-fg backdrop:bg-[rgb(5_5_7/0.8)]"
    >
      <form onSubmit={share} className="flex max-h-[92vh] flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="flex gap-1.5">
            {(["post", "story"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cx(
                  "h-9 rounded-full px-4 font-bold",
                  mode === m ? "bg-fg text-base" : "bg-fg/8 text-fg-soft hover:text-fg",
                )}
              >
                {m === "post" ? "Post" : "Story"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            className="ml-auto grid size-9 place-items-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
          >
            <X aria-hidden="true" size={20} />
            <span className="sr-only">Close</span>
          </button>
        </header>
        <div className="flex min-h-0 flex-1 max-md:flex-col">
          <label
            className={cx(
              "relative grid min-h-[22rem] flex-1 cursor-pointer place-items-center overflow-hidden bg-[#050507]",
              mode === "story" ? "aspect-[9/16] max-h-[70vh]" : "aspect-[4/5] max-h-[70vh]",
            )}
          >
            <input
              type="file"
              accept={mode === "post" ? "image/*" : "image/*,video/*"}
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {preview && file ? (
              file.type.startsWith("video") ? (
                <video
                  src={preview}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                // biome-ignore lint/performance/noImgElement: a local preview (blob URL).
                <img
                  src={preview}
                  alt="What you’ll share"
                  className="absolute inset-0 size-full object-cover"
                />
              )
            ) : (
              <span className="flex flex-col items-center gap-3 text-center text-fg-soft">
                <ImageSquare aria-hidden="true" size={46} />
                <span className="font-bold text-fg">
                  {mode === "post" ? "Choose a photo" : "Choose a photo or a video"}
                </span>
                <span className="text-[0.9rem]">It shows here, big, before you share it.</span>
              </span>
            )}
            {preview && sound && (
              <span className="absolute bottom-3 left-3 flex h-10 items-center gap-2 rounded-full bg-[rgb(9_9_12/0.78)] pr-3.5 pl-[5px] text-[0.82rem]">
                {sound.coverUrl ? (
                  // biome-ignore lint/performance/noImgElement: a song cover.
                  <img
                    src={sound.coverUrl}
                    alt=""
                    className="size-[30px] rounded-full object-cover"
                  />
                ) : (
                  <MusicNotes aria-hidden="true" size={18} className="ml-1.5" />
                )}
                <b>{sound.title}</b>
                <span className="text-fg-soft">{sound.artist}</span>
              </span>
            )}
          </label>
          <div className="flex w-[22rem] shrink-0 flex-col gap-3 overflow-y-auto p-4 max-md:w-full">
            <label className="block">
              <span className="mb-1.5 block font-bold">
                {mode === "post" ? "Caption" : "Words on it"}
              </span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={mode === "post" ? 2200 : 200}
                rows={3}
                placeholder={mode === "post" ? "Say something about it…" : "A few words (optional)"}
                className="w-full resize-none rounded-input border-[1.5px] border-line-strong bg-base/70 px-3.5 py-2.5 text-fg outline-none placeholder:text-fg-muted focus-visible:border-accent"
              />
            </label>
            <div>
              <p className="mb-1.5 font-bold">Music</p>
              <div className="flex items-center gap-2 rounded-full bg-surface-raised px-3.5">
                <MagnifyingGlass aria-hidden="true" size={17} className="text-fg-soft" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search songs"
                  aria-label="Search songs"
                  className="h-10 min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-muted"
                />
              </div>
              <ul className="mt-2 space-y-1">
                {found.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={sound?.id === s.id}
                      onClick={() => {
                        setSound(sound?.id === s.id ? null : s);
                        if (sound?.id !== s.id) player.play(s, { from: "the song picker" });
                      }}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-fg/6",
                        sound?.id === s.id && "bg-fg/8",
                      )}
                    >
                      {s.coverUrl ? (
                        // biome-ignore lint/performance/noImgElement: a song cover.
                        <img src={s.coverUrl} alt="" className="size-10 rounded-lg object-cover" />
                      ) : (
                        <span className="grid size-10 place-items-center rounded-lg bg-surface-raised">
                          <MusicNotes aria-hidden="true" size={18} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{s.title}</span>
                        <span className="block truncate text-[0.82rem] text-fg-soft">
                          {s.artist}
                        </span>
                      </span>
                      {sound?.id === s.id && (
                        <span className="text-[0.82rem] font-bold text-accent">Chosen</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {error && (
              <p role="alert" className="text-[0.92rem] text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              aria-disabled={progress !== null || undefined}
              className="mt-auto h-12 rounded-full bg-accent font-bold text-on-accent aria-disabled:opacity-70"
            >
              {progress !== null
                ? progress < 1
                  ? `Uploading ${Math.round(progress * 100)}%`
                  : "Sharing…"
                : mode === "post"
                  ? "Share the post"
                  : "Share to your Story"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
