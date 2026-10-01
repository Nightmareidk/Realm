"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cx } from "@/lib/cx";

/**
 * The site header's bar. At the very top of the page it's clear, so the hero runs up under it;
 * once you scroll it gains its frosted backing. While a hero is behind it (the landing page's is
 * deep space in both editions) it takes the night edition's inks, so it stays readable by day too.
 */
export function HeaderBar({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    // Where the hero ends on the page, and the bar's height: measured only when the page's size
    // changes, so scrolling reads nothing but the scroll position (no forced layout per frame).
    let heroEnd = -1;
    let barHeight = 0;
    let stale = true;
    const update = () => {
      frame = 0;
      if (stale) {
        stale = false;
        const hero = document.querySelector("[data-hero]");
        heroEnd = hero ? hero.getBoundingClientRect().bottom + window.scrollY : -1;
        barHeight = el.offsetHeight;
      }
      el.toggleAttribute("data-top", window.scrollY < 8);
      const overHero = heroEnd >= 0 && heroEnd - window.scrollY > barHeight + 8;
      if (overHero !== (el.dataset.edition === "night")) {
        if (overHero) el.dataset.edition = "night";
        else delete el.dataset.edition;
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
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      ro.disconnect();
    };
  }, []);

  return (
    <header
      ref={ref}
      data-top=""
      className={cx("site-header", className)}
      style={{ viewTransitionName: "realm-header" }}
    >
      {children}
    </header>
  );
}
