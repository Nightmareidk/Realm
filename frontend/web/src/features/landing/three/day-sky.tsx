"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { useSkyIsDay } from "@/lib/edition";
import styles from "./three.module.css";

/**
 * The day sky: a filmed crimson dusk, smoke drifting between two black monoliths with the light
 * pouring through the gap, a pine forest below. It sits behind the 3D canvas, which is clear by
 * day, so the sun, the worlds and the crew float in front of it; it eases out slightly as the
 * scroll intro pulls back.
 *
 * The film is only fetched once the day is wanted (a beat before a switch reveals it), plays only
 * while on screen, and holds on its first frame for reduced motion or Pause motion.
 */
export function DaySky() {
  const day = useSkyIsDay();
  const [wanted, setWanted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (day) setWanted(true);
  }, [day]);

  useEffect(() => {
    const el = box.current;
    const v = video.current;
    if (!el || !v || !wanted) return;
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      const still = reduce.matches || root.dataset.motion === "paused";
      if (day && visible && !still && !document.hidden) v.play().catch(() => {});
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
  }, [day, wanted]);

  return (
    <div ref={box} className={cx(styles.daySky, "absolute inset-0 -z-20")} aria-hidden="true">
      {wanted && (
        <video
          ref={video}
          className={styles.dayFilm}
          src="/video/day-sky.mp4"
          poster="/video/day-sky.jpg"
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
        />
      )}
    </div>
  );
}
