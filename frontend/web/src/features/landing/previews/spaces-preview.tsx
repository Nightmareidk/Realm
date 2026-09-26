import { Article, Hash, Plus, Smiley, SpeakerHigh } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/avatar";
import { cx } from "@/lib/cx";
import { chat, people, space } from "../demo";
import { PreviewFrame } from "./preview-frame";

const channelIcon = { text: Hash, board: Article, voice: SpeakerHigh } as const;

const SPACE_TILES = [
  { initials: "LN", cls: "bg-spaces-fill text-spaces-text", active: true },
  { initials: "SR", cls: "bg-feed-fill text-feed-text", active: false },
  { initials: "CO", cls: "bg-profiles-fill text-profiles-text", active: false },
  { initials: "IN", cls: "bg-boards-fill text-boards-text", active: false },
];

function SpaceRail() {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-rule py-3 @max-[36rem]:hidden">
      {SPACE_TILES.map((t) => (
        <span
          key={t.initials}
          className={cx(
            "stretch-semi-expanded flex size-9 items-center justify-center rounded-lg text-[0.7rem] font-bold",
            t.cls,
            t.active && "ring-2 ring-ink ring-offset-2 ring-offset-panel",
          )}
        >
          {t.initials}
        </span>
      ))}
      <span className="flex size-9 items-center justify-center rounded-lg border border-dashed border-rule-strong text-ink-muted">
        <Plus size={14} />
      </span>
    </div>
  );
}

function ChannelList({ compact }: { compact: boolean }) {
  return (
    <nav
      className={cx(
        "flex shrink-0 flex-col gap-4 border-r border-rule bg-ground/40 p-3 @max-[28rem]:hidden",
        compact ? "w-40" : "w-48",
      )}
    >
      <p className="stretch-semi-expanded truncate px-1 text-sm font-bold text-ink">{space.name}</p>
      {space.categories.map((cat) => (
        <div key={cat.name} className="flex flex-col gap-0.5">
          <p className="stretch-condensed px-1 pb-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {cat.name}
          </p>
          {cat.channels.map((ch) => {
            const Icon = channelIcon[ch.kind];
            return (
              <span
                key={ch.name}
                className={cx(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  ch.active
                    ? "bg-panel-raised text-ink"
                    : ch.unread
                      ? "text-ink"
                      : "text-ink-muted",
                )}
              >
                <Icon
                  size={15}
                  weight={ch.active ? "bold" : "regular"}
                  className="shrink-0 opacity-80"
                />
                <span className="truncate">{ch.name}</span>
                {ch.kind === "voice" && (
                  <span className="ml-auto text-[0.65rem] text-ink-muted">soon</span>
                )}
                {ch.unread && ch.kind !== "voice" && (
                  <span className="ml-auto size-1.5 shrink-0 rounded-full bg-ink">
                    <span className="sr-only">unread</span>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Messages({ compact }: { compact: boolean }) {
  const rows = compact ? chat.slice(1) : chat;
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-rule px-4">
        <Hash size={16} weight="bold" className="text-ink-muted" />
        <span className="text-sm font-semibold text-ink">general</span>
        {!compact && (
          <span className="truncate text-xs text-ink-muted @max-[40rem]:hidden">
            ranked nights, patch talk, general chaos
          </span>
        )}
      </header>
      <ol className="flex flex-1 flex-col justify-end gap-3.5 px-4 py-3">
        {rows.map((m) => (
          <li key={m.time + m.who.handle} className="flex gap-3">
            <Avatar name={m.who.name} ink={m.who.ink} size="sm" />
            <div className="min-w-0">
              <p className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-ink">{m.who.name.split(" ")[0]}</span>
                <span className="tabular text-[0.7rem] text-ink-muted">{m.time}</span>
              </p>
              <p className="text-sm leading-snug text-ink-soft">{m.text}</p>
              {"reactions" in m && m.reactions && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-rule px-1.5 py-0.5 text-xs text-ink-soft">
                  <span aria-hidden="true">{m.reactions[0]?.emoji}</span>
                  <span className="tabular">{m.reactions[0]?.count}</span>
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="px-4 pb-3">
        <p className="mb-1.5 h-4 text-[0.7rem] text-ink-muted">
          <span className="font-semibold text-ink-soft">{people.priya.name.split(" ")[0]}</span> is
          typing
        </p>
        <div className="flex h-10 items-center gap-2 rounded-md border border-rule bg-ground/50 px-3 text-sm text-ink-muted">
          <Plus size={16} />
          <span className="flex-1 truncate">Message #general</span>
          <Smiley size={16} />
        </div>
      </div>
    </div>
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
    <div className={cx("@container flex bg-panel", className)}>
      {!compact && <SpaceRail />}
      <ChannelList compact={compact} />
      <Messages compact={compact} />
    </div>
  );
}

export function SpacesPreview({ variant = "full" }: { variant?: "full" | "compact" }) {
  const compact = variant === "compact";
  return (
    <PreviewFrame label="A Space with text channels, a board, and a voice room" caption={!compact}>
      <SpacesApp compact={compact} className={compact ? "h-[17rem]" : "h-[26rem]"} />
    </PreviewFrame>
  );
}
