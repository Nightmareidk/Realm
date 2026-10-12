"use client";

import {
  Microphone,
  MicrophoneSlash,
  Monitor,
  PhoneDisconnect,
  SpeakerHigh,
  VideoCamera,
  VideoCameraSlash,
} from "@phosphor-icons/react";
import type { Channel, SpaceDetail } from "@realm/contracts";
import { useEffect, useRef } from "react";
import { pill } from "@/components/pill";
import { useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { cx } from "@/lib/cx";
import {
  attachVideo,
  joinVoice,
  leaveVoice,
  toggleCamera,
  toggleMic,
  toggleScreen,
  useVoice,
  type VoiceParticipant,
} from "./voice";

/**
 * A voice room: who's in it, and once you join, everyone as a tile (camera or screen when
 * they share one, otherwise their picture with a ring that lights while they talk). Calls go
 * through LiveKit and aren't end-to-end encrypted.
 */
export function VoiceRoom({ space, room }: { space: SpaceDetail; room: Channel }) {
  const status = useVoice((v) => v.status);
  const inThis = useVoice((v) => v.channelId === room.id);
  const error = useVoice((v) => v.error);
  const participants = useVoice((v) => v.participants);
  const here = useRealm((s) => s.voice[room.id]);
  const members = useRealm((s) => s.members[space.id]);
  const connected = inThis && status === "connected";
  const available = useRealm((s) => s.capabilities?.voice);
  const people = (here ?? []).map(
    (id) => members?.find((m) => m.user.id === id)?.user ?? { id, displayName: "Someone" },
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        {connected ? (
          <ul
            aria-label={`In #${room.name}`}
            className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))]"
          >
            {participants.map((p) => (
              <Tile key={p.identity} p={p} space={space} />
            ))}
          </ul>
        ) : (
          <div className="max-w-[40rem] pt-2">
            <h2 className="flex items-center gap-2.5 font-display text-[1.7rem] leading-tight font-extrabold tracking-[-0.03em] text-fg">
              <SpeakerHigh aria-hidden="true" size={26} className="text-fg-soft" />
              {room.name}
            </h2>
            {available === false ? (
              <p className="mt-3 max-w-[52ch] text-fg-soft">
                Voice calls aren't set up on this Realm yet. Once they are, this is where your crew
                talks, turns on cameras and shares screens.
              </p>
            ) : (
              <p className="mt-3 max-w-[52ch] text-fg-soft">
                {people.length === 0
                  ? "A drop-in room: whoever's here can hear each other, turn on a camera or share a screen."
                  : `${people.length === 1 ? "1 person is" : `${people.length} people are`} in now.`}
              </p>
            )}
            {people.length > 0 && (
              <ul
                aria-label="In this room"
                className="mt-5 divide-y divide-line border-y border-line"
              >
                {people.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <Avatar user={u} size={32} presence="online" />
                    <span className="font-bold text-fg">{u.displayName}</span>
                  </li>
                ))}
              </ul>
            )}
            {available !== false && (
              <button
                type="button"
                aria-disabled={(inThis && status === "connecting") || undefined}
                onClick={() =>
                  void joinVoice({
                    channelId: room.id,
                    spaceSlug: space.slug,
                    roomName: room.name ?? "voice",
                  })
                }
                className={pill("action", "lg", "mt-7 px-9")}
              >
                {inThis && status === "connecting" ? "Connecting" : "Join voice"}
              </button>
            )}
            {available !== false && (
              <p className="mt-4 text-[0.92rem] text-fg-soft">
                Your microphone starts on; turn on your camera or share your screen once you're in.
                Calls aren't end-to-end encrypted.
              </p>
            )}
          </div>
        )}
        {inThis && error && (
          <p role="alert" className="mt-5 max-w-[40rem] text-danger">
            {error}
          </p>
        )}
      </div>
      {connected && <Controls />}
    </div>
  );
}

function Tile({ p, space }: { p: VoiceParticipant; space: SpaceDetail }) {
  const video = useRef<HTMLVideoElement>(null);
  const source = p.screenOn ? "screen_share" : p.camOn ? "camera" : null;
  const member = useRealm((s) => s.members[space.id]?.find((m) => m.user.id === p.identity));

  useEffect(() => {
    if (!source || !video.current) return;
    return attachVideo(p.identity, source, video.current);
  }, [p.identity, source]);

  return (
    <li
      className={cx(
        "relative grid aspect-video place-items-center overflow-hidden rounded-box bg-surface-sunken transition-shadow duration-150",
        p.speaking
          ? "shadow-[inset_0_0_0_3px_var(--r-text)]"
          : "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]",
      )}
    >
      {source ? (
        <video
          ref={video}
          autoPlay
          playsInline
          muted={p.isLocal}
          className={cx("size-full", source === "screen_share" ? "object-contain" : "object-cover")}
        />
      ) : (
        <Avatar user={member?.user ?? { id: p.identity, displayName: p.name }} size={72} />
      )}
      <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full bg-base/75 px-2.5 py-1 text-[0.86rem] font-bold text-fg">
        {!p.micOn && (
          <MicrophoneSlash aria-hidden="true" size={14} className="shrink-0 text-danger" />
        )}
        <span className="truncate">
          {p.name}
          {p.isLocal ? " (you)" : ""}
        </span>
        <span className="sr-only">
          {p.micOn ? (p.speaking ? ", talking" : "") : ", muted"}
          {p.screenOn ? ", sharing their screen" : p.camOn ? ", camera on" : ""}
        </span>
      </span>
    </li>
  );
}

function Controls() {
  const micOn = useVoice((v) => v.micOn);
  const camOn = useVoice((v) => v.camOn);
  const screenOn = useVoice((v) => v.screenOn);
  const canSpeak = useVoice((v) => v.canSpeak);
  const canVideo = useVoice((v) => v.canVideo);
  const round =
    "inline-flex size-12 items-center justify-center rounded-full transition-colors duration-150 ease-out";
  return (
    <div className="flex items-center justify-center gap-3 border-t border-line px-4 py-3">
      {canSpeak && (
        <button
          type="button"
          aria-pressed={!micOn}
          onClick={() => void toggleMic()}
          className={cx(
            round,
            micOn
              ? "bg-surface-raised text-fg hover:bg-fg/12"
              : "bg-surface-raised text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]",
          )}
        >
          {micOn ? (
            <Microphone aria-hidden="true" size={22} />
          ) : (
            <MicrophoneSlash aria-hidden="true" size={22} />
          )}
          <span className="sr-only">Mute</span>
        </button>
      )}
      {canVideo && (
        <>
          <button
            type="button"
            aria-pressed={camOn}
            onClick={() => void toggleCamera()}
            className={cx(
              round,
              camOn ? "bg-fg text-[var(--r-bg)]" : "bg-surface-raised text-fg hover:bg-fg/12",
            )}
          >
            {camOn ? (
              <VideoCamera aria-hidden="true" size={22} />
            ) : (
              <VideoCameraSlash aria-hidden="true" size={22} />
            )}
            <span className="sr-only">Camera</span>
          </button>
          <button
            type="button"
            aria-pressed={screenOn}
            onClick={() => void toggleScreen()}
            className={cx(
              round,
              "max-sm:hidden",
              screenOn ? "bg-fg text-[var(--r-bg)]" : "bg-surface-raised text-fg hover:bg-fg/12",
            )}
          >
            <Monitor aria-hidden="true" size={22} />
            <span className="sr-only">Share your screen</span>
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => void leaveVoice()}
        className={pill(
          "ghost",
          "lg",
          "text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]",
        )}
      >
        <PhoneDisconnect aria-hidden="true" size={20} />
        Leave
      </button>
    </div>
  );
}
