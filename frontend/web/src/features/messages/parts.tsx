"use client";

import type { Conversation, PresenceStatus } from "@realm/contracts";
import { Avatar } from "@/features/spaces/person";
import { cx } from "@/lib/cx";

/** A conversation's picture: the person (with their presence), or two of the group, overlapped. */
export function ConversationAvatar({
  conversation: c,
  presence,
  size = 52,
  ring = "var(--r-surface)",
}: {
  conversation: Pick<Conversation, "type" | "recipients">;
  presence?: Record<string, PresenceStatus>;
  size?: number;
  /** The colour behind it, so overlaps and dots read as cut out. */
  ring?: string;
}) {
  const [a, b] = c.recipients;
  if (c.type === "dm" || !b) {
    return a ? (
      <Avatar user={a} size={size} presence={presence?.[a.id]} ring={ring} />
    ) : (
      <span className="shrink-0 rounded-full bg-fg/10" style={{ width: size, height: size }} />
    );
  }
  const small = Math.round(size * 0.7);
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span className="absolute top-0 left-0">
        <Avatar user={a as NonNullable<typeof a>} size={small} />
      </span>
      <span
        className="absolute right-0 bottom-0 rounded-full"
        style={{ boxShadow: `0 0 0 2.5px ${ring}` }}
      >
        <Avatar user={b} size={small} />
      </span>
    </span>
  );
}

const timeOnly = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

/** "9:05 PM" today, "Yesterday", "Mon" this week, then "12 Sep". */
export function shortWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return timeOnly.format(d);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return weekday.format(d);
  return dayMonth.format(d);
}

/** One line about the newest message, for the inbox. */
export function previewLine(c: Conversation, meId: string | undefined): string {
  const m = c.lastMessage;
  if (!m) return c.type === "dm" ? "Say hi" : "New group";
  if (m.type.startsWith("system_")) {
    return m.type === "system_pin"
      ? "Pinned a message"
      : m.type === "system_channel_rename"
        ? "Renamed the group"
        : m.type === "system_recipient_add"
          ? "Added someone"
          : "Someone left";
  }
  const what = m.content
    ? m.content
    : m.place
      ? "Shared a place"
      : m.attachmentKind === "image"
        ? m.attachments > 1
          ? `${m.attachments} photos`
          : "Photo"
        : m.attachmentKind === "video"
          ? "Video"
          : m.attachmentKind === "audio"
            ? "Voice message"
            : "File";
  if (m.authorId === meId) return `You: ${what}`;
  if (c.type === "group_dm") {
    const who = c.recipients.find((r) => r.id === m.authorId)?.displayName.split(/\s+/)[0];
    return who ? `${who}: ${what}` : what;
  }
  return what;
}

/** The plain "not end-to-end encrypted yet" chip, never a lock and never a warning colour. */
export function NotE2eeChip({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-7 shrink-0 items-center rounded-full bg-base/60 px-3 text-[0.8rem] font-bold whitespace-nowrap text-fg-soft shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)] hover:text-fg",
        className,
      )}
    >
      Not end-to-end encrypted yet
    </button>
  );
}
