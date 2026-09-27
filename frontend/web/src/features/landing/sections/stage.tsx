import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { RegionId } from "../map/star-chart";

type Tone = RegionId | "realm";

// Realm's own stage is lit like the eclipse's rim: teal-led aurora with a trace of lime. Lime
// alone at this strength mixes to olive on midnight, and it's reserved for actions anyway.
const glowColor = (tone: Tone) =>
  tone === "realm" ? "var(--r-spaces-solid)" : `var(--r-${tone}-solid)`;

/**
 * A feature stage: a large panel lit from one corner by a region's planet, with that planet's
 * orbit rings sweeping out of the same corner as a faint texture.
 */
export function Stage({
  tone,
  glow = "85% 100%",
  className,
  children,
}: {
  tone: Tone;
  /** Where the light (and the planet) sits, as a CSS position like "10% 100%". */
  glow?: string;
  className?: string;
  children: ReactNode;
}) {
  const [gx = 85, gy = 100] = glow.split(" ").map((v) => Number.parseFloat(v));
  const cxv = (gx / 100) * 1000;
  const cyv = (gy / 100) * 700;
  const style = {
    background: `${tone === "realm" ? `radial-gradient(60% 50% at ${glow}, color-mix(in oklch, var(--r-overprint-fill) 9%, transparent), transparent 70%), radial-gradient(90% 90% at 100% 0%, color-mix(in oklch, var(--r-profiles-solid) 12%, transparent), transparent 60%), ` : ""}radial-gradient(120% 95% at ${glow}, color-mix(in oklch, ${glowColor(tone)} ${tone === "realm" ? 22 : 34}%, transparent), transparent 62%), linear-gradient(180deg, var(--r-panel), color-mix(in oklch, var(--r-panel) 70%, var(--r-ground)))`,
  } as CSSProperties;
  return (
    <div
      className={cx(
        "reveal relative isolate overflow-hidden rounded-xl border border-rule",
        className,
      )}
      style={style}
    >
      {tone !== "realm" && (
        <svg
          viewBox="0 0 1000 700"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 -z-10 size-full"
          aria-hidden="true"
        >
          <g fill="none" stroke={`var(--r-${tone}-line)`} transform={`rotate(-14 ${cxv} ${cyv})`}>
            {[260, 420, 600, 800].map((rx, i) => (
              <ellipse
                key={rx}
                cx={cxv}
                cy={cyv}
                rx={rx}
                ry={rx * 0.42}
                strokeWidth="1.3"
                opacity={0.3 - i * 0.05}
                strokeDasharray={i === 1 ? "3 9" : undefined}
              />
            ))}
          </g>
          <circle cx={cxv} cy={cyv} r="120" fill={`var(--r-${tone}-solid)`} opacity="0.22" />
          <circle
            cx={cxv}
            cy={cyv}
            r="120"
            fill="none"
            stroke={`var(--r-${tone}-line)`}
            strokeWidth="2"
            opacity="0.4"
          />
        </svg>
      )}
      {children}
    </div>
  );
}
