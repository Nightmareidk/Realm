import type { DispatchPayload, DispatchType } from "@realm/contracts/gateway";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { CLIENT_PLATFORM, CLIENT_VERSION, currentToken, gatewayUrl } from "./server";

const OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  TYPING: 8,
  INVALID: 9,
  HELLO: 10,
  ACK: 11,
  WATCH_POSTS: 13,
};
/** The gateway turned the session away: it's over, so stop knocking. */
const AUTH_FAILED = 4004;

interface Frame {
  op: number;
  t?: string;
  d: unknown;
}

export type LiveStatus = "off" | "connecting" | "live";
type Listener = (type: DispatchType, data: unknown) => void;

/**
 * The app's one live connection to Realm (the same gateway as the website): it signs in with the
 * session token, keeps a heartbeat, and reconnects with growing pauses when the network drops.
 * In the background it hangs up, so the phone isn't kept awake and you show as away; coming back
 * reconnects and says so, so open screens can catch up on what they missed.
 */
class Live {
  private ws: WebSocket | null = null;
  private running = false;
  private beat: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private awaitingAck = false;
  private appState: { remove(): void } | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(s: LiveStatus) => void>();
  private lastTyping = new Map<string, number>();
  status: LiveStatus = "off";

  start() {
    if (this.running) return;
    this.running = true;
    this.appState = AppState.addEventListener("change", this.onAppState);
    this.connect();
  }

  stop() {
    this.running = false;
    this.appState?.remove();
    this.appState = null;
    this.hangUp();
  }

  /** Hear every event; returns the way to stop. */
  on(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  onStatus(fn: (s: LiveStatus) => void) {
    this.statusListeners.add(fn);
    return () => {
      this.statusListeners.delete(fn);
    };
  }

  /** Tell the room you're typing, at most once every few seconds. */
  /**
   * The posts on screen: their likes and comments arrive as they happen. Several screens can
   * watch at once (the feed, an open comments sheet); the gateway hears all of them together.
   */
  private watched = new Map<string, string[]>();
  watchPosts(owner: string, ids: string[]) {
    if (ids.length) this.watched.set(owner, ids.slice(0, 20));
    else this.watched.delete(owner);
    this.sendWatched();
  }
  private sendWatched() {
    const all = [...new Set([...this.watched.values()].flat())].slice(0, 30);
    this.send({ op: OP.WATCH_POSTS, d: { postIds: all } });
  }

  typing(channelId: string) {
    const now = Date.now();
    if (now - (this.lastTyping.get(channelId) ?? 0) < 5_000) return;
    this.lastTyping.set(channelId, now);
    this.send({ op: OP.TYPING, d: { channelId } });
  }

  /** You sent something: your typing marker is done. */
  sent(channelId: string) {
    this.lastTyping.delete(channelId);
  }

  private onAppState = (state: AppStateStatus) => {
    if (!this.running) return;
    if (state === "active") {
      if (!this.ws) {
        this.attempts = 0;
        this.connect();
      }
    } else if (state === "background") {
      this.hangUp();
    }
  };

  private setStatus(status: LiveStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const fn of this.statusListeners) fn(status);
  }

  private hangUp() {
    if (this.retry) clearTimeout(this.retry);
    if (this.beat) clearInterval(this.beat);
    this.retry = null;
    this.beat = null;
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000, "bye");
    this.setStatus("off");
  }

  private connect() {
    const url = gatewayUrl();
    const token = currentToken();
    if (!this.running || !url || !token) return;
    this.setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return this.later();
    }
    this.ws = ws;
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      let frame: Frame;
      try {
        frame = JSON.parse(String(e.data)) as Frame;
      } catch {
        return;
      }
      this.receive(frame, token);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.beat) clearInterval(this.beat);
      if (!this.running) return;
      this.setStatus("connecting");
      // Refused: the session ended. The next API call says so and signs this phone out.
      if (e.code === AUTH_FAILED) return this.setStatus("off");
      this.later();
    };
  }

  /** The next try: 1s, 2s, 4s… up to 30s, with jitter so a crowd doesn't return at once. */
  private later() {
    if (!this.running || AppState.currentState === "background") return;
    const delay = Math.min(30_000, 1000 * 2 ** this.attempts) * (0.8 + Math.random() * 0.4);
    this.attempts += 1;
    if (this.retry) clearTimeout(this.retry);
    this.retry = setTimeout(() => this.connect(), delay);
  }

  private send(frame: { op: number; d: unknown }) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(frame));
  }

  private receive(frame: Frame, token: string) {
    switch (frame.op) {
      case OP.HELLO: {
        const interval = (frame.d as { heartbeatInterval: number }).heartbeatInterval;
        this.send({
          op: OP.IDENTIFY,
          d: { token, client: { platform: CLIENT_PLATFORM, version: CLIENT_VERSION } },
        });
        if (this.beat) clearInterval(this.beat);
        this.awaitingAck = false;
        this.beat = setInterval(() => {
          // No answer to the last beat: the line is dead even if the socket doesn't know it yet.
          if (this.awaitingAck) return this.ws?.close(4000, "zombie");
          this.awaitingAck = true;
          this.send({ op: OP.HEARTBEAT, d: null });
        }, interval);
        return;
      }
      case OP.ACK:
        this.awaitingAck = false;
        return;
      case OP.HEARTBEAT:
        this.send({ op: OP.HEARTBEAT, d: null });
        return;
      case OP.INVALID:
        this.ws?.close(4000, "invalid session");
        return;
      case OP.DISPATCH:
        if (!frame.t) return;
        if (frame.t === "READY") {
          this.attempts = 0;
          this.setStatus("live");
          // A new connection: tell it again which posts are on screen.
          if (this.watched.size) this.sendWatched();
        }
        for (const fn of this.listeners) fn(frame.t as DispatchType, frame.d);
        return;
    }
  }
}

export const live = new Live();

/**
 * Run `fn` for one kind of event while the screen is mounted. The latest `fn` is always the one
 * called, so it can read fresh state without re-subscribing.
 */
export function useLiveEvent<T extends DispatchType>(
  type: T,
  fn: (data: DispatchPayload<T>) => void,
) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(
    () =>
      live.on((t, d) => {
        if (t === type) latest.current(d as DispatchPayload<T>);
      }),
    [type],
  );
}

/** Whether the live connection is up, for screens that fall back to checking now and then. */
export function useLiveStatus(): LiveStatus {
  const [status, setStatus] = useState(live.status);
  useEffect(() => {
    setStatus(live.status);
    return live.onStatus(setStatus);
  }, []);
  return status;
}
