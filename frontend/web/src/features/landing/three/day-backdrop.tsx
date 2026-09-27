"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { useSkyIsDay } from "@/lib/edition";
import styles from "./three.module.css";

const CLIPS = [
  { key: "portal", src: "/video/day-portal.mp4", poster: "/video/day-portal.jpg" },
  { key: "meadow", src: "/video/day-meadow.mp4", poster: "/video/day-meadow.jpg" },
] as const;

/**
 * The day sky: two filmed loops, merged by the scroll intro. It opens at golden hour on a stone
 * arch with the sun blazing through it (the way in); scrolling through the arch dissolves into a
 * bright midday meadow, where the crew and the worlds float. The canvas above is transparent by
 * day, so these show through.
 *
 * Videos are only fetched once the day sky is wanted, play only while visible, and stay on their
 * posters for reduced motion or Pause motion.
 */
export function DayBackdrop() {
  const day = useSkyIsDay();
  const [wanted, setWanted] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    if (day) setWanted(true);
  }, [day]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () =>
      setStill(reduce.matches || document.documentElement.dataset.motion === "paused");
    sync();
    reduce.addEventListener("change", sync);
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      reduce.removeEventListener("change", sync);
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || !wanted) return;
    let visible = true;
    const update = () => {
      for (const v of videos.current) {
        if (!v) continue;
        if (day && visible && !still && !document.hidden) v.play().catch(() => {});
        else v.pause();
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      update();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [day, still, wanted]);

  return (
    <div ref={box} className={cx(styles.dayBackdrop, "absolute inset-0 -z-20")} aria-hidden="true">
      {wanted &&
        CLIPS.map((c, i) => (
          <video
            key={c.key}
            ref={(v) => {
              videos.current[i] = v;
            }}
            className={cx(styles.dayClip, styles[c.key])}
            src={c.src}
            poster={c.poster}
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
          />
        ))}
      <div className={styles.dayScrim} />
    </div>
  );
}
