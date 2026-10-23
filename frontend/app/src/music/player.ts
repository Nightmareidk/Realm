import type { Sound, SoundUse } from "@realm/contracts";
import { createVideoPlayer, type VideoPlayer } from "expo-video";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { api, mediaSource, resolveUrl } from "../server";

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
  /** Listening through a list (Sounds people use): the songs, and where in them. */
  queue: Sound[] | null;
  at: number;
}

/** Listening through a list: shuffle, and repeat off / the whole list / this song. */
let shuffle = false;
let repeat: "off" | "all" | "one" = "all";
/** The list in the order it was given, so shuffle can be turned off again. */
let given: Sound[] | null = null;
/** Liked songs changed here, before the server's answer comes back. */
const likedHere = new Map<string, boolean>();

let player: VideoPlayer | null = null;

/**
 * In a browser the phone's video player makes no sound without a screen element to play in, so
 * the browser gets a plain audio element with the same few controls. A creator's own sound needs
 * the session to read, which an audio element can't send, so it's fetched first.
 */
function browserPlayer(): VideoPlayer {
  const el = new Audio();
  el.preload = "auto";
  let blobUrl: string | null = null;
  const shim = {
    get currentTime() {
      return el.currentTime;
    },
    set currentTime(v: number) {
      try {
        el.currentTime = v;
      } catch {
        // Not loaded yet; the guard puts it right once it is.
      }
    },
    get muted() {
      return el.muted;
    },
    set muted(v: boolean) {
      el.muted = v;
    },
    loop: false,
    staysActiveInBackground: true,
    showNowPlayingNotification: false,
    play() {
      el.play().catch(() => {
        // The browser wants a tap on the page first; the next play works.
      });
    },
    pause() {
      el.pause();
    },
    async replaceAsync(src: { uri: string; headers?: Record<string, string> } | null) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = null;
      if (!src) {
        el.removeAttribute("src");
        return;
      }
      if (src.headers) {
        const res = await fetch(src.uri, { headers: src.headers });
        if (!res.ok) throw new Error(`audio ${res.status}`);
        blobUrl = URL.createObjectURL(await res.blob());
        el.src = blobUrl;
      } else {
        el.src = src.uri;
      }
      el.load();
    },
  };
  return shim as unknown as VideoPlayer;
}
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

/**
 * Keep to the chosen part: back to its start when it ends (or if a seek before loading was
 * lost). Listening through a list, the end moves on to the next song instead.
 */
function guard(p: VideoPlayer, startMs: number, playMs: number) {
  clearTimer();
  timer = setInterval(() => {
    const at = p.currentTime * 1000;
    if (at >= startMs + playMs && now?.queue) {
      if (repeat === "one") p.currentTime = startMs / 1000;
      else if (repeat === "off" && now.at === now.queue.length - 1) pauseSound();
      else skip(1);
      return;
    }
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
  queue: Sound[] | null = null,
  at = 0,
) {
  const mine = ++turn;
  clearTimer();
  now = { key, sound: s, startMs, playMs, from, paused: false, queue, at };
  emit();
  try {
    if (!player) player = Platform.OS === "web" ? browserPlayer() : createVideoPlayer(null);
    const p = player;
    p.pause();
    await p.replaceAsync(source(s));
    if (mine !== turn) return;
    p.muted = false;
    p.loop = false;
    p.currentTime = startMs / 1000;
    // Keeps playing with the screen off or in another app, with lock-screen controls (on a
    // build that allows background audio).
    try {
      p.staysActiveInBackground = true;
      p.showNowPlayingNotification = true;
    } catch {
      // Not on this platform.
    }
    p.play();
    guard(p, startMs, playMs);
    // Played from the music library: it goes to Recently played.
    if (queue) api(`/music/played/${s.id}`, { body: {} }).catch(() => {});
  } catch {
    if (mine === turn) {
      now = null;
      emit();
    }
  }
}

/** Listen through a list of songs, whole, one after another, from `at`. */
export function playList(list: Sound[], at: number, from: string, keepOrder = false) {
  if (!keepOrder) {
    given = list;
    if (shuffle) {
      // The chosen song first, then the rest in a random order.
      const first = list[at];
      const rest = list.filter((_, i) => i !== at).sort(() => Math.random() - 0.5);
      list = first ? [first, ...rest] : rest;
      at = 0;
    }
  }
  const s = list[at];
  if (!s) return;
  return playSound(
    s,
    0,
    Math.max(5_000, s.durationMs || 30_000),
    `bar:list:${s.id}`,
    from,
    list,
    at,
  );
}

/** The next (1) or previous (-1) song in the list being played; round the end to the start. */
export function skip(dir: 1 | -1) {
  if (!now?.queue?.length) return;
  // Back, a few seconds into a song: start it again (as music apps do).
  if (dir === -1 && player && player.currentTime > 4) {
    player.currentTime = 0;
    return;
  }
  const n = now.queue.length;
  playList(now.queue, (now.at + dir + n) % n, now.from ?? "", true);
}

/** Jump to a song in the list that's playing (Up next). */
export function playAt(at: number) {
  if (!now?.queue) return;
  playList(now.queue, at, now.from ?? "", true);
}

/** Move to a point in the song (the player's line). */
export function seek(ms: number) {
  if (!player || !now) return;
  const to = Math.max(now.startMs, Math.min(now.startMs + now.playMs - 500, ms));
  player.currentTime = to / 1000;
}

/** Where it is and how long it is, in ms, for the full player. */
export function position(): { at: number; length: number } {
  if (!player || !now) return { at: 0, length: 0 };
  try {
    return { at: Math.max(0, player.currentTime * 1000 - now.startMs), length: now.playMs };
  } catch {
    return { at: 0, length: now.playMs };
  }
}

export function setShuffle(on: boolean) {
  shuffle = on;
  if (!now?.queue || !given) return emit();
  const playing = now.queue[now.at];
  const list = on
    ? [playing, ...now.queue.filter((_, i) => i !== now?.at).sort(() => Math.random() - 0.5)]
    : given;
  const at = Math.max(
    0,
    list.findIndex((x) => x?.id === playing?.id),
  );
  now = { ...now, queue: list.filter(Boolean) as Sound[], at };
  emit();
}

export function cycleRepeat() {
  repeat = repeat === "all" ? "one" : repeat === "one" ? "off" : "all";
  emit();
}

export function useModes() {
  return useSyncExternalStore(subscribe, () => `${shuffle}:${repeat}`).split(":") as [
    "true" | "false",
    "off" | "all" | "one",
  ];
}

/** Like or unlike a song (Liked songs). */
export async function like(s: Sound, on: boolean) {
  likedHere.set(s.id, on);
  emit();
  try {
    await api(`/music/liked/${s.id}`, { method: on ? "PUT" : "DELETE" });
  } catch {
    likedHere.set(s.id, !on);
    emit();
  }
}

/** Whether a song is liked, counting changes made here. */
export function useLiked(s: Sound | undefined) {
  return useSyncExternalStore(subscribe, () =>
    s ? (likedHere.get(s.id) ?? s.liked ?? false) : false,
  );
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

/** Songs on posts play by themselves as you scroll, until you mute them (one tap on a song). */
let feedSound = true;

/**
 * A post with a song is on screen: play its part (unless you've muted feed songs, or you're
 * listening to something you chose, which a scroll never interrupts).
 */
export function feedPlay(u: SoundUse, postId: string, from: string) {
  if (!feedSound) return;
  if (now && !now.key.startsWith("feed:") && !now.paused) return;
  if (now?.key === `feed:${postId}`) return;
  playUse(u, `feed:${postId}`, from);
}

/** No post with a song on screen: its song stops (yours, chosen from Music, carries on). */
export function feedStop() {
  if (now?.key.startsWith("feed:")) stopSound();
}

/** Tap a post's song: mute or unmute songs in the feed. */
export function toggleFeedSound(u: SoundUse, postId: string, from: string) {
  if (now?.key === `feed:${postId}` && !now.paused) {
    feedSound = false;
    stopSound();
  } else {
    feedSound = true;
    playUse(u, `feed:${postId}`, from);
  }
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
