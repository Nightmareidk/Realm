"use client";

import { Microphone, MicrophoneSlash, PhoneDisconnect, SpeakerHigh } from "@phosphor-icons/react";
import Link from "next/link";
import { cx } from "@/lib/cx";
import { leaveVoice, toggleMic, useVoice } from "./voice";

/**
 * While you're in a call: a slim bar that stays with you around Realm, to mute, leave, or go
 * back to the room.
 */
export function VoiceDock({ className }: { className?: string }) {
  const status = useVoice((v) => v.status);
  const roomName = useVoice((v) => v.roomName);
  const slug = useVoice((v) => v.spaceSlug);
  const micOn = useVoice((v) => v.micOn);
  const canSpeak = useVoice((v) => v.canSpeak);
  const count = useVoice((v) => v.participants.length);
  if (status !== "connected" && status !== "connecting") return null;
  return (
    <section
      aria-label="Your call"
      className={cx(
        "flex items-center gap-2 rounded-card bg-surface-raised py-1.5 pr-1.5 pl-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]",
        className,
      )}
    >
      <SpeakerHigh aria-hidden="true" size={18} className="shrink-0 text-presence" />
      <Link
        href={`/spaces/${slug}/${roomName}`}
        className="min-w-0 flex-1 truncate text-[0.92rem] font-bold text-fg hover:underline"
      >
        {status === "connecting" ? "Connecting…" : `#${roomName}`}
        {status === "connected" && (
          <span className="font-normal text-fg-soft">
            {" "}
            · {count === 1 ? "just you" : `${count} in`}
          </span>
        )}
      </Link>
      {canSpeak && status === "connected" && (
        <button
          type="button"
          aria-pressed={!micOn}
          onClick={() => void toggleMic()}
          className="inline-flex size-11 items-center justify-center rounded-full text-fg-soft hover:bg-fg/10 hover:text-fg sm:size-9"
        >
          {micOn ? (
            <Microphone aria-hidden="true" size={18} />
          ) : (
            <MicrophoneSlash aria-hidden="true" size={18} className="text-danger" />
          )}
          <span className="sr-only">Mute</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => void leaveVoice()}
        className="inline-flex size-11 items-center justify-center rounded-full text-danger hover:bg-danger-line/15 sm:size-9"
      >
        <PhoneDisconnect aria-hidden="true" size={18} />
        <span className="sr-only">Leave the call</span>
      </button>
    </section>
  );
}
