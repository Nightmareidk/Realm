"use client";

import { ClockCounterClockwise, MagnifyingGlass } from "@phosphor-icons/react";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { EMOJI_GROUPS, recentEmoji, rememberEmoji } from "./emoji";

const COLUMNS = 8;

/**
 * Pick an emoji: search by word, browse by group, recent ones first. The grid is one tab stop;
 * arrow keys move through it, Enter picks.
 */
export function EmojiPicker({
  onPick,
  label = "Pick an emoji",
}: {
  onPick: (emoji: string) => void;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("recent");
  const [focus, setFocus] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const grid = useRef<HTMLFieldSetElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const r = recentEmoji();
    setRecent(r);
    if (r.length === 0) setGroup("smileys");
    search.current?.focus();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return EMOJI_GROUPS.flatMap((g) => g.items)
        .filter(([, words]) => words.includes(q))
        .map(([e, words]) => ({ emoji: e, name: words }));
    }
    if (group === "recent") return recent.map((e) => ({ emoji: e, name: e }));
    const g = EMOJI_GROUPS.find((x) => x.id === group) ?? EMOJI_GROUPS[0];
    return (g?.items ?? []).map(([e, words]) => ({ emoji: e, name: words }));
  }, [query, group, recent]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new list starts at its first emoji.
  useEffect(() => setFocus(0), [query, group]);

  const pick = (emoji: string) => {
    rememberEmoji(emoji);
    onPick(emoji);
  };

  const onKey = (e: KeyboardEvent<HTMLFieldSetElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
    };
    const step = moves[e.key];
    if (step === undefined && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? shown.length - 1
          : Math.max(0, Math.min(shown.length - 1, focus + (step ?? 0)));
    setFocus(next);
    grid.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };

  const tabs = [
    ...(recent.length ? [{ id: "recent", label: "Recent", icon: "" }] : []),
    ...EMOJI_GROUPS.map((g) => ({ id: g.id, label: g.label, icon: g.items[0]?.[0] ?? "" })),
  ];

  return (
    <div className="w-[19.5rem]">
      <div className="relative">
        <MagnifyingGlass
          aria-hidden="true"
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-soft"
        />
        <label htmlFor={`${id}-q`} className="sr-only">
          Search emoji
        </label>
        <input
          id={`${id}-q`}
          ref={search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              grid.current?.querySelector<HTMLButtonElement>("button")?.focus();
            }
            if (e.key === "Enter" && shown[0]) {
              e.preventDefault();
              pick(shown[0].emoji);
            }
          }}
          placeholder="Search emoji"
          autoComplete="off"
          className="h-10 w-full rounded-full bg-fg/[0.06] pr-3 pl-9 text-[0.95rem] text-fg outline-none placeholder:text-fg-muted focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
        />
      </div>
      {!query && (
        <div role="tablist" aria-label="Emoji groups" className="mt-2 flex gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={group === t.id}
              title={t.label}
              onClick={() => setGroup(t.id)}
              className={cx(
                "grid size-8 place-items-center rounded-[0.6rem] text-[1.05rem] transition-colors duration-150",
                group === t.id ? "bg-fg/10" : "opacity-60 hover:bg-fg/6 hover:opacity-100",
              )}
            >
              {t.id === "recent" ? (
                <ClockCounterClockwise aria-hidden="true" size={17} />
              ) : (
                <span aria-hidden="true">{t.icon}</span>
              )}
              <span className="sr-only">{t.label}</span>
            </button>
          ))}
        </div>
      )}
      <fieldset
        ref={grid}
        aria-label={query ? `Emoji matching ${query}` : label}
        onKeyDown={onKey}
        className="mt-2 grid max-h-[13.5rem] min-w-0 grid-cols-8 gap-0.5 overflow-y-auto border-0 p-0 pr-0.5"
      >
        {shown.length === 0 ? (
          <p className="col-span-8 py-6 text-center text-[0.9rem] text-fg-soft">
            {query ? "No emoji match that." : "Nothing here yet."}
          </p>
        ) : (
          shown.map((e, i) => (
            <button
              key={e.emoji}
              type="button"
              tabIndex={i === focus ? 0 : -1}
              onFocus={() => setFocus(i)}
              onClick={() => pick(e.emoji)}
              title={e.name}
              className="grid aspect-square place-items-center rounded-[0.6rem] text-[1.45rem] leading-none transition-transform duration-100 ease-out hover:bg-fg/8 motion-safe:hover:scale-110 focus-visible:bg-fg/8"
            >
              <span aria-hidden="true">{e.emoji}</span>
              <span className="sr-only">{e.name.split(" ")[0]}</span>
            </button>
          ))
        )}
      </fieldset>
    </div>
  );
}
