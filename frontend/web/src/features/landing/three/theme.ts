"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useRef } from "react";
import { useSkyIsDay } from "@/lib/edition";

/** Whether the sky is day (see lib/edition). */
export const useIsDay = useSkyIsDay;

/** 0 at night, 1 by day, and every value in between while the scene changes over. */
export type DayMix = RefObject<number>;

const DURATION = 2.8;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * A night-to-day value that plays the change as one eased move (about three seconds): the moon
 * slides off the sun, the sky brightens from the horizon up, the aurora and stars fade. Components
 * read `.current` inside useFrame. With motion stilled it jumps straight to the new value.
 */
export function useDayMix(day: boolean, still: boolean): DayMix {
  const mix = useRef(day ? 1 : 0);
  const tween = useRef<{ from: number; to: number; start: number } | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  const clock = useThree((s) => s.clock);

  useEffect(() => {
    const to = day ? 1 : 0;
    if (still) {
      mix.current = to;
      tween.current = null;
      invalidate();
      return;
    }
    if (mix.current !== to) tween.current = { from: mix.current, to, start: clock.elapsedTime };
  }, [day, still, invalidate, clock]);

  useFrame((state) => {
    const tw = tween.current;
    if (!tw) return;
    const p = Math.min(1, (state.clock.elapsedTime - tw.start) / DURATION);
    mix.current = tw.from + (tw.to - tw.from) * easeInOut(p);
    if (p >= 1) tween.current = null;
  });

  return mix;
}

/** Smoothstep, for easing positions and intensities off the day mix. */
export const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The aurora's colour cycle, keyed to the wall clock so the page's nebula stays in step. */
export const AURORA_PERIOD = 48;
export const auroraPhase = () => ((Date.now() / 1000) % AURORA_PERIOD) / AURORA_PERIOD;
