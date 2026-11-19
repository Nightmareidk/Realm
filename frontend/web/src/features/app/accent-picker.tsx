"use client";

import { Check } from "@phosphor-icons/react";
import { DEFAULT_PALETTE, type ThemePalette } from "@realm/contracts";
import { PALETTE_ORDER, PALETTES } from "@realm/design-tokens";
import { useId, useState } from "react";
import { useThemes } from "@/features/themes/theme-context";
import { cx } from "@/lib/cx";

/**
 * Your colours: Realm's colour sets (Afterglow first) as a radio group. Arrow keys move the
 * choice, and the chosen one shows a ring and a check, so colour is never the only signal. A pick
 * re-colours the app at once and is saved to the account (and undone if that fails). Wearing a
 * theme of your own, a pick goes back to Realm's look in that colour set.
 */
export function ColourPicker({ size = "md" }: { size?: "sm" | "md" }) {
  const { mine, choose } = useThemes();
  const [status, setStatus] = useState("");
  const name = useId();
  const active = mine?.active;
  const current: ThemePalette | null =
    active?.kind === "look" ? active.palette : active ? null : DEFAULT_PALETTE;

  const pick = (id: ThemePalette) => {
    setStatus("");
    const next =
      active?.kind === "look"
        ? { ...active, palette: id }
        : {
            kind: "look" as const,
            look: "now-playing" as const,
            palette: id,
            font: "match" as const,
          };
    choose(next)
      .then(() => setStatus(`${PALETTES[id].name} saved`))
      .catch(() => setStatus(`${PALETTES[id].name} didn't save. Try again.`));
  };

  return (
    <fieldset>
      {/* The page or menu around it already says what this is; the legend is for screen readers. */}
      <legend className="sr-only">Your colours</legend>
      <div className={cx("flex flex-wrap", size === "sm" ? "gap-2" : "gap-3")}>
        {PALETTE_ORDER.map((id) => {
          const p = PALETTES[id];
          const [s1, s2, s3] = p.swatch;
          const on = id === current;
          return (
            <label
              key={id}
              title={p.name}
              className={cx(
                "relative grid cursor-pointer place-items-center transition-[box-shadow,transform] duration-200 ease-out active:scale-95",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-focus",
                size === "sm" ? "size-9 rounded-[0.7rem]" : "h-20 w-28 rounded-[1rem]",
                on
                  ? "shadow-[0_0_0_3px_var(--r-surface-raised),0_0_0_5px_var(--r-text)]"
                  : "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]",
              )}
              style={{ background: `linear-gradient(135deg, ${s1}, ${s2} 70%, ${s3})` }}
            >
              <input
                type="radio"
                name={name}
                value={id}
                checked={on}
                disabled={!mine}
                onChange={() => pick(id)}
                className="sr-only"
              />
              <span
                className={
                  size === "sm"
                    ? "sr-only"
                    : "absolute bottom-2 left-2 rounded-full bg-base/75 px-2 py-0.5 text-[0.88rem] font-bold text-fg"
                }
              >
                {p.name}
              </span>
              {on && (
                <span
                  className={cx(
                    "grid place-items-center rounded-full bg-fg text-[var(--r-bg)]",
                    size === "sm" ? "size-5" : "absolute top-2 right-2 size-6",
                  )}
                >
                  <Check aria-hidden="true" size={size === "sm" ? 12 : 14} weight="bold" />
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p role="status" className={cx("text-[0.88rem] text-fg-soft", status ? "mt-2" : "sr-only")}>
        {status}
      </p>
    </fieldset>
  );
}
