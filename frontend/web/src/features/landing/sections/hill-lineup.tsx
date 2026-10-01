"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * The cast in a row along the crest of the hill at the foot of the page, each standing on its
 * curve: lower, and leaning out with the slope, the further from the middle, like people on a
 * small world. The hill is an ellipse 150vw wide and 70vw tall (fun.module.css), so for each
 * figure this works out how far the ground has fallen away under it and how steep it is there,
 * and hands both to its `[data-stand]` as `--drop` and `--tilt`.
 *
 * It also marks the section `data-near` once it's within a couple of screens, which is when the
 * footer below puts on the meadow's grass (globals.css), so that art isn't fetched up front.
 */
export function HillLineup({ children, className }: { children: ReactNode; className?: string }) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const place = () => {
      const vw = window.innerWidth;
      const a = 0.75 * vw;
      const b = 0.35 * vw;
      const mid = el.clientWidth / 2;
      for (const stand of el.querySelectorAll<HTMLElement>("[data-stand]")) {
        const box = stand.parentElement;
        // Hidden on this screen (the ends of the row on a phone).
        if (!box || box.offsetParent === null) continue;
        const x = Math.max(
          -0.95 * a,
          Math.min(0.95 * a, box.offsetLeft + box.offsetWidth / 2 - mid),
        );
        const r = Math.sqrt(1 - (x / a) ** 2);
        stand.style.setProperty("--drop", `${(b - b * r).toFixed(1)}px`);
        stand.style.setProperty(
          "--tilt",
          `${((Math.atan(((b / (a * a)) * x) / r) * 180) / Math.PI).toFixed(2)}deg`,
        );
      }
    };
    place();
    const section = el.closest<HTMLElement>("[data-ground]");
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && section) {
          section.dataset.near = "";
          near.disconnect();
        }
      },
      { rootMargin: "200% 0px" },
    );
    near.observe(el);
    // The row stops growing on a wide screen, but the hill (in vw) doesn't: watch both.
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      near.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);
  return (
    <div ref={row} data-fx="cast" className={className}>
      {children}
    </div>
  );
}
