import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { CSSProperties } from "react";
import { buttonClass } from "@/components/button";
import { cx } from "@/lib/cx";
import { type CastName, Explorer } from "../art";
import styles from "../fun.module.css";
import { Words } from "../words";

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
      className={cx(styles.closing, "relative isolate mt-12 overflow-clip lg:mt-20")}
    >
      <div className="relative mx-auto flex max-w-[90rem] flex-col items-center px-4 pt-28 text-center md:px-8 lg:pt-40">
        <h2
          id="closing-title"
          className="display text-[clamp(3rem,8vw,6rem)] leading-[0.95] font-bold text-ink"
        >
          <Words>Bring your group over.</Words>
        </h2>
        <p className="lead reveal mt-6 max-w-[44ch]">
          Create a Space, share one invite link, and everyone lands in the same universe.
        </p>
        <Link href="/signup" className={cx(buttonClass("primary", "lg"), "reveal mt-10")}>
          Open Realm
          <ArrowRight
            size={18}
            weight="bold"
            className="transition-transform duration-200 ease-out group-hover/button:translate-x-0.5"
          />
        </Link>

        <div className="relative mt-20 w-full pb-16 lg:pb-24">
          <div aria-hidden="true" className={styles.horizon} />
          <div className="relative flex items-end justify-center gap-1 sm:gap-3 lg:gap-5">
            {LINEUP.map((c, i) => (
              <div
                key={c.who}
                className={cx("rise-in", c.hideSm && "max-sm:hidden")}
                style={{ "--i": Math.abs(i - 3.5) } as CSSProperties}
              >
                <Explorer who={c.who} waving delay={(i * 0.37) % 2.1} className={c.w} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
