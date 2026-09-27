"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cx } from "@/lib/cx";

/**
 * The site header's bar. At the very top of the page it's clear, so the hero runs up under it;
 * once you scroll it gains its frosted backing. While it sits over a hero (`[data-hero]`) it takes
 * the night edition's colours, because both heroes are dark (the day hero is a film of a night-blue
 * sky); past the hero it follows the page's edition again.
 *
 * Positions are measured on resize and edition changes; scrolling only compares numbers.
 */
export function HeaderBar({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let heroBottom = 0;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      el.toggleAttribute("data-top", y < 8);
      const over = y + el.offsetHeight < heroBottom;
      if (over) el.dataset.edition = "night";
      else delete el.dataset.edition;
    };
    const measure = () => {
      heroBottom = 0;
      for (const hero of document.querySelectorAll<HTMLElement>("[data-hero]")) {
        const r = hero.getBoundingClientRect();
        if (r.height) heroBottom = Math.max(heroBottom, r.bottom + window.scrollY);
      }
      update();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    const mo = new MutationObserver(() => requestAnimationFrame(measure));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      mo.disconnect();
    };
  }, []);

  return (
    <header ref={ref} data-top="" className={cx("site-header", className)}>
      {children}
    </header>
  );
}
