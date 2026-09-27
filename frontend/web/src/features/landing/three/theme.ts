"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useRef } from "react";
import { SKY_EVENT, SKY_LEAD_MS } from "@/lib/edition";

/** A 0..1 value that components read as `.current` inside useFrame. */
export type Pulse = RefObject<number>;

/**
 * The black hole's flare when the page switches to day: 0 at rest, then rising to 1 over the
 * moment between the switch being asked for and the day page being revealed (spreading out from
 * the hole). The night scene is hidden by day, so switching back to night simply rests it again.
 */
export function useIgnite(): Pulse {
  const value = useRef(0);
  const start = useRef<number | null>(null);
  const clock = useThree((s) => s.clock);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const onSky = (e: Event) => {
      if ((e as CustomEvent<string>).detail === "day") {
        start.current = clock.elapsedTime;
      } else {
        start.current = null;
        value.current = 0;
      }
      invalidate();
    };
    window.addEventListener(SKY_EVENT, onSky);
    return () => window.removeEventListener(SKY_EVENT, onSky);
  }, [clock, invalidate]);

  useFrame((state) => {
    if (start.current === null) return;
    const p = Math.min(1, (state.clock.elapsedTime - start.current) / (SKY_LEAD_MS / 1000));
    // Accelerating into the reveal, so the flash peaks as the new page opens from the hole.
    value.current = p * p;
    if (p < 1) state.invalidate();
  });

  return value;
}

/** Smoothstep, for easing positions and intensities. */
export const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The aurora's colour cycle, keyed to the wall clock so the page's nebula stays in step. */
export const AURORA_PERIOD = 48;
export const auroraPhase = () => ((Date.now() / 1000) % AURORA_PERIOD) / AURORA_PERIOD;
