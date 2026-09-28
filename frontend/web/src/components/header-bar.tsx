"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cx } from "@/lib/cx";

/**
 * The site header's bar. At the very top of the page it's clear, so the hero runs up under it;
 * once you scroll it gains its frosted backing.
 */
export function HeaderBar({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      el.toggleAttribute("data-top", window.scrollY < 8);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
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
