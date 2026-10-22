import type { Sound, SoundUse } from "@realm/contracts";
import { createVideoPlayer, type VideoPlayer } from "expo-video";
import { useSyncExternalStore } from "react";
import { mediaSource, resolveUrl } from "../server";

/**
 * One music player for the whole app: a sound plays its chosen part (looping inside it), and
 * starting another sound stops the first. It uses the video player the app already has, which
 * plays music files too. Library tracks stream from Jamendo; creators' own sounds from Realm.
 */

let player: VideoPlayer | null = null;
let playing: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
// Each play gets a number, so a slow load can't start a sound you've already moved on from.
let turn = 0;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

function source(s: Sound) {
  return s.kind === "original" ? mediaSource(s.audioUrl) : { uri: resolveUrl(s.audioUrl) };
}

function clearTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Play a sound from `startMs` for `playMs`, looping that part. A key says what's playing. */
export async function playSound(s: Sound, startMs = 0, playMs = 15_000, key = s.id) {
  const mine = ++turn;
  clearTimer();
  playing = key;
  emit();
  try {
    if (!player) player = createVideoPlayer(null);
    const p = player;
    p.pause();
    await p.replaceAsync(source(s));
    if (mine !== turn) return;
    p.muted = false;
    p.loop = false;
    p.currentTime = startMs / 1000;
    p.play();
    // Keep to the chosen part. A seek made before the file loaded can be dropped, so this also
    // puts it back at the start if it's still before it.
    timer = setInterval(() => {
      const at = p.currentTime * 1000;
      if (at < startMs - 600 || at >= startMs + playMs) p.currentTime = startMs / 1000;
    }, 250);
  } catch {
    if (mine === turn) {
      playing = null;
      emit();
    }
  }
}

export function playUse(u: SoundUse, key: string) {
  return playSound(u, u.startMs, u.playMs, key);
}

export function stopSound() {
  turn++;
  clearTimer();
  try {
    player?.pause();
  } catch {
    // Already stopped.
  }
  playing = null;
  emit();
}

/** Play or stop, for a music chip. */
export function toggleSound(u: SoundUse, key: string) {
  if (playing === key) stopSound();
  else playUse(u, key);
}

/** What's playing now (its key), to show a playing state. */
export function usePlaying() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => playing,
  );
}

/** 83000 → "1:23". */
export const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The credit a library track needs wherever it's used. */
export const credit = (s: Sound) =>
  s.kind === "library" ? `${s.title} by ${s.artist}${s.licence ? ` (${s.licence})` : ""}` : null;
