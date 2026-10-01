"use client";

import { useEffect } from "react";

/**
 * Lets each part of the page rest while it's off screen: its CSS animations (the cast's waves,
 * typing dots, twinkling stars) pause, and pick up again just before it scrolls back into view.
 * Nobody sees an animation off screen, but every running one costs a little on each frame the page
 * draws. The pausing itself is CSS (`[data-still]` in globals.css); this marks the top-level parts
 * of `<main>` as they leave and enter the screen.
 *
 * It works from the scroll position and each part's place on the page (measured only when the
 * page changes size), not an IntersectionObserver: observing a part with animations running inside
 * it made Chrome recheck its intersection on every frame, which cost more than it saved.
 */
export function OffscreenStill() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    let parts: { el: Element; top: number; bottom: number }[] = [];
    let frame = 0;
    let stale = true;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (stale) {
        stale = false;
        parts = [];
        for (const el of Array.from(main.children)) {
          // Fixed layers are always on screen.
          if (getComputedStyle(el).position === "fixed") continue;
          const r = el.getBoundingClientRect();
          parts.push({ el, top: r.top + y, bottom: r.bottom + y });
        }
      }
      const h = window.innerHeight;
      const margin = h * 0.25;
      for (const p of parts) {
        const still = p.bottom < y - margin || p.top > y + h + margin;
        if (still !== p.el.hasAttribute("data-still")) p.el.toggleAttribute("data-still", still);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const remeasure = () => {
      stale = true;
      schedule();
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);
    // Parts that arrive later (once the page comes to life) are measured too.
    const mo = new MutationObserver(remeasure);
    mo.observe(main, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
