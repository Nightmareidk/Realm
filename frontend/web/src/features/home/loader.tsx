"use client";

import { useEffect, useRef, useState } from "react";
import { Mark } from "./chrome";

/**
 * The loading page, once per visit: a phone's outline draws itself in the dark as the real work
 * finishes (the fonts, the phone screens, the 3D stage's first frame). Then the outline grows onto
 * the exact spot where the hero's centre phone stands, the dark lifts, and the real phone is there
 * inside it. No invented percentages: the line is the actual progress.
 *
 * It never holds the page longer than it must: at least a second so it reads as intended, at most
 * three, and any scroll, key or tap ends it at once. It doesn't appear with reduced motion or Pause
 * motion, on later visits in the same session, or when the page opens already scrolled (the boot
 * script marks most of those visits before first paint). The page is fully rendered underneath.
 */
const SCREENS = ["chat", "clips", "profile", "lobby", "boards"];
const KEY = "realm:loaded";
const MIN = 1000;
const MAX = 3000;
const INPUTS = ["wheel", "touchstart", "keydown", "pointerdown"];
/** Fired on window when the loader starts lifting, so the hero can make its entrance. */
export const INTRO_EVENT = "realm:intro";

export function Loader() {
  const [show, setShow] = useState(true);
  const [done, setDone] = useState(false);
  const phone = useRef<SVGSVGElement>(null);
  const line = useRef<SVGRectElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const remember = () => {
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {}
    };
    if ("homeLoaded" in root.dataset || scrollY > 0) {
      remember();
      setShow(false);
      return;
    }

    const start = performance.now();
    const total = SCREENS.length + 2;
    let finished = 0;
    let closed = false;
    const timers: number[] = [];

    const close = () => {
      if (closed) return;
      closed = true;
      remember();
      line.current?.style.setProperty("stroke-dashoffset", "0");
      // Grow the outline onto the hero's centre phone (the 3D stage publishes where it stands).
      const svg = phone.current;
      const css = getComputedStyle(root);
      const [x, y, h] = ["--hero-phone-x", "--hero-phone-y", "--hero-phone-h"].map((k) =>
        Number.parseFloat(css.getPropertyValue(k)),
      ) as [number, number, number];
      if (svg && x > 0 && y > 0 && h > 0) {
        const r = svg.getBoundingClientRect();
        const s = h / r.height;
        const dx = x - (r.left + r.width / 2);
        const dy = y - (r.top + r.height / 2);
        const to = `translate(${dx}px, ${dy}px) scale(${s})`;
        svg.animate(
          [
            { transform: "none", opacity: 1 },
            { transform: to, opacity: 1, offset: 0.7 },
            { transform: to, opacity: 0 },
          ],
          { duration: 1150, easing: "cubic-bezier(0.77, 0, 0.175, 1)", fill: "forwards" },
        );
      }
      setDone(true);
      window.dispatchEvent(new Event(INTRO_EVENT));
      timers.push(window.setTimeout(() => setShow(false), 1250));
    };
    const tick = () => {
      finished += 1;
      line.current?.style.setProperty(
        "stroke-dashoffset",
        String(1 - Math.min(1, finished / total)),
      );
      if (finished === total) {
        const wait = Math.max(0, MIN - (performance.now() - start));
        timers.push(window.setTimeout(close, wait + 200));
      }
    };

    // The real work: fonts, each phone screen decoded, and the 3D stage's first frame.
    document.fonts.ready.then(tick, tick);
    for (const s of SCREENS) {
      const img = new Image();
      img.src = `/home/screens/${s}.webp`;
      img.decode().then(tick, tick);
    }
    addEventListener("realm:stage-ready", tick, { once: true });
    timers.push(window.setTimeout(close, MAX));
    // The visitor is in charge: any scroll, key or tap ends the intro.
    for (const e of INPUTS) addEventListener(e, close, { once: true, passive: true });

    return () => {
      for (const t of timers) clearTimeout(t);
      removeEventListener("realm:stage-ready", tick);
      for (const e of INPUTS) removeEventListener(e, close);
    };
  }, []);

  if (!show) return null;
  return (
    <div
      aria-hidden="true"
      data-done={done ? "" : undefined}
      className="home-loader fixed inset-0 z-[60] place-items-center bg-[#0b0b0e]"
    >
      <div className="flex flex-col items-center gap-8">
        <svg
          ref={phone}
          viewBox="0 0 120 240"
          width="120"
          height="240"
          aria-hidden="true"
          className="overflow-visible"
        >
          <rect
            x="3"
            y="3"
            width="114"
            height="234"
            rx="17"
            fill="none"
            stroke="rgb(255 255 255 / 0.12)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <rect
            ref={line}
            x="3"
            y="3"
            width="114"
            height="234"
            rx="17"
            fill="none"
            stroke="var(--acc)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray="1"
            style={{
              strokeDashoffset: 1,
              transition: "stroke-dashoffset 0.6s cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          />
        </svg>
        <span className="home-loader__mark flex items-center gap-2.5 text-[var(--home-ink)]">
          <Mark size={24} />
          <span className="font-[family-name:var(--font-funnel)] text-[1.35rem] leading-none font-extrabold tracking-[-0.03em]">
            realm
          </span>
        </span>
      </div>
    </div>
  );
}
