"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { useSkyIsDay } from "@/lib/edition";
import styles from "./three.module.css";

/** How long the film stays up after night is asked for, while the night sky closes over it. */
const LINGER_MS = 3200;

/**
 * The day sky: a filmed crimson dusk, smoke drifting between two black monoliths with the light
 * pouring through the gap, a pine forest below. It sits behind the 3D canvas; by day the night sky
 * gives way from the horizon up and this shows through, with the sun and the crew in front. It
 * eases out slightly as the scroll intro pulls back, and runs down through ember and coral into
 * the page's own colour, so the hero meets the page as a dusk rather than a grey fade.
 *
 * It appears the moment day is asked for (the sky change starts then) and stays until the night
 * sky has closed over it again. The film is only fetched once day is wanted, plays only while on
 * screen, and holds on its first frame for reduced motion or Pause motion.
 */
export function DaySky() {
  const day = useSkyIsDay();
  const [wanted, setWanted] = useState(false);
  const [shown, setShown] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (day) {
      setWanted(true);
      setShown(true);
      return;
    }
    const t = window.setTimeout(() => setShown(false), LINGER_MS);
    return () => window.clearTimeout(t);
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
      if (shown && visible && !still && !document.hidden) v.play().catch(() => {});
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
  }, [shown, wanted]);

  return (
    <div
      ref={box}
      data-shown={shown || undefined}
      className={cx(styles.daySky, "absolute inset-0 -z-20")}
      aria-hidden="true"
    >
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
      <div className={styles.dayFade} />
    </div>
  );
}
