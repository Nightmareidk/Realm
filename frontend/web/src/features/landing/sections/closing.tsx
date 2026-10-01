import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { buttonClass } from "@/components/button";
import { cx } from "@/lib/cx";
import { type CastName, Explorer } from "../art";
import styles from "../fun.module.css";
import { Words } from "../words";
import { HillLineup } from "./hill-lineup";

// The whole cast, left to right, big ones at the ends and the middle. Sizes are widths; the
// renders are all the same height, so a wide monster needs more width to stand as tall.
const LINEUP: { who: CastName; w: string; hideSm?: boolean }[] = [
  { who: "monster-gloop", w: "w-[5.5rem] sm:w-[7rem] lg:w-[9.5rem]", hideSm: true },
  { who: "human-maya", w: "w-[3rem] sm:w-[3.6rem] lg:w-[4.8rem]" },
  { who: "alien-zib", w: "w-[3rem] sm:w-[3.7rem] lg:w-[5rem]" },
  { who: "astro-teal", w: "w-[4rem] sm:w-[4.8rem] lg:w-[6.4rem]" },
  { who: "monster-bruno", w: "w-[5.8rem] sm:w-[7rem] lg:w-[9.4rem]" },
  { who: "alien-meshy", w: "w-[3.3rem] sm:w-[4.1rem] lg:w-[5.4rem]" },
  { who: "alien-nova", w: "w-[2.4rem] sm:w-[2.9rem] lg:w-[3.9rem]" },
  { who: "human-leo", w: "w-[2.9rem] sm:w-[3.5rem] lg:w-[4.7rem]", hideSm: true },
];

/** The send-off: the whole cast rises onto the horizon and waves you through. */
export function ClosingSection() {
  return (
    <section
      aria-labelledby="closing-title"
      // The page ends on the ground: the footer below is the ground they stand on (globals.css).
      data-ground=""
      className={cx(styles.closing, "relative isolate mt-12 overflow-clip lg:mt-20")}
    >
      <div className="relative mx-auto flex max-w-[90rem] flex-col items-center px-4 pt-28 text-center md:px-8 lg:pt-40">
        <div data-fx="zoom">
          <h2
            id="closing-title"
            data-fx="words"
            className="display text-[clamp(3rem,8vw,6rem)] leading-[0.95] font-bold text-ink"
          >
            <Words>Bring your group over.</Words>
          </h2>
        </div>
        <p data-fx="fade" className="lead mt-6 max-w-[44ch]">
          Create a Space, share one invite link, and everyone lands in the same universe.
        </p>
        <Link
          href="/signup"
          data-fx="fade"
          data-delay="0.25"
          data-magnetic=""
          className={cx(buttonClass("primary", "lg"), "mt-10")}
        >
          Open Realm
          <ArrowRight
            size={18}
            weight="bold"
            className="transition-transform duration-200 ease-out group-hover/button:translate-x-0.5"
          />
        </Link>

        <div className="relative mt-20 w-full pb-(--closing-foot)">
          {/* The ground: the Moon by night (render_moon.py), a meadow by day (render_meadow.py). */}
          <div aria-hidden="true" className={styles.horizon} />
          <div aria-hidden="true" className={styles.moon}>
            {/* biome-ignore lint/performance/noImgElement: a wide art plate, lazy, sized in vw. */}
            <img src="/art/sky/moon.webp" alt="" loading="lazy" decoding="async" />
          </div>
          <div aria-hidden="true" className={styles.meadow}>
            {/* biome-ignore lint/performance/noImgElement: a wide art plate, lazy, sized in vw. */}
            <img src="/art/sky/hill.webp" alt="" loading="lazy" decoding="async" />
          </div>
          <HillLineup className="relative flex items-end justify-center gap-1 sm:gap-3 lg:gap-5">
            {LINEUP.map((c, i) => (
              <div key={c.who} className={cx(c.hideSm && "max-sm:hidden")}>
                <span data-stand="" className={styles.stand}>
                  <Explorer who={c.who} waving delay={(i * 0.37) % 2.1} className={c.w} />
                </span>
              </div>
            ))}
          </HillLineup>
          {/* The blade tips along the crest, again in front of their feet: they stand in the grass. */}
          <div aria-hidden="true" className={styles.meadowFront}>
            {/* biome-ignore lint/performance/noImgElement: the same plate, masked to the crest. */}
            <img src="/art/sky/hill.webp" alt="" loading="lazy" decoding="async" />
          </div>
        </div>
      </div>
    </section>
  );
}
