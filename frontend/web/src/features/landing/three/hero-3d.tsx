"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { currentEdition, SKY_EVENT } from "@/lib/edition";
import { useStageLayout } from "./layout";
import styles from "./three.module.css";

const HeroWorld = dynamic(() => import("./hero-world"), { ssr: false });

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The night hero, with a scroll intro. The section is taller than the screen and its stage stays
 * pinned while you scroll through it: it opens close on the black hole under a title card, then the
 * camera pulls back through space, the worlds and the crew come into frame, and the headline slides
 * in. Progress is written to `--p` (for the copy) and a ref (for the camera). Reduced motion skips
 * the intro and shows the finished composition. Until the scene's first frame is ready (and on
 * devices without WebGL) a rendered poster stands in over a CSS sky.
 *
 * By day this whole section is hidden (the day hero takes its place), and the 3D scene isn't loaded
 * at all until night is wanted.
 */
export function HeroScene({ copy, className }: { copy: ReactNode; className?: string }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const intro = useRef(0);
  const layout = useStageLayout(stage, box, text);
  const [webgl, setWebgl] = useState(false);
  const [wanted, setWanted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWebgl(hasWebGL());
  }, []);
  // Load the 3D scene once night is showing or about to. By day, load it quietly once the page
  // has settled, so switching to night later is instant (it doesn't draw while hidden).
  useEffect(() => {
    if (currentEdition() === "night") setWanted(true);
    const onSky = (e: Event) => {
      if ((e as CustomEvent<string>).detail === "night") setWanted(true);
    };
    window.addEventListener(SKY_EVENT, onSky);
    // Not on a data saver, though: then it waits until night is asked for.
    const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
    let idle = 0;
    const later = saveData
      ? 0
      : window.setTimeout(() => {
          idle = window.requestIdleCallback?.(() => setWanted(true), { timeout: 4000 }) ?? 0;
        }, 4000);
    return () => {
      window.removeEventListener(SKY_EVENT, onSky);
      window.clearTimeout(later);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, []);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = reduce.matches || span <= 0 ? 1 : Math.min(1, Math.max(0, -r.top / span));
      intro.current = p;
      el.style.setProperty("--p", p.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduce.addEventListener("change", schedule);
    // Also when the section appears (it's hidden by day, and measures nothing while hidden).
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduce.removeEventListener("change", schedule);
      ro.disconnect();
    };
  }, []);

  return (
    <section
      ref={section}
      data-hero=""
      aria-labelledby="hero-title"
      className={cx(styles.pin, "relative -mt-16", className)}
      style={{ "--p": 0 } as CSSProperties}
    >
      <div ref={stage} className={cx(styles.hero, styles.stage, "isolate overflow-clip")}>
        {webgl && wanted && (
          <div
            className={cx(
              "absolute inset-0 -z-10 transition-opacity duration-1000 ease-out",
              ready ? "opacity-100" : "opacity-0",
            )}
          >
            <HeroWorld
              stage={stage}
              layout={layout}
              intro={intro}
              onReady={() => setTimeout(() => setReady(true), 150)}
            />
          </div>
        )}

        <div className={styles.titleCard}>
          <p aria-hidden="true" className={cx(styles.titleWord, "display text-ink")}>
            Realm
          </p>
          <p className="mt-3 max-w-[32ch] text-center text-lg text-ink-soft md:text-xl">
            Step into another universe, with your whole crew.
          </p>
          <span aria-hidden="true" className={styles.scrollCue}>
            Scroll to enter
            <i />
          </span>
        </div>

        <div className="mx-auto grid h-full max-w-[90rem] grid-cols-1 content-center items-center gap-6 px-4 pt-20 pb-10 md:px-8 lg:grid-cols-12 lg:gap-4 lg:pt-16">
          <div ref={text} className={cx(styles.copy, "relative z-10 lg:col-span-5 lg:pb-10")}>
            {copy}
          </div>
          <div
            ref={box}
            role="img"
            aria-label="An explorer crew of astronauts, aliens and monsters floating around a black hole, with the planets Spaces, Feed, Profiles and Boards in orbit"
            className="relative aspect-[5/4] w-full max-lg:max-h-[42svh] lg:col-span-7 lg:-mr-10"
          >
            <div
              className={cx(
                styles.poster,
                "transition-opacity duration-700 ease-out",
                ready ? "opacity-0" : "opacity-100",
              )}
              aria-hidden="true"
            >
              <Image
                src="/art/hero-poster-night.webp"
                alt=""
                width={1200}
                height={960}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-b from-transparent to-ground"
        />
      </div>
    </section>
  );
}
