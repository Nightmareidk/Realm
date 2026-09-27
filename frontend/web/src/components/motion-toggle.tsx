"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

/**
 * Pause motion: stops every animation on the page (CSS, the rotating headline and the 3D scene)
 * and is remembered on this device. People who ask their OS for reduced motion get the same
 * stillness automatically; this is for everyone else who finds the movement distracting.
 */
export function MotionToggle({
  label = false,
  className,
}: {
  label?: boolean;
  className?: string;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setPaused(document.documentElement.dataset.motion === "paused");
  }, []);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    if (next) document.documentElement.dataset.motion = "paused";
    else delete document.documentElement.dataset.motion;
    try {
      localStorage.setItem("realm:motion", next ? "paused" : "on");
    } catch {
      // Storage can be unavailable (private mode); the choice still applies to this page.
    }
  };

  // The label stays "Pause motion"; aria-pressed carries the state, the icon shows what a click does.
  const Icon = paused ? Play : Pause;
  return (
    <button
      type="button"
      aria-pressed={paused}
      aria-label={label ? undefined : "Pause motion"}
      title={label ? undefined : paused ? "Motion paused" : "Pause motion"}
      onClick={toggle}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-rule text-ink-soft transition-colors duration-160 ease-out hover:border-rule-strong hover:text-ink",
        label ? "px-3 text-xs font-semibold" : "w-9",
        className,
      )}
    >
      <Icon size={15} weight="fill" />
      {label && "Pause motion"}
    </button>
  );
}
