"use client";

import {
  ArrowRight,
  GearSix,
  Hash,
  type Icon,
  MagnifyingGlass,
  Plus,
  Question,
  SquaresFour,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { chatRooms, useRealm } from "@/features/realtime/store";
import { cx } from "@/lib/cx";
import { DESTINATIONS, SETTINGS } from "./nav";

type Item = {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: Icon;
  keywords?: string;
};

/** Other words people type for each settings page. */
const SETTING_WORDS: Record<string, string> = {
  Account: "password email username",
  Profile: "picture avatar photo name bio pronouns",
  "Privacy and safety": "block blocked mute report safety teen",
  Appearance: "theme colour color mint orchid aqua ember motion",
  Notifications: "push alerts notify",
  Devices: "sessions sign out security",
};

/** Everything Travel can always jump to. Your Spaces and rooms are added live; people come later. */
const ITEMS: Item[] = [
  ...DESTINATIONS.map((d) => ({
    id: d.href,
    label: d.label,
    hint: "Go to",
    href: d.href,
    icon: d.icon,
  })),
  ...SETTINGS.flatMap((g) =>
    g.items
      .filter((i) => !i.soon)
      .map((i) => ({
        id: i.href,
        label: i.label,
        hint: "Settings",
        href: i.href,
        icon: GearSix,
        keywords: SETTING_WORDS[i.label] ?? "",
      })),
  ),
  { id: "/help", label: "Help", hint: "Get help", href: "/help", icon: Question },
  {
    id: "new-space",
    label: "Start a Space",
    hint: "Create",
    href: "/spaces?new=1",
    icon: Plus,
    keywords: "new create space group crew",
  },
];

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Travel: jump anywhere with Ctrl K / ⌘K (also from inside text fields) or the field in the top
 * bar. A combobox in a dialog (ARIA APG): focus stays in the input, arrows move the highlighted
 * result, Enter goes there, Escape closes and returns focus to where it was.
 */
export function Travel({ variant = "field" }: { variant?: "field" | "icon" }) {
  /** One instance owns the shortcut (the field, always mounted); the phone icon only opens. */
  const listens = variant === "field";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [keys, setKeys] = useState("Ctrl K");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const listId = useId();

  useEffect(() => setKeys(isMac() ? "⌘K" : "Ctrl K"), []);

  const show = useCallback(() => {
    opener.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setIndex(0);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!listens) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listens, open, show, close]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // The highlighted result stays in view as the arrows move through a long list.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: "nearest" });
  }, [open, index, listId]);

  const spaces = useRealm((s) => s.spaces);
  const all = useMemo<Item[]>(
    () => [
      ...spaces.flatMap((sp) => [
        {
          id: `space-${sp.id}`,
          label: sp.name,
          hint: "Space",
          href: `/spaces/${sp.slug}`,
          icon: SquaresFour,
        },
        ...chatRooms(sp).map((r) => ({
          id: `room-${r.id}`,
          label: `#${r.name}`,
          hint: sp.name,
          href: `/spaces/${sp.slug}/${r.name}`,
          icon: Hash,
          keywords: "room",
        })),
      ]),
      ...ITEMS,
    ],
    [spaces],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((i) => `${i.label} ${i.hint} ${i.keywords ?? ""}`.toLowerCase().includes(q));
  }, [query, all]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      // The dialog has one control; Tab stays in it.
      e.preventDefault();
    }
  };

  return (
    <>
      {variant === "field" ? (
        <button
          type="button"
          onClick={show}
          className="flex h-10 w-full max-w-[22rem] min-w-0 items-center gap-2.5 whitespace-nowrap rounded-full bg-fg/[0.05] pr-2 pl-3.5 text-[0.95rem] text-fg-soft transition-colors duration-150 ease-out hover:bg-fg/[0.08] hover:text-fg pointer-coarse:pr-3"
        >
          <MagnifyingGlass aria-hidden="true" size={17} />
          <span className="min-w-0 flex-1 truncate text-left">Search or jump to…</span>
          <kbd className="rounded-[0.45rem] px-2 py-0.5 font-sans text-[0.78rem] font-bold text-fg-soft shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)] pointer-coarse:hidden">
            {keys}
          </kbd>
        </button>
      ) : (
        <button
          type="button"
          onClick={show}
          className="inline-flex size-11 items-center justify-center rounded-full text-fg-soft hover:bg-surface-raised hover:text-fg"
        >
          <MagnifyingGlass aria-hidden="true" size={22} />
          <span className="sr-only">Search or jump to</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-base/70 px-3 pt-[12vh] max-md:pt-3">
          {/* The scrim closes it on a click; Escape does the same from the keyboard. */}
          <div aria-hidden="true" className="absolute inset-0" onClick={close} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Travel"
            className="relative w-full max-w-[36rem] overflow-hidden rounded-box bg-surface-raised shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1),0_40px_100px_-30px_var(--r-shadow)]"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <MagnifyingGlass aria-hidden="true" size={20} className="text-fg-soft" />
              <input
                ref={input}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={results[index] ? `${listId}-${index}` : undefined}
                aria-label="Search or jump to"
                placeholder="Search or jump to…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={onKeyDown}
                className="h-15 flex-1 bg-transparent text-[1.1rem] text-fg outline-none placeholder:text-fg-muted"
              />
              <kbd className="rounded-[0.45rem] px-2 py-0.5 font-sans text-[0.78rem] font-bold text-fg-soft shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)] pointer-coarse:hidden">
                Esc
              </kbd>
            </div>
            <p role="status" className="sr-only">
              {query.trim()
                ? results.length === 0
                  ? "No matches"
                  : `${results.length} ${results.length === 1 ? "match" : "matches"}`
                : ""}
            </p>
            <div
              id={listId}
              role="listbox"
              aria-label="Places"
              className="max-h-[50vh] overflow-y-auto p-2"
            >
              {results.map((item, i) => {
                const Icon = item.icon;
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: options are chosen with the arrow keys and Enter from the input, which keeps focus (APG combobox pattern).
                  <div
                    key={item.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === index}
                    onMouseMove={() => setIndex(i)}
                    onClick={() => go(item)}
                    className={cx(
                      "flex h-12 cursor-pointer items-center gap-3 rounded-[0.8rem] px-3 text-fg",
                      i === index && "bg-fg/8",
                    )}
                  >
                    <Icon aria-hidden="true" size={20} className="text-fg-soft" />
                    <span className="flex-1 font-bold">{item.label}</span>
                    <span className="text-[0.88rem] text-fg-soft">{item.hint}</span>
                    {i === index && (
                      <ArrowRight aria-hidden="true" size={16} className="text-fg-soft" />
                    )}
                  </div>
                );
              })}
              {results.length === 0 && (
                <p className="px-3 py-6 text-center text-fg-soft">
                  Nothing matches "{query}". Your Spaces and rooms show up here; people come later.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
