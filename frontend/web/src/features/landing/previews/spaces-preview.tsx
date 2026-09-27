import {
  Article,
  Hash,
  PaperPlaneTilt,
  Plus,
  Smiley,
  SpeakerHigh,
  UserPlus,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/avatar";
import { cx } from "@/lib/cx";
import { chat, people, space } from "../demo";
import { PreviewFrame } from "./preview-frame";
import styles from "./spaces-preview.module.css";

const roomIcon = { text: Hash, board: Article, voice: SpeakerHigh } as const;

/** The Space's identity: a cover band, its badge, and who's around. */
function SpaceHeader({ compact }: { compact: boolean }) {
  const online = space.here.length;
  return (
    <header className="relative shrink-0 px-4 pt-3 pb-2.5">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-0 opacity-90"
        style={{
          background:
            "radial-gradient(60% 140% at 0% 0%, color-mix(in oklch, var(--r-spaces-solid) 30%, transparent), transparent 70%), radial-gradient(40% 120% at 100% 0%, color-mix(in oklch, var(--r-profiles-solid) 18%, transparent), transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-ground"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, color-mix(in oklch, var(--r-spaces-solid) 50%, white), var(--r-spaces-solid) 55%, color-mix(in oklch, var(--r-spaces-solid) 50%, black))",
          }}
        >
          LN
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{space.name}</p>
          <p className="flex items-center gap-1.5 text-[0.7rem] text-ink-soft">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="tabular">{online} here now</span>
            <span className="text-ink-muted">·</span>
            <span className="tabular text-ink-muted">{space.members} members</span>
          </p>
        </div>
        {!compact && (
          <div className="ml-auto flex items-center gap-2.5 @max-[34rem]:hidden">
            <span className="flex -space-x-2">
              {space.here.map((h) => (
                <Avatar
                  key={h.who.handle}
                  name={h.who.name}
                  ink={h.who.ink}
                  size="xs"
                  className="rounded-full ring-2 ring-panel"
                />
              ))}
            </span>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-rule-strong px-2.5 text-xs text-ink">
              <UserPlus size={13} />
              Invite
            </span>
          </div>
        )}
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
            {r.kind === "voice" && <span className="text-[0.62rem] text-ink-muted">soon</span>}
          </span>
        );
      })}
    </nav>
  );
}

/** Bubble chat: friends on the left, you on the right. */
function Conversation({ compact }: { compact: boolean }) {
  const rows = compact ? chat.slice(2) : chat;
  return (
    <ol className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden px-4 pt-3">
      {rows.map((m) => {
        const mine = "mine" in m && m.mine;
        const reaction = "reactions" in m ? m.reactions?.[0] : undefined;
        return (
          <li
            key={m.time + m.who.handle}
            className={cx("flex items-end gap-2", mine && "flex-row-reverse")}
          >
            {!mine && <Avatar name={m.who.name} ink={m.who.ink} size="xs" />}
            <div
              className={cx(
                "flex min-w-0 max-w-[78%] flex-col",
                mine ? "items-end" : "items-start",
              )}
            >
              {!mine && (
                <p className="mb-0.5 px-1 text-[0.68rem] text-ink-muted">
                  <span className="font-semibold text-ink-soft">{m.who.name.split(" ")[0]}</span>
                  <span className="tabular ml-1.5">{m.time}</span>
                </p>
              )}
              <p
                className={cx(
                  "rounded-2xl px-3 py-1.5 text-sm leading-snug",
                  mine
                    ? "rounded-br-md bg-spaces-solid text-ground"
                    : "rounded-bl-md bg-panel-raised text-ink",
                )}
              >
                {m.text}
              </p>
              {reaction && (
                <span className="-mt-1 ml-2 inline-flex items-center gap-1 rounded-full border border-rule bg-panel px-1.5 py-px text-[0.68rem] text-ink-soft">
                  <span aria-hidden="true">{reaction.emoji}</span>
                  <span className="tabular">{reaction.count}</span>
                </span>
              )}
            </div>
          </li>
        );
      })}
      <li className="flex items-end gap-2">
        <Avatar name={people.priya.name} ink={people.priya.ink} size="xs" />
        <span className="flex h-7 items-center gap-1 rounded-2xl rounded-bl-md bg-panel-raised px-3">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className="sr-only">{people.priya.name.split(" ")[0]} is typing</span>
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
        <Smiley size={17} />
        <span className="flex size-8 items-center justify-center rounded-full bg-overprint-fill text-on-overprint">
          <PaperPlaneTilt size={15} weight="fill" />
        </span>
      </div>
    </div>
  );
}

/** Who's here and what they're doing: presence as activity, not a member list. */
function HereNow() {
  return (
    <aside className="flex w-52 shrink-0 flex-col gap-3 border-l border-rule p-3.5 @max-[40rem]:hidden">
      <p className="text-xs font-semibold text-ink">Here now</p>
      <ul className="flex flex-col gap-2.5">
        {space.here.map((h) => (
          <li key={h.who.handle} className="flex items-center gap-2.5">
            <Avatar name={h.who.name} ink={h.who.ink} size="sm" online />
            <span className="min-w-0">
              <span className="block truncate text-[0.8rem] font-semibold text-ink">
                {h.who.name.split(" ")[0]}
              </span>
              <span className="block truncate text-[0.7rem] text-ink-muted">{h.doing}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto rounded-lg border border-dashed border-rule-strong p-2.5">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink-soft">
          <SpeakerHigh size={13} /> Squad room
        </p>
        <p className="mt-0.5 text-[0.68rem] text-ink-muted">Voice rooms are coming soon</p>
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
        <Conversation compact={compact} />
        <Composer />
      </div>
      {!compact && <HereNow />}
    </div>
  );
}

export function SpacesPreview({ variant = "full" }: { variant?: "full" | "compact" }) {
  const compact = variant === "compact";
  return (
    <PreviewFrame label="A Space with rooms, bubble chat, and who's here now" caption={!compact}>
      <SpacesApp compact={compact} className={compact ? "h-[18rem]" : "h-[27rem]"} />
    </PreviewFrame>
  );
}
