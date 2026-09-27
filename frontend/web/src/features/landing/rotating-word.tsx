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
    </span>
  );
}
