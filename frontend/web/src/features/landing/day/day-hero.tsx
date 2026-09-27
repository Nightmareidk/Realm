"use client";

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/button";
import { cx } from "@/lib/cx";
import { currentEdition, SKY_EVENT } from "@/lib/edition";
import styles from "./day.module.css";
import { DaySun } from "./day-sun";

/** Entrance delay for one element, after the reference timeline. */
const at = (delay: string) => ({ "--d": delay }) as CSSProperties;

/**
 * The day hero. A filmed loop of an explorer on a coral world fills the screen. The film's red
 * planet is painted out of its sky, and a live sun burns there instead, setting behind the rocks in
 * the foreground (a mask made from the film keeps them in front). Over the dark upper sky, centred: a pill, a two-line headline, a line
 * of detail and two actions, arriving in a short staggered entrance.
 *
 * The entrance is plain CSS, so it plays on first paint and again whenever the day edition is
 * switched on (the hero goes from hidden to shown). The film is only fetched once day is wanted,
 * plays only while on screen, and holds still for reduced motion or Pause motion.
 */
export function DayHero({ className }: { className?: string }) {
  const [wanted, setWanted] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    if (currentEdition() === "day") setWanted(true);
    const onSky = (e: Event) => {
      if ((e as CustomEvent<string>).detail === "day") setWanted(true);
    };
    window.addEventListener(SKY_EVENT, onSky);
    return () => window.removeEventListener(SKY_EVENT, onSky);
  }, []);

  useEffect(() => {
    const v = video.current;
    const el = section.current;
    if (!wanted || !v || !el) return;
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      const still = reduce.matches || root.dataset.motion === "paused";
      if (visible && !still && !document.hidden) v.play().catch(() => {});
      else v.pause();
    };
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      update();
    });
    io.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    document.addEventListener("visibilitychange", update);
    reduce.addEventListener("change", update);
    return () => {
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", update);
      reduce.removeEventListener("change", update);
    };
  }, [wanted]);

  return (
    <section
      ref={section}
      data-hero=""
      aria-labelledby="day-hero-title"
      className={cx(styles.day, "relative -mt-16", className)}
    >
      <div data-edition="night" className={styles.frame}>
        <div className={cx(styles.plate, styles.filmPlate)} aria-hidden="true">
          <video
            ref={video}
            className={styles.film}
            src={wanted ? "/video/day-sun.mp4" : undefined}
            muted
            loop
            playsInline
            preload={wanted ? "auto" : "none"}
            disablePictureInPicture
          />
          <div className={styles.behindRocks}>
            {/* biome-ignore lint/performance/noImgElement: a static, decorative plate that must line up with the film pixel for pixel. */}
            <img
              src="/video/day-sky-patch.webp"
              alt=""
              loading="lazy"
              decoding="async"
              className={styles.skyPatch}
            />
          </div>
        </div>
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.plate} aria-hidden="true">
          <div className={styles.behindRocks}>
            <div className={styles.sun}>
              <div className={styles.sunFallback} />
              <DaySun className={styles.sunCanvas} />
            </div>
          </div>
          <div className={styles.warmth} />
        </div>

        <div className={styles.content}>
          <Link href="/signup" className={cx(styles.pill, styles.enter)} style={at("0.26s")}>
            <span className={styles.chip}>New</span>
            Early access is open
            <ArrowRight size={14} weight="bold" aria-hidden="true" />
          </Link>
          <h1 id="day-hero-title" className={cx(styles.title, "display")}>
            <span className={styles.line}>
              <span className={styles.lineInner} style={at("0.34s")}>
                One app instead of four,
              </span>
            </span>
            <span className={styles.line}>
              <span className={styles.lineInner} style={at("0.48s")}>
                for your whole crew.
              </span>
            </span>
          </h1>
          <p className={cx(styles.sub, styles.enter)} style={at("0.86s")}>
            Spaces, a feed, profiles and discussion boards. Four apps, one Realm. Early access is
            open in your browser.
          </p>
          <div className={styles.actions}>
            <Link
              href="/signup"
              className={cx(buttonClass("primary", "lg"), styles.enter)}
              style={at("1s")}
            >
              Open Realm
            </Link>
            <Link
              href="#download"
              className={cx(buttonClass("secondary", "lg"), styles.ghost, styles.enter)}
              style={at("1.07s")}
            >
              Download
            </Link>
          </div>
        </div>
      </div>
      <div className={styles.toGround} aria-hidden="true" />
    </section>
  );
}
