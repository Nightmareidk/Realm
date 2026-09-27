import type { ReactNode } from "react";
import type { RegionId, StarChart } from "../map/star-chart";
import { SystemLocator } from "../map/system-locator";
import { Words } from "../words";

/** Section heading with a "you are here" system locator instead of an eyebrow label. */
export function RegionHeading({
  chart,
  region,
  id,
  title,
  children,
}: {
  chart: StarChart;
  region: RegionId;
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <SystemLocator chart={chart} region={region} />
      <h2 id={id} className="display mt-6 text-[clamp(1.9rem,2.9vw,2.75rem)] text-ink">
        <Words>{title}</Words>
      </h2>
      <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
