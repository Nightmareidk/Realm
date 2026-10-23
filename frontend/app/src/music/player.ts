import type { Sound, SoundUse } from "@realm/contracts";
import { createVideoPlayer, type VideoPlayer } from "expo-video";
import { useSyncExternalStore } from "react";
import { mediaSource, resolveUrl } from "../server";

/**
 * One music player for the whole app: a sound plays its chosen part (looping inside it), and
 * starting another sound stops the first. It keeps playing while you move around the app; the
 * Now Playing bar above the tabs shows it and can pause or close it. It uses the video player
 * the app already has, which plays music files too. Library tracks stream from Jamendo;
 * creators' own sounds from Realm.
 */

export interface NowPlaying {
  /** What's playing it: "post:<id>", "story:<id>", "clip:<id>", "preview:<id>"… */
  key: string;
  sound: Sound;
  startMs: number;
  playMs: number;
  /** Where it came from, for the bar ("Noor's post"). */
  from: string | null;
  paused: boolean;
}

let player: VideoPlayer | null = null;
let now: NowPlaying | null = null;
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

/** Keep to the chosen part: back to its start when it ends (or if a seek before loading was lost). */
function guard(p: VideoPlayer, startMs: number, playMs: number) {
  clearTimer();
  timer = setInterval(() => {
    const at = p.currentTime * 1000;
    if (at < startMs - 600 || at >= startMs + playMs) p.currentTime = startMs / 1000;
  }, 250);
}

/** Play a sound from `startMs` for `playMs`, looping that part. A key says what's playing. */
export async function playSound(
  s: Sound,
  startMs = 0,
  playMs = 15_000,
  key = s.id,
  from: string | null = null,
) {
  const mine = ++turn;
  clearTimer();
  now = { key, sound: s, startMs, playMs, from, paused: false };
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
    guard(p, startMs, playMs);
  } catch {
    if (mine === turn) {
      now = null;
      emit();
    }
  }
}

export function playUse(u: SoundUse, key: string, from: string | null = null) {
  return playSound(u, u.startMs, u.playMs, key, from);
}

/** Stop and forget it (the bar's close button, leaving a Story). */
export function stopSound() {
  turn++;
  clearTimer();
  try {
    player?.pause();
  } catch {
    // Already stopped.
  }
  now = null;
  emit();
}

export function pauseSound() {
  if (!now || now.paused) return;
  clearTimer();
  try {
    player?.pause();
  } catch {
    // Nothing to pause.
  }
  now = { ...now, paused: true };
  emit();
}

export function resumeSound() {
  if (!now?.paused || !player) return;
  player.play();
  guard(player, now.startMs, now.playMs);
  now = { ...now, paused: false };
  emit();
}

/** Play or stop, for a music chip. */
export function toggleSound(u: SoundUse, key: string, from: string | null = null) {
  if (now?.key === key && !now.paused) pauseSound();
  else if (now?.key === key && now.paused) resumeSound();
  else playUse(u, key, from);
}

/** How far into the part it is, 0 to 1 (for the bar's line). */
export function progress(): number {
  if (!now || !player) return 0;
  try {
    return Math.max(0, Math.min(1, (player.currentTime * 1000 - now.startMs) / now.playMs));
  } catch {
    return 0;
  }
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** What's playing now (its key), to show a playing state; null when paused or stopped. */
export function usePlaying() {
  return useSyncExternalStore(subscribe, () => (now && !now.paused ? now.key : null));
}

/** Everything about what's playing, for the Now Playing bar. */
export function useNowPlaying() {
  return useSyncExternalStore(subscribe, () => now);
}

/** 83000 → "1:23". */
export const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The credit a library track needs wherever it's used. */
export const credit = (s: Sound) =>
  s.kind === "library" ? `${s.title} by ${s.artist}${s.licence ? ` (${s.licence})` : ""}` : null;
