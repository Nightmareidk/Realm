import { AURORA } from "@/components/brand/eclipse-mark";
import type { RegionId, StarChart } from "./star-chart";

/**
 * A small "you are here" locator: the whole system in miniature, with the current planet lit
 * and circled, and the rest left as faint dots on their orbits.
 */
export function SystemLocator({ chart: g, region }: { chart: StarChart; region: RegionId }) {
  const { x: cx, y: cy } = g.center;
  return (
    <svg viewBox="60 110 880 490" className="h-auto w-28 shrink-0" aria-hidden="true">
      <g
        fill="none"
        stroke="var(--r-rule-strong)"
        strokeWidth="6"
        transform={`rotate(${g.tilt} ${cx} ${cy})`}
      >
        {g.orbits.slice(1).map((o) => (
          <ellipse key={o.rx} cx={cx} cy={cy} rx={o.rx} ry={o.ry} />
        ))}
      </g>
      <circle
        cx={cx - 5}
        cy={cy + 5}
        r={g.eclipse}
        fill="none"
        stroke={AURORA.lime}
        strokeWidth="14"
      />
      <circle cx={cx + 5} cy={cy - 5} r={g.eclipse - 2} fill="var(--r-ground)" />
      {g.planets.map((p) =>
        p.id === region ? (
          <g key={p.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.r + 34}
              fill="none"
              stroke="var(--r-overprint)"
              strokeWidth="8"
            />
            <circle cx={p.x} cy={p.y} r={p.r + 8} fill={`var(--r-${p.id}-solid)`} />
          </g>
        ) : (
          <circle key={p.id} cx={p.x} cy={p.y} r={p.r * 0.7} fill="var(--r-rule-strong)" />
        ),
      )}
    </svg>
  );
}
