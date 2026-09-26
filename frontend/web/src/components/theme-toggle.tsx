"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

type Edition = "night" | "day";

/** Night is the default edition; day is opt-in and remembered on this device. */
export function ThemeToggle({ className }: { className?: string }) {
  const [edition, setEdition] = useState<Edition>("night");

  useEffect(() => {
    setEdition(document.documentElement.dataset.theme === "day" ? "day" : "night");
  }, []);

  const choose = (next: Edition) => {
    setEdition(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("realm:theme", next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies to this page.
    }
  };

  return (
    <fieldset className={cx("inline-flex rounded-md border border-rule p-0.5", className)}>
      <legend className="sr-only">Map edition</legend>
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
          onClick={() => choose(value)}
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
