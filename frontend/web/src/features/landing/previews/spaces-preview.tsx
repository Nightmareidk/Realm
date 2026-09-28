import {
  ArrowBendUpLeft,
  Article,
  CalendarBlank,
  Gif,
  Hash,
  MagnifyingGlass,
  PaperPlaneTilt,
  Phone,
  Play,
  Plus,
  PushPin,
  Smiley,
  SpeakerHigh,
  UserPlus,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { Avatar } from "@/components/avatar";
import { cx } from "@/lib/cx";
import { type ChatMessage, chat, people, pinnedEvent, space, voiceRoom } from "../demo";
import { PreviewFrame } from "./preview-frame";
import styles from "./spaces-preview.module.css";

const roomIcon = { text: Hash, board: Article, voice: SpeakerHigh } as const;

/** The Space's identity: a cover band, its badge, who's around, and quick actions. */
function SpaceHeader({ compact }: { compact: boolean }) {
  const online = space.here.length;
  return (
    <header className="relative shrink-0 px-4 pt-3 pb-2.5">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 140% at 0% 0%, color-mix(in oklch, var(--r-spaces-solid) 30%, transparent), transparent 70%), radial-gradient(40% 120% at 100% 0%, color-mix(in oklch, var(--r-profiles-solid) 22%, transparent), transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[0.7rem] font-bold text-ground shadow-[0_6px_16px_-6px_var(--r-spaces-solid)]"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--r-spaces-solid) 60%, white), var(--r-spaces-solid) 50%, var(--r-profiles-solid))",
          }}
        >
          LN
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{space.name}</p>
          <p className="flex items-center gap-1.5 text-[0.7rem] text-ink-soft">
            <span className={cx(styles.live, "size-1.5 rounded-full bg-success")} />
            <span className="tabular">{online} here now</span>
            <span className="text-ink-muted">·</span>
            <span className="tabular text-ink-muted">{space.members} members</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {!compact && (
            <span className="flex -space-x-2 pr-1 @max-[36rem]:hidden">
              {space.here.map((h) => (
                <Avatar
                  key={h.who.handle}
                  name={h.who.name}
                  ink={h.who.ink}
                  src={h.who.avatar}
                  size="xs"
                  className="rounded-full ring-2 ring-panel"
                />
              ))}
            </span>
          )}
          <span className="flex size-7 items-center justify-center rounded-full border border-rule text-ink-soft @max-[30rem]:hidden">
            <MagnifyingGlass size={13} />
          </span>
          <span className="flex size-7 items-center justify-center rounded-full border border-rule text-ink-soft">
            <Phone size={13} />
          </span>
          {!compact && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink px-2.5 text-xs font-semibold text-ground @max-[34rem]:hidden">
              <UserPlus size={13} weight="bold" />
              Invite
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

/** Rooms as tabs along the top: the Space is one place, and rooms are views of it. */
function RoomTabs({ compact }: { compact: boolean }) {
  const rooms = compact ? space.rooms.slice(0, 4) : space.rooms;
  return (
    <nav className="flex shrink-0 gap-1.5 overflow-hidden border-b border-rule px-4 pb-2.5 [mask-image:linear-gradient(to_right,#000_88%,transparent)]">
      {rooms.map((r) => {
        const Icon = roomIcon[r.kind];
        return (
          <span
            key={r.name}
            className={cx(
              "flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs",
              r.active
                ? "border-spaces-line bg-spaces-fill font-semibold text-spaces-text"
                : "border-rule text-ink-soft",
            )}
          >
            <Icon size={13} weight={r.active ? "bold" : "regular"} className="shrink-0" />
            {r.name}
            {r.unread > 0 && (
              <span className="tabular flex h-4 min-w-4 items-center justify-center rounded-full bg-overprint-fill px-1 text-[0.6rem] font-bold text-on-overprint">
                {r.unread}
                <span className="sr-only"> unread</span>
              </span>
            )}
            {r.kind === "voice" && (
              <span className={cx(styles.live, "size-1.5 rounded-full bg-success")} />
            )}
          </span>
        );
      })}
    </nav>
  );
}

/** A pinned event with RSVPs: how a group actually plans the night. */
function PinnedEvent() {
  return (
    <div className="mx-4 mt-3 flex shrink-0 items-center gap-3 rounded-2xl border border-rule bg-panel-raised/70 p-2.5 pr-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-overprint-fill text-on-overprint">
        <CalendarBlank size={16} weight="bold" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink">
          <PushPin size={11} weight="fill" className="text-ink-muted" />
          {pinnedEvent.title}
        </p>
        <p className="text-[0.7rem] text-ink-muted">{pinnedEvent.when}</p>
      </div>
      <span className="ml-auto flex -space-x-1.5 @max-[30rem]:hidden">
        {pinnedEvent.going.map((p) => (
          <Avatar
            key={p.handle}
            name={p.name}
            ink={p.ink}
            src={p.avatar}
            size="xs"
            className="rounded-full ring-2 ring-panel-raised"
          />
        ))}
      </span>
      <span className="tabular text-[0.7rem] text-ink-soft @max-[30rem]:ml-auto">
        {pinnedEvent.count} going
      </span>
      <span className="rounded-full bg-ink px-2.5 py-1 text-[0.7rem] font-semibold text-ground">
        Join
      </span>
    </div>
  );
}

const WAVE = [4, 9, 14, 8, 16, 11, 6, 13, 18, 10, 7, 12, 15, 9, 5, 11, 14, 7, 10, 6];

function VoiceNote({ duration }: { duration: string }) {
  return (
    <span className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-panel-raised px-2 py-1.5">
      <span className="flex size-7 items-center justify-center rounded-full bg-ink text-ground">
        <Play size={12} weight="fill" />
      </span>
      <span className="flex h-5 items-center gap-[2px]" aria-hidden="true">
        {WAVE.map((h, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative waveform.
            key={i}
            className={cx("w-[3px] rounded-full", i < 7 ? "bg-spaces-solid" : "bg-rule-strong")}
            style={{ height: h }}
          />
        ))}
      </span>
      <span className="tabular pr-1 text-[0.68rem] text-ink-muted">{duration}</span>
    </span>
  );
}

function ClipAttachment({ clip }: { clip: NonNullable<ChatMessage["clip"]> }) {
  return (
    <span className="relative mt-1.5 block aspect-video w-52 max-w-full overflow-hidden rounded-2xl bg-land">
      <Image src={clip.image} alt="" fill sizes="240px" className="object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-[oklch(0.12_0.04_280/0.85)] via-transparent to-transparent" />
      <span className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.99_0.005_285/0.9)] text-[oklch(0.2_0.04_280)] shadow-lg">
        <Play size={16} weight="fill" />
      </span>
      <span className="absolute inset-x-2.5 bottom-2 flex items-end justify-between gap-2 text-[oklch(0.98_0.01_285)]">
        <span className="truncate text-[0.72rem] font-semibold">{clip.title}</span>
        <span className="tabular shrink-0 rounded-full bg-[oklch(0.12_0.04_280/0.6)] px-1.5 text-[0.65rem]">
          {clip.duration}
        </span>
      </span>
    </span>
  );
}

function Message({ m }: { m: ChatMessage }) {
  const mine = Boolean(m.mine);
  return (
    <li className={cx("flex items-end gap-2", mine && "flex-row-reverse")}>
      {!mine && <Avatar name={m.who.name} ink={m.who.ink} src={m.who.avatar} size="sm" />}
      <div className={cx("flex min-w-0 max-w-[80%] flex-col", mine ? "items-end" : "items-start")}>
        {!mine && (
          <p className="mb-0.5 flex items-center gap-1.5 px-1 text-[0.68rem] text-ink-muted">
            <span className="font-semibold text-ink-soft">{m.who.name.split(" ")[0]}</span>
            {m.role && (
              <span className="rounded-full bg-spaces-fill px-1.5 text-[0.6rem] font-semibold text-spaces-text">
                {m.role}
              </span>
            )}
            <span className="tabular">{m.time}</span>
          </p>
        )}
        {m.replyTo && (
          <span className="mb-1 flex max-w-full items-center gap-1.5 truncate rounded-full bg-panel-raised/70 py-1 pr-3 pl-2 text-[0.68rem] text-ink-muted">
            <ArrowBendUpLeft size={12} weight="bold" className="shrink-0 text-spaces-text" />
            <span className="font-semibold text-ink-soft">{m.replyTo.name}</span>
            <span className="truncate">{m.replyTo.text}</span>
          </span>
        )}
        {m.voice && <VoiceNote duration={m.voice.duration} />}
        {m.text && (
          <p
            className={cx(
              "rounded-2xl px-3 py-1.5 text-sm leading-snug",
              mine
                ? "rounded-br-md bg-spaces-solid text-ground shadow-[0_8px_20px_-12px_var(--r-spaces-solid)]"
                : "rounded-bl-md bg-panel-raised text-ink",
            )}
          >
            {m.text}
          </p>
        )}
        {m.clip && <ClipAttachment clip={m.clip} />}
        {m.reactions && (
          <span className="-mt-1 ml-2 flex gap-1">
            {m.reactions.map((r) => (
              <span
                key={r.emoji}
                className={cx(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[0.68rem]",
                  r.mine
                    ? "border-spaces-line bg-spaces-fill text-spaces-text"
                    : "border-rule bg-panel text-ink-soft",
                )}
              >
                <span aria-hidden="true">{r.emoji}</span>
                <span className="tabular">{r.count}</span>
              </span>
            ))}
          </span>
        )}
        {m.seenBy && (
          <span className="mt-1 flex items-center gap-1 text-[0.62rem] text-ink-muted">
            Seen by
            <span className="flex -space-x-1">
              {m.seenBy.map((p) => (
                <Avatar
                  key={p.handle}
                  name={p.name}
                  ink={p.ink}
                  src={p.avatar}
                  size="xs"
                  className="scale-75 rounded-full ring-2 ring-panel"
                />
              ))}
            </span>
          </span>
        )}
      </div>
    </li>
  );
}

/** Bubble chat: friends on the left, you on the right, with the things groups actually send. */
function Conversation({ compact }: { compact: boolean }) {
  const rows = compact ? chat.slice(-2) : chat;
  const typing = people.saoirse;
  return (
    <ol className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden px-4 pt-3 [mask-image:linear-gradient(to_bottom,transparent,#000_2.5rem)]">
      {rows.map((m) => (
        <Message key={m.time + m.who.handle} m={m} />
      ))}
      <li className="flex items-end gap-2">
        <Avatar name={typing.name} ink={typing.ink} src={typing.avatar} size="sm" />
        <span className="flex h-7 items-center gap-1 rounded-2xl rounded-bl-md bg-panel-raised px-3">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className="sr-only">{typing.name.split(" ")[0]} is typing</span>
        </span>
      </li>
    </ol>
  );
}

function Composer() {
  return (
    <div className="shrink-0 p-3">
      <div className="flex h-10 items-center gap-2 rounded-full border border-rule-strong bg-ground/60 pr-1 pl-1.5 text-sm text-ink-muted">
        <span className="flex size-7 items-center justify-center rounded-full bg-panel-raised text-ink-soft">
          <Plus size={14} />
        </span>
        <span className="flex-1 truncate">Say something in #general</span>
        <Gif size={18} className="@max-[26rem]:hidden" />
        <Smiley size={17} />
        <span className="flex size-8 items-center justify-center rounded-full bg-overprint-fill text-on-overprint">
          <PaperPlaneTilt size={15} weight="fill" />
        </span>
      </div>
    </div>
  );
}

/** Who's here and what they're doing, plus the live voice room. */
function HereNow() {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-3 border-l border-rule p-3.5 @max-[40rem]:hidden">
      <p className="text-xs font-semibold text-ink">Here now</p>
      <ul className="flex flex-col gap-2.5">
        {space.here.map((h) => (
          <li key={h.who.handle} className="flex items-center gap-2.5">
            <Avatar name={h.who.name} ink={h.who.ink} src={h.who.avatar} size="md" online />
            <span className="min-w-0">
              <span className="block truncate text-[0.8rem] font-semibold text-ink">
                {h.who.name.split(" ")[0]}
              </span>
              <span className="block truncate text-[0.7rem] text-ink-muted">{h.doing}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto rounded-2xl border border-rule bg-panel-raised/60 p-3">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink">
          <SpeakerHigh size={13} weight="fill" className="text-spaces-text" /> {voiceRoom.name}
          <span className={cx(styles.live, "ml-auto size-1.5 rounded-full bg-success")} />
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          {voiceRoom.people.map((v) => (
            <span
              key={v.who.handle}
              className={cx("rounded-full p-0.5", v.speaking && styles.speaking)}
            >
              <Avatar name={v.who.name} ink={v.who.ink} src={v.who.avatar} size="sm" />
            </span>
          ))}
        </div>
        <p className="mt-2 text-[0.65rem] text-ink-muted">Voice rooms are coming soon</p>
      </div>
    </aside>
  );
}

/** The Spaces UI itself (no frame), reused by the hero window and the section preview. */
export function SpacesApp({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("@container isolate flex bg-panel", className)}>
      <div className="flex min-w-0 flex-1 flex-col">
        <SpaceHeader compact={compact} />
        <RoomTabs compact={compact} />
        {!compact && <PinnedEvent />}
        <Conversation compact={compact} />
        <Composer />
      </div>
      {!compact && <HereNow />}
    </div>
  );
}

export function SpacesPreview({
  variant = "full",
  appClassName,
}: {
  variant?: "full" | "compact";
  /** The app's height (the conversation fills whatever it's given). */
  appClassName?: string;
}) {
  const compact = variant === "compact";
  return (
    <PreviewFrame
      label="A Space with rooms, a pinned event, bubble chat with clips and voice notes, and who's here now"
      caption={!compact}
    >
      <SpacesApp
        compact={compact}
        className={appClassName ?? (compact ? "h-[18rem]" : "h-[38rem]")}
      />
    </PreviewFrame>
  );
}
