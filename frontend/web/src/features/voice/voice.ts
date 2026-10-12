"use client";

import type { VoiceJoin } from "@realm/contracts";
import type { LocalTrackPublication, Participant, RemoteTrack, Room } from "livekit-client";
import { useSyncExternalStore } from "react";
import { realtime } from "@/features/realtime/client";
import { ApiError, api } from "@/lib/api";

export interface VoiceParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  speaking: boolean;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
}

export interface VoiceSnapshot {
  status: "idle" | "connecting" | "connected" | "error";
  channelId: string | null;
  spaceSlug: string | null;
  roomName: string | null;
  error: string;
  canSpeak: boolean;
  canVideo: boolean;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
  participants: VoiceParticipant[];
}

const idle: VoiceSnapshot = {
  status: "idle",
  channelId: null,
  spaceSlug: null,
  roomName: null,
  error: "",
  canSpeak: false,
  canVideo: false,
  micOn: false,
  camOn: false,
  screenOn: false,
  participants: [],
};

let snap: VoiceSnapshot = idle;
const listeners = new Set<() => void>();
const set = (patch: Partial<VoiceSnapshot>) => {
  snap = { ...snap, ...patch };
  for (const l of listeners) l();
};

let room: Room | null = null;
/** Remote voices play through hidden <audio> elements kept here. */
let audioHost: HTMLElement | null = null;

function describe(p: Participant, isLocal: boolean): VoiceParticipant {
  return {
    identity: p.identity,
    name: p.name || "Someone",
    isLocal,
    speaking: p.isSpeaking,
    micOn: p.isMicrophoneEnabled,
    camOn: p.isCameraEnabled,
    screenOn: p.isScreenShareEnabled,
  };
}

function refresh() {
  if (!room) return;
  const local = room.localParticipant;
  set({
    participants: [
      describe(local, true),
      ...[...room.remoteParticipants.values()].map((p) => describe(p, false)),
    ],
    micOn: local.isMicrophoneEnabled,
    camOn: local.isCameraEnabled,
    screenOn: local.isScreenShareEnabled,
  });
}

/** What was last asked of a device, so a failure LiveKit reports on its own names the right one. */
let asking = "microphone";
/** You turned the camera on (so if it goes dark by itself, you hear why). */
let cameraWanted = false;

/** Plain words for why a device didn't start. */
function deviceError(err: unknown, what: string) {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError")
    return `Your browser blocked the ${what}. Allow it in the address bar and try again.`;
  if (name === "NotFoundError") return `No ${what} found on this device.`;
  if (name === "NotReadableError")
    return `The ${what} is busy in another app. Close it there and try again.`;
  return `The ${what} didn't start. Try again.`;
}

/**
 * Join a Space's voice room. LiveKit carries the audio and video; Realm hands out the pass and
 * tells the Space who's in. One call at a time, and it carries on while you move around Realm.
 */
export async function joinVoice(opts: { channelId: string; spaceSlug: string; roomName: string }) {
  if (snap.channelId === opts.channelId && snap.status !== "error") return;
  await leaveVoice();
  set({ ...idle, status: "connecting", ...opts });
  try {
    const pass = await api<VoiceJoin>(`/channels/${opts.channelId}/voice`, { method: "POST" });
    // LiveKit loads only when someone joins a call.
    const { Room: LKRoom, RoomEvent } = await import("livekit-client");
    const r = new LKRoom({ adaptiveStream: true, dynacast: true });
    room = r;
    audioHost ??= Object.assign(document.createElement("div"), { hidden: true });
    if (!audioHost.isConnected) document.body.append(audioHost);

    r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === "audio") audioHost?.append(track.attach());
      refresh();
    })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        for (const el of track.detach()) el.remove();
        refresh();
      })
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, refresh)
      .on(RoomEvent.TrackMuted, (pub: { source?: string }, who: { isLocal?: boolean }) => {
        // A camera that stops on its own (unplugged, taken by another app) says so.
        if (who?.isLocal && pub?.source === "camera" && cameraWanted) {
          cameraWanted = false;
          set({
            error: "Your camera stopped. Check it isn't in use by another app, then try again.",
          });
        }
        refresh();
      })
      // LiveKit reports some device failures here instead of throwing (no camera, one that's busy).
      .on(RoomEvent.MediaDevicesError, (err: Error) => {
        set({ error: deviceError(err, asking) });
        refresh();
      })
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
        if (pub.source === "screen_share") set({ screenOn: false });
        refresh();
      })
      .on(RoomEvent.Disconnected, () => {
        if (room === r) {
          room = null;
          realtime.voiceState(null);
          set({ ...idle });
        }
      });

    await r.connect(pass.url, pass.token);
    set({ status: "connected", canSpeak: pass.canSpeak, canVideo: pass.canVideo });
    realtime.voiceState(opts.channelId);
    refresh();
    if (pass.canSpeak) {
      try {
        await r.localParticipant.setMicrophoneEnabled(true);
      } catch (err) {
        set({ error: deviceError(err, "microphone") });
      }
    }
    refresh();
  } catch (err) {
    room?.disconnect();
    room = null;
    set({
      status: "error",
      error:
        err instanceof ApiError
          ? err.message
          : "Couldn't connect to voice. Check your connection and try again.",
    });
  }
}

export async function leaveVoice() {
  const r = room;
  room = null;
  if (r) {
    await r.disconnect();
    realtime.voiceState(null);
  }
  for (const el of [...(audioHost?.children ?? [])]) el.remove();
  set({ ...idle });
}

export async function toggleMic() {
  if (!room) return;
  asking = "microphone";
  try {
    await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
    set({ error: "" });
  } catch (err) {
    set({ error: deviceError(err, "microphone") });
  }
  refresh();
}

export async function toggleCamera() {
  if (!room) return;
  const want = !room.localParticipant.isCameraEnabled;
  asking = "camera";
  try {
    // A camera that never answers (missing, or held by another app) mustn't leave the button
    // hanging: give it a few seconds.
    const timedOut = await Promise.race([
      room.localParticipant.setCameraEnabled(want).then(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 8000)),
    ]);
    cameraWanted = want && !timedOut;
    if (timedOut && want) {
      void room.localParticipant.setCameraEnabled(false).catch(() => {});
      throw await cameraMissing();
    }
    // LiveKit sometimes gives up quietly (no camera, or it's busy in another app): say so.
    if (want && !room.localParticipant.isCameraEnabled) {
      throw await cameraMissing();
    }
    set({ error: "" });
  } catch (err) {
    set({ error: deviceError(err, "camera") });
  }
  refresh();
}

/** Why a camera that was asked for didn't start: none at all, or one that's busy. */
async function cameraMissing(): Promise<Error> {
  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  const err = new Error("camera didn't start");
  err.name = devices.some((d) => d.kind === "videoinput") ? "NotReadableError" : "NotFoundError";
  return err;
}

export async function toggleScreen() {
  if (!room) return;
  asking = "screen share";
  try {
    await room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled, {
      audio: true,
    });
    set({ error: "" });
  } catch (err) {
    // Cancelling the browser's picker isn't an error worth showing.
    if (!(err instanceof Error && err.name === "NotAllowedError")) {
      set({ error: deviceError(err, "screen share") });
    }
  }
  refresh();
}

/** Show someone's camera or screen in a <video> element (or stop showing it). */
export function attachVideo(
  identity: string,
  source: "camera" | "screen_share",
  el: HTMLVideoElement,
) {
  if (!room) return () => {};
  const p =
    room.localParticipant.identity === identity
      ? room.localParticipant
      : room.remoteParticipants.get(identity);
  const pub = p?.getTrackPublication(source as never);
  const track = pub?.track;
  if (!track) return () => {};
  track.attach(el);
  return () => {
    track.detach(el);
  };
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useVoice<T>(select: (s: VoiceSnapshot) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(snap),
    () => select(idle),
  );
}
