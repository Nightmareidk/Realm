"use client";

import { gsap } from "gsap";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { EclipseMark } from "@/components/brand/eclipse-mark";
import { SafeBoundary } from "@/components/safe-boundary";
import type { CrossingDom } from "./crossing";
import styles from "./intro.module.css";

/** The 3D part loads on its own, after the page's first paint. */
const Crossing = dynamic(() => import("./crossing").then((m) => m.Crossing), { ssr: false });

/** Played once per visit (per tab); the root layout's boot script skips it after that. */
const SEEN = "realm:intro";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The opening, on a first visit ("The Crossing"; the story is in crossing.tsx). This part is the
 * frame around the 3D: the dark of space, the name and a loading line that follows the page
 * actually loading, the white-hole burst on the far side, and the way out. Any click, key or scroll
 * skips it. Decorative: the page is all there underneath for assistive tech and search.
 */
export function Intro() {
  const root = useRef<HTMLDivElement>(null);
  const space = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const loader = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const dom = useRef<CrossingDom | null>(null);
  const [live, setLive] = useState(false);
  const [gone, setGone] = useState(false);

  const finish = useCallback(() => {
    document.documentElement.dataset.intro = "done";
    try {
      sessionStorage.setItem(SEEN, "seen");
    } catch {
      // Private mode: it'll simply play again next time.
    }
    window.dispatchEvent(new Event("realm:intro-done"));
    setGone(true);
  }, []);

  const onProgress = useCallback((p: number) => {
    if (fill.current) fill.current.style.transform = `scaleX(${Math.max(0.04, p)})`;
    if (pct.current) pct.current.textContent = `${Math.round(p * 100)}%`;
  }, []);

  useEffect(() => {
    const el = root.current;
    const html = document.documentElement;
    if (!el || html.dataset.intro === "skip" || html.dataset.intro === "done") return;
    if (!hasWebGL()) {
      finish();
      return;
    }
    html.dataset.intro = "play";
    el.setAttribute("data-live", "");
    if (space.current && stage.current && flash.current && ring.current && loader.current) {
      dom.current = {
        space: space.current,
        stage: stage.current,
        flash: flash.current,
        ring: ring.current,
        loader: loader.current,
      };
    }
    setLive(true);

    // Any intent to get going skips it (and doesn't scroll the page out from under it).
    let skipping = false;
    const skip = (e: Event) => {
      if (e.cancelable && e.type !== "pointerdown") e.preventDefault();
      if (skipping) return;
      skipping = true;
      gsap.to(el, { opacity: 0, duration: 0.45, ease: "power2.out", onComplete: finish });
    };
    const types = ["wheel", "touchmove", "keydown", "pointerdown"] as const;
    for (const t of types) window.addEventListener(t, skip, { passive: false });
    const off = () => {
      for (const t of types) window.removeEventListener(t, skip);
    };
    window.addEventListener("realm:intro-done", off, { once: true });
    return off;
  }, [finish]);

  if (gone) return null;
  return (
    <div ref={root} className={styles.intro} aria-hidden="true">
      <div ref={space} className={styles.space} />
      <div ref={stage} className={styles.stage}>
        {/* If the opening fails (its model didn't download, WebGL gave out), it simply ends. */}
        {live && (
          <SafeBoundary onError={finish}>
            <Crossing dom={dom} onProgress={onProgress} onDone={finish} />
          </SafeBoundary>
        )}
      </div>
      <div ref={flash} className={styles.flash} />
      <div ref={ring} className={styles.ring} />
      <div ref={loader} className={styles.loader}>
        <span className={styles.brand}>
          <EclipseMark />
          realm
        </span>
        <span className={styles.track}>
          <i ref={fill} className={styles.fill} />
        </span>
        <span className={styles.status}>
          <span>Opening your universe</span>
          <span ref={pct} className={styles.pct}>
            0%
          </span>
        </span>
      </div>
      <button type="button" className={styles.skip} tabIndex={-1}>
        Skip intro
      </button>
    </div>
  );
}
