"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

/**
 * The quieter motion around the tour and the profile: headings and blocks rise in once as they
 * arrive (from an already visible default, so nothing depends on it), and the closing phones fan
 * open as you reach them. Off under reduced motion and Pause motion.
 */
export function HomeMotion() {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      if (document.documentElement.dataset.motion === "paused") return;
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 88%",
        once: true,
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { y: 36, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.08, overwrite: true },
          ),
      });
      gsap.utils.toArray<HTMLElement>("[data-fan]").forEach((el) => {
        const side = Number(el.dataset.fan);
        gsap.fromTo(
          el,
          { xPercent: -50, rotate: 0, yPercent: 30 },
          {
            xPercent: -50 + side * 62,
            rotate: side * 12,
            yPercent: side === 0 ? 0 : 10,
            ease: "none",
            scrollTrigger: {
              trigger: el.parentElement,
              start: "top 95%",
              end: "top 40%",
              scrub: 0.6,
            },
          },
        );
      });
    });
    // Fonts and images change heights; measure again once they've settled.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
    return () => mm.revert();
  }, []);
  return null;
}
