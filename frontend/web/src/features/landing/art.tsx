import Image from "next/image";
import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import pivots from "./explorer-pivots.json";
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
 * One of the explorers as a 3D render. Drifts gently and hops when pointed at. With `waving`, it
 * waves hello: the body and the forearm are separate layers from the same render, and the forearm
 * swings about the elbow (its pivot is measured when the art is rendered), so the wave is smooth.
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
  const wave = pivots.wave[tone];
  const rest = pivots.rest[tone];
  return (
    <span
      className={cx(
        styles.crew,
        "inline-block",
        !className?.includes("absolute") && "relative",
        className,
      )}
      style={
        {
          "--delay": `${delay}s`,
          "--px": `${wave.x}%`,
          "--py": `${wave.y}%`,
        } as CSSProperties
      }
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {waving ? (
        <>
          <Image src={`/art/astro-${tone}-body.webp`} alt="" width={wave.w} height={wave.h} />
          <Image
            src={`/art/astro-${tone}-forearm.webp`}
            alt=""
            width={wave.w}
            height={wave.h}
            className={styles.forearm}
          />
        </>
      ) : (
        <Image src={`/art/astro-${tone}.webp`} alt="" width={rest.w} height={rest.h} />
      )}
    </span>
  );
}
