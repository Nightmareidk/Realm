"use client";

import type { Sound } from "@realm/contracts";
import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";

/**
 * The website's one music player (Look B's Now Playing bar): a song keeps playing while you move
 * around Realm. A post's song plays from the part its author picked. What played last is
 * remembered on this device, so the bar is never empty after a reload.
 */
export interface Playing {
  sound: Sound;
  /** Where it came from, for the bar ("Aras's post"). */
  from: string | null;
  /** The part to start at. */
  startMs: number;
  /** A key for what started it (a post, a Story), so its chip can show it's playing. */
  key: string;
}

interface State {
  now: Playing | null;
  /** A list being played through (a playlist, Liked songs, a mood), and where in it. */
  queue: { items: Sound[]; at: number; from: string } | null;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
}

const KEY = "realm:now-playing";
const VOLUME = "realm:volume";
const initial: State = {
  now: null,
  queue: null,
  playing: false,
  positionMs: 0,
  durationMs: 0,
  volume: 0.8,
};
let state = initial;
const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function el() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "metadata";
  try {
    const v = Number(localStorage.getItem(VOLUME));
    if (v >= 0 && v <= 1 && localStorage.getItem(VOLUME) !== null) set({ volume: v });
  } catch {}
  audio.volume = state.volume;
  audio.addEventListener("timeupdate", () => set({ positionMs: (audio?.currentTime ?? 0) * 1000 }));
  audio.addEventListener("durationchange", () => {
    const d = audio?.duration ?? 0;
    if (Number.isFinite(d)) set({ durationMs: d * 1000 });
  });
  audio.addEventListener("play", () => set({ playing: true }));
  audio.addEventListener("pause", () => set({ playing: false }));
  audio.addEventListener("ended", () => {
    set({ playing: false });
    // A list carries on to its next song.
    if (state.queue && state.queue.at < state.queue.items.length - 1) player.step(1);
  });
  return audio;
}

function remember(now: Playing | null) {
  try {
    if (now) localStorage.setItem(KEY, JSON.stringify({ sound: now.sound, from: now.from }));
  } catch {}
}

export const player = {
  /** Plays a song (or carries on with it if it's the one already loaded). */
  play(sound: Sound, opts: { from?: string | null; startMs?: number; key?: string } = {}) {
    const a = el();
    const key = opts.key ?? `sound:${sound.id}`;
    if (!key.startsWith("list:") && state.queue) set({ queue: null });
    if (state.now?.sound.id === sound.id && a.src) {
      if (state.now.key !== key) set({ now: { ...state.now, key, from: opts.from ?? null } });
      void a.play().catch(() => set({ playing: false }));
      return;
    }
    const now = { sound, from: opts.from ?? null, startMs: opts.startMs ?? 0, key };
    set({ now, positionMs: now.startMs, durationMs: sound.durationMs });
    remember(now);
    a.src = sound.audioUrl;
    a.currentTime = now.startMs / 1000;
    void a.play().catch(() => set({ playing: false }));
  },
  /** Plays a list from one of its songs; the next ones follow, and it goes to Recently played. */
  playList(items: Sound[], at: number, from: string) {
    const sound = items[at];
    if (!sound) return;
    set({ queue: { items, at, from } });
    player.play(sound, { from, key: `list:${sound.id}` });
    void api(`/music/played/${sound.id}`, { body: {} }).catch(() => {});
  },
  /** The next (1) or previous (-1) song in the list. */
  step(by: 1 | -1) {
    const q = state.queue;
    if (!q) return;
    // Back near the start of a song restarts it, like music apps.
    if (by === -1 && state.positionMs > 3000) return player.seek(0);
    const at = (q.at + by + q.items.length) % q.items.length;
    player.playList(q.items, at, q.from);
  },
  /** Shows a song in the bar without playing it (the last one played, or a suggestion). */
  cue(sound: Sound, from: string | null = null) {
    if (state.now) return;
    set({
      now: { sound, from, startMs: 0, key: `sound:${sound.id}` },
      durationMs: sound.durationMs,
    });
  },
  toggle() {
    const a = el();
    if (!state.now) return;
    if (!a.src) {
      player.play(state.now.sound, { from: state.now.from, key: state.now.key });
      return;
    }
    if (a.paused) void a.play().catch(() => set({ playing: false }));
    else a.pause();
  },
  pause() {
    audio?.pause();
  },
  seek(ms: number) {
    const a = el();
    if (!a.src && state.now) player.play(state.now.sound, { from: state.now.from });
    a.currentTime = Math.max(0, ms / 1000);
    set({ positionMs: ms });
  },
  restart() {
    player.seek(state.now?.startMs ?? 0);
  },
  setVolume(v: number) {
    const volume = Math.min(1, Math.max(0, v));
    el().volume = volume;
    set({ volume });
    try {
      localStorage.setItem(VOLUME, String(volume));
    } catch {}
  },
  /** Like or unlike the song playing; it goes to Liked songs. */
  async like(on: boolean) {
    const now = state.now;
    if (!now) return;
    set({ now: { ...now, sound: { ...now.sound, liked: on } } });
    try {
      await api(`/music/liked/${now.sound.id}`, { method: on ? "PUT" : "DELETE" });
    } catch {
      set({ now: { ...now, sound: { ...now.sound, liked: !on } } });
    }
  },
  /** The song played last on this device, if any. */
  restore() {
    if (state.now) return;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
        sound: Sound;
        from: string | null;
      } | null;
      if (saved?.sound?.audioUrl) player.cue(saved.sound, saved.from);
    } catch {}
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePlayer() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
}

/** "0:42". */
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
