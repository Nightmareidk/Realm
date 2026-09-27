import type { StarChart } from "../map/star-chart";
import { StarChartMap } from "../map/star-chart-map";
import { BoardPreview } from "../previews/board-preview";
import { FeedPreview } from "../previews/feed-preview";
import { ProfilePreview } from "../previews/profile-preview";
import { SpacesPreview } from "../previews/spaces-preview";
import { REGIONS } from "../regions";
import { Words } from "../words";

/** The star chart: how Realm is organised, as one explorable system. */
export function MapSection({ chart }: { chart: StarChart }) {
  return (
    <section id="map" aria-labelledby="map-title" className="scroll-mt-20">
      <div className="mx-auto grid max-w-[90rem] grid-cols-1 gap-12 px-4 py-24 md:px-8 lg:grid-cols-12 lg:gap-10 lg:py-32">
        <div className="lg:col-span-4 lg:pt-10">
          <h2 id="map-title" className="display text-[clamp(2.1rem,3.8vw,3.4rem)] text-ink">
            <Words>Four worlds, one universe.</Words>
          </h2>
          <p className="mt-5 max-w-[40ch] text-lg leading-relaxed text-ink-soft">
            Your friends, your Spaces and your feed share one account, one set of people, and one
            way to get around. Pick a planet to look inside.
          </p>
          <ul className="mt-9 grid gap-4">
            {REGIONS.map((r) => (
              <li key={r.id}>
                <a href={r.href} className="group flex items-start gap-3.5">
                  <span
                    className="mt-1.5 size-3 shrink-0 rounded-full"
                    style={{ background: `var(--r-${r.id}-solid)` }}
                  />
                  <span>
                    <span className="block font-semibold text-ink group-hover:underline">
                      {r.name}
                    </span>
                    <span className="block text-[0.95rem] text-ink-muted">{r.tagline}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="reveal lg:col-span-8">
          <StarChartMap
            chart={chart}
            previews={{
              spaces: <SpacesPreview variant="compact" />,
              feed: <FeedPreview variant="compact" />,
              profiles: <ProfilePreview variant="compact" />,
              boards: <BoardPreview variant="compact" />,
            }}
          />
        </div>
      </div>
    </section>
  );
}
