"use client";

import { useEffect, useState } from "react";
import styles from "./fun.module.css";

export interface RotatingWordItem {
  word: string;
  color: string;
}

/**
 * The headline's moving word. Screen readers get the whole sentence from the parent (this part
 * is aria-hidden); reduced motion or Pause motion holds the first word still.
 */
export function RotatingWord({
  items,
  interval = 2200,
}: {
  items: RotatingWordItem[];
  interval?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const id = window.setInterval(() => {
      if (reduce.matches || root.dataset.motion === "paused" || document.hidden) return;
      setI((n) => (n + 1) % items.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [items.length, interval]);

  const longest = items.reduce((a, b) => (b.word.length > a.word.length ? b : a)).word;
  const current = items[i] ?? items[0];

  return (
    <span className={styles.rotator} aria-hidden="true">
      {/* Reserves the widest word's space so nothing around it shifts. */}
      <span data-state="ghost">{longest}</span>
      {items.map((it, n) => (
        <span
          key={it.word}
          data-state={n === i ? "in" : n === (i - 1 + items.length) % items.length ? "out" : "next"}
          style={{ color: it.color }}
        >
          {it.word}
        </span>
      ))}
      <svg
        className={styles.squiggle}
        viewBox="0 0 200 20"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          key={current?.word}
          d="M2,12C22,2 38,20 58,10S96,2 116,11 156,19 176,9 196,8 198,10"
          fill="none"
          stroke={current?.color}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
