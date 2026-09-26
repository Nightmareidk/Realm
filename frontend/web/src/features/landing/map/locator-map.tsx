import type { MapGeometry, RegionId } from "./geometry";

/**
 * A small "you are here" locator, as printed in the corner of an atlas page:
 * the continent with the current region inked and the rest left as bare land.
 */
export function LocatorMap({ geometry: g, region }: { geometry: MapGeometry; region: RegionId }) {
  const current = g.regions.find((r) => r.id === region);
  if (!current) return null;
  const clipId = `locator-${region}`;
  return (
    <svg viewBox="40 40 920 680" className="h-auto w-24 shrink-0" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={g.continent} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path d={g.continent} fill="var(--r-land)" />
        <path d={current.area} fill={`var(--r-${region}-solid)`} />
        <g fill="none" stroke="var(--r-ground)" strokeWidth="10">
          {g.borders.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
      <path d={g.continent} fill="none" stroke="var(--r-rule-strong)" strokeWidth="8" />
    </svg>
  );
}
