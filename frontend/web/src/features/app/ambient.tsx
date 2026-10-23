"use client";

import { useEffect, useSyncExternalStore } from "react";
import styles from "./app.module.css";

/**
 * Look B's light: the photo on screen lights the top of the page's panel, blurred into its own
 * colours. A page names its picture with `useAmbient(url)`; with none, the theme's own lights glow.
 */
let current: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAmbient(url: string | null | undefined) {
  useEffect(() => {
    current = url ?? null;
    for (const l of listeners) l();
    return () => {
      if (current === (url ?? null)) {
        current = null;
        for (const l of listeners) l();
      }
    };
  }, [url]);
}

export function AmbientLight() {
  const url = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return (
    <div aria-hidden="true" className={styles.light}>
      <div className={styles.lightPlain} />
      {url ? (
        <span key={url} className={`r-soft ${styles.lightImage}`}>
          {/* biome-ignore lint/performance/noImgElement: a decorative blur of the page's own picture. */}
          <img src={url} alt="" decoding="async" />
        </span>
      ) : null}
    </div>
  );
}
