"use client";

import { Check } from "@phosphor-icons/react";
import type { UserSettings } from "@realm/contracts";
import { useEffect, useId, useState } from "react";
import { applyAccent, currentAccent } from "@/features/auth/accent";
import { THEME_ORDER, THEMES, type ThemeId } from "@/features/home/themes";
import { api } from "@/lib/api";
import { cx } from "@/lib/cx";

/**
 * The person's colour: Mint, Orchid, Aqua or Ember, as a radio group (arrow keys move the choice;
 * the chosen one shows a ring and a check, so colour is never the only signal). A pick re-lights
 * the app at once and is saved to the account.
 */
export function AccentPicker({ size = "md" }: { size?: "sm" | "md" }) {
  const [accent, setAccent] = useState<ThemeId>("mint");
  const [status, setStatus] = useState("");
  const name = useId();

  useEffect(() => setAccent(currentAccent()), []);

  const pick = (id: ThemeId) => {
    setAccent(id);
    applyAccent(id);
    setStatus("");
    api<UserSettings>("/users/@me/settings", { method: "PATCH", body: { accent: id } })
      .then(() => setStatus(`${THEMES[id].name} saved`))
      .catch(() =>
        setStatus(`${THEMES[id].name} is on for this device. Couldn't save it to your account.`),
      );
  };

  return (
    <fieldset>
      {/* The page or menu around it already says what this is; the legend is for screen readers. */}
      <legend className="sr-only">Your colour</legend>
      <div className={cx("flex", size === "sm" ? "gap-2" : "flex-wrap gap-3")}>
        {THEME_ORDER.map((id) => {
          const t = THEMES[id];
          const on = id === accent;
          return (
            <label
              key={id}
              title={t.name}
              className={cx(
                "relative grid cursor-pointer place-items-center transition-[box-shadow,transform] duration-200 ease-out active:scale-95",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-focus",
                size === "sm" ? "size-9 rounded-[0.7rem]" : "h-20 w-28 rounded-[1rem]",
                on
                  ? "shadow-[0_0_0_3px_var(--r-surface-raised),0_0_0_5px_var(--r-text)]"
                  : "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]",
              )}
              style={{
                background: `linear-gradient(135deg, ${t.light[0]}, ${t.light[1]} 70%, ${t.light[2]})`,
              }}
            >
              <input
                type="radio"
                name={name}
                value={id}
                checked={on}
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
                {t.name}
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
