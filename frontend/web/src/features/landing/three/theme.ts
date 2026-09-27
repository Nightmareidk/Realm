"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useRef, useState } from "react";

const readIsDay = () => document.documentElement.dataset.theme === "day";

/** Whether the day edition is on, kept in sync with `<html data-theme>`. */
export function useIsDay() {
  const [day, setDay] = useState(false);
  useEffect(() => {
    const sync = () => setDay(readIsDay());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return day;
}

/** 0 at night, 1 by day, and every value in between while the scene changes over. */
export type DayMix = RefObject<number>;

/**
 * Eases a night-to-day value toward the current edition, so switching themes plays out as the
 * eclipse ending (or beginning) instead of a cut. Components read `.current` inside useFrame.
 * With motion stilled it jumps straight to the new value and asks for one fresh frame.
 */
export function useDayMix(day: boolean, still: boolean): DayMix {
  const mix = useRef(day ? 1 : 0);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (still) {
      mix.current = day ? 1 : 0;
      invalidate();
    }
  }, [day, still, invalidate]);

  useFrame((_, delta) => {
    const target = day ? 1 : 0;
    const gap = target - mix.current;
    if (Math.abs(gap) < 0.001) {
      mix.current = target;
      return;
    }
    // Critically damped approach: about 1.5 s from one edition to the other.
    mix.current += gap * Math.min(1, delta * 2.4);
  });

  return mix;
}

/** Smoothstep, for easing positions and intensities off the day mix. */
export const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
