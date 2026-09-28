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
      <h2
        id={id}
        data-fx="words"
        className="display mt-6 text-[clamp(2.1rem,3.3vw,3.25rem)] text-ink"
      >
        <Words>{title}</Words>
      </h2>
      <p className="lead mt-5 max-w-[42ch]">{children}</p>
    </div>
  );
}
