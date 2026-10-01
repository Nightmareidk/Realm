"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { SafeBoundary } from "@/components/safe-boundary";
import { cx } from "@/lib/cx";
import { useSkyIsDay } from "@/lib/edition";
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
 * come into frame, and the headline slides in. Progress is written to `--p` (for the copy) and a
 * ref (for the camera). Reduced motion skips the intro and shows the
 * finished composition. Until the scene's first frame is ready (and on devices without WebGL) a
 * rendered poster stands in over a CSS sky.
 *
 * The sky is drawn in the canvas: the aurora storm at night, dawn from orbit by day. Both are deep
 * space, so the hero keeps the night edition's inks (light type, amber actions) in both.
 *
 * By day the stage stays pinned a while longer after the intro, for the descent (`--d` and a ref,
 * 0 → 1): the camera comes down toward the world below, the headline and the crew drift up and
 * away, the horizon climbs out of view and the clouds grow; then we drop through the cloud, puffs
 * streaming past, and come out into the bright sky, which is the page itself (the canvas clears
 * onto it). Reduced motion and Pause motion skip it.
 */
export function HeroScene({ copy }: { copy: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const intro = useRef(0);
  const descent = useRef(0);
  const day = useSkyIsDay();
  const layout = useStageLayout(stage, box, text);
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ok = hasWebGL();
    setWebgl(ok);
    // Without WebGL the poster is the hero, and it's ready now.
    if (!ok) setReady(true);
  }, []);

  // Tell the opening (intro.tsx) the hero has drawn, so it can fly through into it.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.heroReady = "";
    window.dispatchEvent(new Event("realm:hero-ready"));
  }, [ready]);

  useEffect(() => {
    const el = section.current;
    const st = stage.current;
    if (!el || !st) return;
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(width < 64rem)");
    let frame = 0;
    // The section's place and size on the page, measured only when something changes size, so
    // scrolling reads nothing but the scroll position; and the last values written, so a frame
    // that changes nothing (anywhere past the hero) doesn't restyle the whole hero.
    let top = 0;
    let height = 0;
    let h = 0;
    let stale = true;
    let wrote = "";
    const update = () => {
      frame = 0;
      // The descent only by day, and only with motion on. The section's height follows it (CSS).
      const descend = day && !reduce.matches && root.dataset.motion !== "paused";
      if (descend !== el.hasAttribute("data-descent")) {
        el.toggleAttribute("data-descent", descend);
        stale = true;
        // The page below moved: let the scroll effects measure it again.
        window.dispatchEvent(new Event("resize"));
      }
      if (stale) {
        stale = false;
        const r = el.getBoundingClientRect();
        top = r.top + window.scrollY;
        height = r.height;
        h = st.offsetHeight || window.innerHeight;
      }
      // The intro takes the first stretch (the section's height, less the descent, less a screen).
      const introSpan = h * (narrow.matches ? 1.1 : 1.6);
      const scrolled = window.scrollY - top;
      const p =
        reduce.matches || introSpan <= 0 ? 1 : Math.min(1, Math.max(0, scrolled / introSpan));
      // A beat on the finished hero, then the rest of the section is the descent.
      const hold = h * 0.25;
      const span = height - h - introSpan - hold;
      const d =
        descend && span > 0 ? Math.min(1, Math.max(0, (scrolled - introSpan - hold) / span)) : 0;
      intro.current = p;
      descent.current = d;
      const next = `${p.toFixed(4)} ${d.toFixed(4)}`;
      if (next !== wrote) {
        wrote = next;
        el.style.setProperty("--p", p.toFixed(4));
        el.style.setProperty("--d", d.toFixed(4));
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
    reduce.addEventListener("change", remeasure);
    narrow.addEventListener("change", remeasure);
    const mo = new MutationObserver(remeasure);
    mo.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    // Also when the section appears (it's hidden by day, and measures nothing while hidden), or
    // anything above it changes size.
    const ro = new ResizeObserver(remeasure);
    ro.observe(el);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      reduce.removeEventListener("change", remeasure);
      narrow.removeEventListener("change", remeasure);
      mo.disconnect();
      ro.disconnect();
    };
  }, [day]);

  return (
    <section
      ref={section}
      data-hero=""
      data-edition="night"
      aria-labelledby="hero-title"
      className={cx(styles.pin, "relative -mt-16")}
      style={{ "--p": 0, "--d": 0 } as CSSProperties}
    >
      <div
        ref={stage}
        data-live={webgl && ready ? "" : undefined}
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
            {/* If the scene fails (a model that didn't download, a GPU that gave out), the poster
                is the hero, as it is without WebGL. */}
            <SafeBoundary
              onError={() => {
                setWebgl(false);
                setReady(true);
              }}
            >
              <HeroWorld
                stage={stage}
                layout={layout}
                intro={intro}
                descent={descent}
                onReady={() => setTimeout(() => setReady(true), 150)}
              />
            </SafeBoundary>
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
