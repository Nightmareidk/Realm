"use client";

import { useEffect, useState } from "react";

/**
 * Night and day editions, and the switch between them.
 *
 * Switching is a small sequence rather than a cut: bring the hero's sky into view, let the sky
 * start to change (by day the moon slides off the sun and it flares; by night the moon returns
 * and the aurora rises), then reveal the rest of the page in the new edition, spreading out from
 * the sun. People who ask for reduced motion, or who paused motion, get the switch instantly.
 */
export type Edition = "night" | "day";

/** Where the hero publishes the sun's position on screen (viewport pixels), for the reveal. */
declare global {
  interface Window {
    __realmSun?: { x: number; y: number };
  }
}

export const SKY_EVENT = "realm:sky";

export function currentEdition(): Edition {
  return document.documentElement.dataset.theme === "day" ? "day" : "night";
}

function apply(next: Edition) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("realm:theme", next);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies to this page.
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function scrollToTop(): Promise<void> {
  if (window.scrollY < 4) return Promise.resolve();
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener("scrollend", done);
      clearInterval(poll);
      clearTimeout(limit);
      resolve();
    };
    const poll = setInterval(() => {
      if (window.scrollY < 4) done();
    }, 60);
    const limit = setTimeout(done, 2000);
    window.addEventListener("scrollend", done);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

let running = false;

export async function switchEdition(next: Edition, from?: { x: number; y: number }) {
  if (running || next === currentEdition()) return;
  const root = document.documentElement;
  const still =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    root.dataset.motion === "paused";

  // The sky hears first, so a still scene can redraw in the new edition straight away.
  if (still) {
    window.dispatchEvent(new CustomEvent(SKY_EVENT, { detail: next }));
    apply(next);
    return;
  }

  running = true;
  try {
    await scrollToTop();
    window.dispatchEvent(new CustomEvent(SKY_EVENT, { detail: next }));
    await wait(650);

    const origin = window.__realmSun ?? from ?? { x: window.innerWidth * 0.7, y: 200 };
    root.style.setProperty("--vt-x", `${Math.round(origin.x)}px`);
    root.style.setProperty("--vt-y", `${Math.round(origin.y)}px`);

    if (typeof document.startViewTransition === "function") {
      root.dataset.vt = next;
      const t = document.startViewTransition(() => apply(next));
      await t.finished.catch(() => {});
      delete root.dataset.vt;
    } else {
      apply(next);
    }
  } finally {
    running = false;
  }
}

/**
 * Whether the day sky is showing. Follows `<html data-theme>`, and also hears the switch's sky
 * event, so the sky (and the day video) can start changing a beat before the rest of the page.
 */
export function useSkyIsDay() {
  const [day, setDay] = useState(false);
  useEffect(() => {
    const sync = () => setDay(currentEdition() === "day");
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const onSky = (e: Event) => setDay((e as CustomEvent<string>).detail === "day");
    window.addEventListener(SKY_EVENT, onSky);
    return () => {
      mo.disconnect();
      window.removeEventListener(SKY_EVENT, onSky);
    };
  }, []);
  return day;
}
