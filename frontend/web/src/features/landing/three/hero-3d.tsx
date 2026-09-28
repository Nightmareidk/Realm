"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
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
 * The hero, with a scroll intro. The section is taller than the screen and its stage stays pinned
 * while you scroll through it: it opens close on the centrepiece (the black hole at night, the sun
 * by day) under a title card, then the camera pulls back through space, the worlds and the crew
 * come into frame, and the headline slides in. Progress is written to `--p` (for the copy and the
 * day film's slow zoom) and a ref (for the camera). Reduced motion skips the intro and shows the
 * finished composition. Until the scene's first frame is ready (and on devices without WebGL) a
 * rendered poster stands in over a CSS sky.
 *
 * The sky is drawn in the canvas for both editions: night's aurora, or a bright cloudy day over
 * rolling hills with a brick gateway.
 */
export function HeroScene({ copy }: { copy: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const intro = useRef(0);
  const layout = useStageLayout(stage, box, text);
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWebgl(hasWebGL());
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
      className={cx(styles.pin, "relative -mt-16")}
      style={{ "--p": 0 } as CSSProperties}
    >
      <div
        ref={stage}
        className={cx(styles.hero, styles.stage, "isolate overflow-clip")}
        style={{ viewTransitionName: "realm-hero" }}
      >
        {webgl && (
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
            aria-label="An explorer crew of astronauts, aliens and monsters floating around a black hole (by day, the sun), with the planets Spaces, Feed, Profiles and Boards in orbit"
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
                className={cx(styles.nightOnly, "h-auto w-full")}
              />
              <Image
                src="/art/hero-poster-day.webp"
                alt=""
                width={1200}
                height={960}
                className={cx(styles.dayOnly, "h-auto w-full")}
              />
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className={cx(
            styles.toPage,
            "pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28",
          )}
        />
      </div>
    </section>
  );
}
