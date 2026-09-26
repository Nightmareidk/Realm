import type { ReactNode } from "react";
import type { MapGeometry, RegionId } from "../map/geometry";
import { LocatorMap } from "../map/locator-map";

/** Section heading with a "you are here" locator instead of an eyebrow label. */
export function RegionHeading({
  geometry,
  region,
  id,
  title,
  children,
}: {
  geometry: MapGeometry;
  region: RegionId;
  id: string;
  title: string;
  children: ReactNode;
}) {
  const gridRef = geometry.regions.find((r) => r.id === region)?.gridRef;
  return (
    <div>
      <div className="flex items-center gap-4">
        <LocatorMap geometry={geometry} region={region} />
        <span
          className="tabular stretch-condensed text-sm font-semibold text-ink-muted"
          aria-hidden="true"
        >
          {gridRef}
        </span>
      </div>
      <h2 id={id} className="display-caps mt-6 text-[clamp(1.9rem,2.9vw,2.75rem)] text-ink">
        {title}
      </h2>
      <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
