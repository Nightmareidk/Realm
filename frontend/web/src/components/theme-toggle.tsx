"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { type MouseEvent, useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { type Edition, switchEdition } from "@/lib/edition";

/** The current edition, kept in sync with `<html data-theme>` (so every toggle agrees). */
function useEdition(): Edition {
  const [edition, setEdition] = useState<Edition>("night");
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setEdition(root.dataset.theme === "day" ? "day" : "night");
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return edition;
}

const originOf = (e: MouseEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Night is the default edition; day is opt-in and remembered on this device. */
export function ThemeToggle({ className }: { className?: string }) {
  const edition = useEdition();
  return (
    <fieldset className={cx("inline-flex rounded-md border border-rule p-0.5", className)}>
      <legend className="sr-only">Colour theme</legend>
      {(
        [
          ["night", "Night", Moon],
          ["day", "Day", Sun],
        ] as const
      ).map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          aria-pressed={edition === value}
          onClick={(e) => switchEdition(value, originOf(e))}
          className={cx(
            "inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-semibold transition-colors duration-160 ease-out",
            edition === value ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink",
          )}
        >
          <Icon size={14} weight={edition === value ? "fill" : "regular"} />
          {label}
        </button>
      ))}
    </fieldset>
  );
}

/** A compact sun/moon switch for the header. */
export function EditionToggle({ className }: { className?: string }) {
  const edition = useEdition();
  const day = edition === "day";
  return (
    <button
      type="button"
      aria-pressed={day}
      aria-label="Day theme"
      title={day ? "Switch to night" : "Switch to day"}
      onClick={(e) => switchEdition(day ? "night" : "day", originOf(e))}
      className={cx(
        "inline-flex size-9 items-center justify-center rounded-md border border-rule text-ink-soft transition-colors duration-160 ease-out hover:border-rule-strong hover:text-ink",
        className,
      )}
    >
      {day ? <Sun size={16} weight="fill" /> : <Moon size={16} weight="fill" />}
    </button>
  );
}
