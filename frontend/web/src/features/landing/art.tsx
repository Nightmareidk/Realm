import Image from "next/image";
import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import styles from "./fun.module.css";

/**
 * 3D-rendered assets (drawn at /render-3d; sources in brand/renders). They're decorative,
 * so they carry empty alt text and never take pointer events.
 */
export type ArtName = "heart" | "bubble" | "spark" | "lock" | "controller" | "play" | "upvote";

export type ExplorerTone = "teal" | "blue" | "violet" | "pink";

const MOTION = { a: styles.floatA, b: styles.floatB, c: styles.floatC, spin: styles.spin } as const;

/** A floating 3D prop, absolutely positioned by `className` (e.g. "top-4 -left-6 w-24"). */
export function Art({
  name,
  motion = "a",
  delay = 0,
  className,
  priority,
}: {
  name: ArtName;
  motion?: keyof typeof MOTION;
  delay?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cx(styles.art, MOTION[motion], className)}
      style={{ animationDelay: `${delay}s` } as CSSProperties}
      aria-hidden="true"
    >
      <Image
        src={`/art/${name}.webp`}
        alt=""
        width={240}
        height={240}
        priority={priority}
        className="h-auto w-full"
      />
    </span>
  );
}

/**
 * One of the explorers as a 3D render. Drifts gently, hops when pointed at, and (with `waving`)
 * waves hello by flipping between the rest and wave poses like a flipbook.
 */
export function Explorer({
  tone,
  waving = false,
  delay = 0,
  className,
  label,
}: {
  tone: ExplorerTone;
  waving?: boolean;
  delay?: number;
  className?: string;
  /** Accessible description when the character carries meaning; omit when decorative. */
  label?: string;
}) {
  return (
    <span
      className={cx(
        styles.crew,
        "inline-block",
        !className?.includes("absolute") && "relative",
        waving && styles.waving,
        className,
      )}
      style={{ "--delay": `${delay}s` } as CSSProperties}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <Image
        src={`/art/astro-${tone}.webp`}
        alt=""
        width={340}
        height={480}
        className={styles.restFrame}
      />
      {waving && (
        <Image
          src={`/art/astro-${tone}-wave.webp`}
          alt=""
          width={340}
          height={480}
          className={styles.waveFrame}
        />
      )}
    </span>
  );
}
