import Image from "next/image";
import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import cast from "./cast.json";
import styles from "./fun.module.css";
import { WaveStrip } from "./wave-strip";

/** Realm's cast: an astronaut, aliens, monsters and people, made in Meshy. */
export type CastName = keyof typeof cast;

/**
 * Where the raised arm's wave plays over the pose (percent of the figure), its frame count, the
 * strip's width in arm-areas, and each tile's margin past the area (a fraction of its width).
 */
interface ArmArea {
  x: number;
  y: number;
  w: number;
  h: number;
  n: number;
  span: number;
  pad: number;
}

/** A character's page art (cast.json). One added before it's rigged has no wave yet. */
interface CastArt {
  w: number;
  h: number;
  pose: string;
  face: string;
  wave?: string;
  arm?: ArmArea;
}

/** A character's portrait, for avatars. */
export const castFace = (who: CastName) => `/art/cast/${(cast[who] as CastArt).face}`;

/**
 * A member of the cast, rendered from their 3D model (made in Meshy, rigged and rendered in Blender
 * by scripts/render-cast.mjs). They float gently and hop when pointed at. With `waving` they wave
 * for real: the pose is one image with the raised arm's area cut out, and over it that area plays
 * the rigged wave frame by frame (the forearm swinging from the elbow, the hand firm), so only
 * the arm moves. Reduced motion and Pause motion hold the pose.
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
  // File names carry a hash of their content (scripts/render-cast.mjs), so a re-render is always a
  // fresh address and no cache can pair an old pose with a new wave.
  const { w, h, pose, wave, arm } = cast[who] as CastArt;
  return (
    <span
      className={cx(
        styles.crew,
        "inline-block",
        !className?.includes("absolute") && "relative",
        className,
      )}
      style={{ "--delay": `${delay}s` } as CSSProperties}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <Image src={`/art/cast/${pose}`} alt="" width={w} height={h} priority={priority} />
      {arm && wave && (
        <span
          className={styles.arm}
          style={{ left: `${arm.x}%`, top: `${arm.y}%`, width: `${arm.w}%`, height: `${arm.h}%` }}
        >
          <WaveStrip
            src={`/art/cast/${wave}`}
            eager={priority}
            className={cx(styles.frames, waving && styles.waving)}
            style={{ "--span": arm.span, "--pad": arm.pad } as CSSProperties}
          />
        </span>
      )}
    </span>
  );
}
