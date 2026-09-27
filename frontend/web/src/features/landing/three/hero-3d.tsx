"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";
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
 * The hero section. The copy sits on the left; the 3D world fills the whole section behind it,
 * framed so its objects sit in the right column. Until the scene's first frame is ready (and on
 * devices without WebGL) a rendered poster stands in, over a CSS sky for the current edition.
 */
export function HeroScene({ copy }: { copy: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWebgl(hasWebGL());
  }, []);

  return (
    <section
      ref={section}
      aria-labelledby="hero-title"
      className={cx(styles.hero, "relative isolate -mt-16 overflow-clip pt-16 pb-10 lg:pb-14")}
    >
      {webgl && (
        <div
          className={cx(
            "absolute inset-0 -z-10 transition-opacity duration-1000 ease-out",
            ready ? "opacity-100" : "opacity-0",
          )}
        >
          <HeroWorld
            section={section}
            box={box}
            text={text}
            onReady={() => setTimeout(() => setReady(true), 250)}
          />
        </div>
      )}
      <div className="mx-auto grid max-w-[90rem] grid-cols-1 items-center gap-6 px-4 pt-10 md:px-8 lg:grid-cols-12 lg:gap-4 lg:pt-6">
        <div ref={text} className="relative z-10 lg:col-span-5 lg:pb-10">
          {copy}
        </div>
        <div
          ref={box}
          role="img"
          aria-label="Four astronaut explorers floating around the Realm eclipse, with the planets Spaces, Feed, Profiles and Boards in orbit"
          className="relative aspect-[5/4] w-full lg:col-span-7 lg:-mr-10"
        >
          <div
            className={cx(
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
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-b from-transparent to-ground"
      />
    </section>
  );
}
