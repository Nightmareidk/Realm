"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useState } from "react";
import { cx } from "@/lib/cx";
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
 * The 3D hero, loaded after first paint. `fallback` (a rendered poster of the same scene) shows
 * immediately and stays for devices without WebGL; the live world crossfades in once its first
 * frame is ready. The edges fade out so the scene melts into the page instead of ending in a box.
 */
export function Hero3D({ fallback, className }: { fallback: ReactNode; className?: string }) {
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWebgl(hasWebGL());
  }, []);

  return (
    <div className={cx("relative", styles.fade, className)}>
      <div
        className={cx(
          "transition-opacity duration-700 ease-out",
          ready ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        aria-hidden={ready}
      >
        {fallback}
      </div>
      {webgl && (
        <div
          className={cx(
            "absolute inset-0 transition-opacity duration-700 ease-out",
            ready ? "opacity-100" : "opacity-0",
          )}
          role="img"
          aria-label="Four astronaut explorers floating around an eclipse, with the planets Spaces, Feed, Profiles and Boards in orbit"
        >
          <HeroWorld onReady={() => setTimeout(() => setReady(true), 250)} />
        </div>
      )}
    </div>
  );
}
