import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
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
      <div className="mx-auto grid max-w-[90rem] grid-cols-1 gap-12 px-4 py-24 md:px-8 lg:grid-cols-12 lg:gap-10 lg:py-36">
        <div className="lg:col-span-4 lg:pt-6">
          <h2
            id="map-title"
            data-fx="words"
            className="display text-[clamp(2.5rem,4.4vw,4.25rem)] text-ink"
          >
            <Words>Four worlds, one universe.</Words>
          </h2>
          <p data-fx="fade" className="lead mt-6 max-w-[40ch]">
            Your friends, your Spaces and your feed share one account, one set of people, and one
            way to get around. Pick a planet to look inside.
          </p>
          <ul data-fx="stagger" data-delay="0.2" className="mt-10 grid gap-2">
            {REGIONS.map((r) => (
              <li key={r.id}>
                <a
                  href={r.href}
                  className="group -mx-3 flex items-center gap-4 rounded-2xl px-3 py-2.5 transition-colors duration-200 ease-out hover:bg-[color-mix(in_oklch,var(--r-ink)_6%,transparent)]"
                >
                  <Image
                    src={`/art/planet-${r.id}.webp`}
                    alt=""
                    width={96}
                    height={96}
                    className="size-12 shrink-0 transition-transform duration-500 ease-out group-hover:rotate-[-24deg] group-hover:scale-110"
                  />
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold text-ink">{r.name}</span>
                    <span className="block text-[0.95rem] text-ink-muted">{r.tagline}</span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    size={18}
                    className="ml-auto shrink-0 text-ink-muted transition-transform duration-200 ease-out group-hover:translate-x-1 group-hover:text-ink"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div data-fx="zoom" className="lg:col-span-8">
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
