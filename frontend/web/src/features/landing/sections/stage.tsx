import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { MapGeometry, RegionId } from "../map/geometry";

type Tone = RegionId | "realm";

const glowColor = (tone: Tone) =>
  tone === "realm" ? "var(--r-overprint-fill)" : `var(--r-${tone}-solid)`;

/**
 * A feature stage: a large panel lit from one corner (a region's ink, or Realm violet), with
 * that region's contour lines as a faint texture. The corner radius echoes the logo tile.
 */
export function Stage({
  tone,
  geometry,
  glow = "85% 100%",
  className,
  children,
}: {
  tone: Tone;
  /** Needed for region tones, to draw the contour texture. */
  geometry?: MapGeometry;
  /** Where the light comes from, as a CSS position. */
  glow?: string;
  className?: string;
  children: ReactNode;
}) {
  const contours =
    tone === "realm" ? [] : (geometry?.regions.find((r) => r.id === tone)?.contours ?? []);
  const style = {
    background: `radial-gradient(120% 95% at ${glow}, color-mix(in oklch, ${glowColor(tone)} ${tone === "realm" ? 30 : 34}%, transparent), transparent 62%), linear-gradient(180deg, var(--r-panel), color-mix(in oklch, var(--r-panel) 70%, var(--r-ground)))`,
  } as CSSProperties;
  return (
    <div
      className={cx(
        "reveal relative isolate overflow-hidden rounded-xl border border-rule",
        className,
      )}
      style={style}
    >
      {contours.length > 0 && (
        <svg
          viewBox="0 0 1000 740"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 -z-10 size-full opacity-[0.16]"
          aria-hidden="true"
        >
          <g fill="none" stroke={`var(--r-${tone}-line)`} strokeWidth="1.4">
            {contours.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </svg>
      )}
      {children}
    </div>
  );
}
