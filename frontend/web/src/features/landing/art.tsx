import Image from "next/image";
import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import cast from "./cast.json";
import styles from "./fun.module.css";

/** Realm's cast: an astronaut, aliens, monsters and people, made in Meshy. */
export type CastName = keyof typeof cast;

/**
 * A member of the cast, rendered from their 3D model (they're made in Meshy and rendered in
 * Blender: scripts/render-cast.mjs). They drift gently and hop when pointed at. Every character is
 * posed with a hand up, so with `waving` they say hello: a few quick rocks from the feet every few
 * seconds.
 */
export function Explorer({
  who,
  waving = false,
  delay = 0,
  className,
  label,
  priority,
}: {
  who: CastName;
  waving?: boolean;
  delay?: number;
  className?: string;
  /** Accessible description when the character carries meaning; omit when decorative. */
  label?: string;
  priority?: boolean;
}) {
  const { w, h } = cast[who];
  return (
    <span
      className={cx(
        styles.crew,
        waving && styles.waving,
        "inline-block",
        !className?.includes("absolute") && "relative",
        className,
      )}
      style={{ "--delay": `${delay}s` } as CSSProperties}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <Image src={`/art/cast/${who}.webp`} alt="" width={w} height={h} priority={priority} />
    </span>
  );
}
