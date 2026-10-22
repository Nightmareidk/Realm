"use client";

import {
  Circle,
  Drop,
  Flower,
  Heart,
  Leaf,
  MusicNote,
  Rectangle,
  Snowflake,
  Sparkle,
  Star,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import styles from "./art.module.css";
import { useThemes } from "./theme-context";

/** Steady pseudo-random numbers, so effects look the same each time. */
const rand = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const COUNT = { few: 10, some: 18, lots: 28 } as const;

const BAT =
  "M12 8.2c-.6 0-1 .6-1.2 1.3L9.5 8.7C8.2 9.5 6 9.7 3.5 8.9c.9 1 1.4 2.3 1.4 3.6 1.2-.6 2.7-.6 3.6.2.7-.8 1.9-1 2.7-.3.3-.6.5-.9.8-.9s.5.3.8.9c.8-.7 2-.5 2.7.3.9-.8 2.4-.8 3.6-.2 0-1.3.5-2.6 1.4-3.6-2.5.8-4.7.6-6-.2l-1.3.8c-.2-.7-.6-1.3-1.2-1.3Z";

/** The drawing for each falling shape (Phosphor where one fits), in the theme's colour. */
function Shape({ shape }: { shape: string }) {
  const icon = { weight: "fill" as const, size: "1em", "aria-hidden": true };
  switch (shape) {
    case "snow":
      return <Snowflake {...icon} weight="bold" />;
    case "hearts":
      return <Heart {...icon} />;
    case "stars":
      return <Star {...icon} />;
    case "sparkles":
      return <Sparkle {...icon} />;
    case "petals":
      return <Flower {...icon} />;
    case "leaves":
      return <Leaf {...icon} />;
    case "notes":
      return <MusicNote {...icon} />;
    case "rain":
      return <Drop {...icon} />;
    case "bubbles":
      return <Circle {...icon} weight="bold" />;
    case "confetti":
      return <Rectangle {...icon} />;
    case "bats":
      return (
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d={BAT} />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * A theme's art behind the app: the wallpaper (dimmed so text stays readable), a pattern, and
 * things that fall or float. Behind everything, never taking a click; effects stop with reduced
 * motion and Pause motion (art.module.css).
 */
export function ThemeArt() {
  const { shown } = useThemes();
  const effect = shown.art.effect;
  const items = useMemo(
    () =>
      effect
        ? Array.from({ length: COUNT[effect.amount] }, (_, i) => ({
            left: `${(rand(i, 1) * 100).toFixed(2)}%`,
            size: `${(0.7 + rand(i, 2) * 0.9).toFixed(2)}rem`,
            duration: `${(9 + rand(i, 3) * 12).toFixed(1)}s`,
            delay: `-${(rand(i, 4) * 20).toFixed(1)}s`,
            sway: `${(10 + rand(i, 5) * 30).toFixed(0)}px`,
          }))
        : [],
    [effect],
  );
  return (
    <div aria-hidden="true" className={styles.art}>
      <div className={styles.wallpaper} />
      <div className={styles.pattern} />
      {effect && (
        <div className={styles.effects} data-rise={effect.shape === "bubbles" ? "" : undefined}>
          {items.map((it, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, generated list
              key={i}
              className={styles.faller}
              style={
                {
                  left: it.left,
                  fontSize: it.size,
                  color: effect.color,
                  animationDuration: it.duration,
                  animationDelay: it.delay,
                  "--sway": it.sway,
                } as React.CSSProperties
              }
            >
              <Shape shape={effect.shape} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** A theme sticker in one of the spots kept for them; nothing when the theme has none. */
export function ThemeSticker({
  slot,
  size = 36,
}: {
  slot: "header" | "empty" | "profile";
  size?: number;
}) {
  const { shown } = useThemes();
  const id = shown.art.stickers?.[slot]?.match(/^media:([1-9]\d{0,19})$/)?.[1];
  if (!id) return null;
  return (
    // biome-ignore lint/performance/noImgElement: Realm media, already sized and served by the API
    <img
      src={`/api/v1/media/${id}/raw`}
      alt=""
      width={size}
      height={size}
      className="pointer-events-none select-none object-contain"
      style={{ width: size, height: size }}
    />
  );
}
