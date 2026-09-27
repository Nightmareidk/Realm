import Link from "next/link";
import { buttonClass } from "@/components/button";
import { cx } from "@/lib/cx";
import { Explorer } from "../art";
import styles from "../fun.module.css";
import { Words } from "../words";

/** The send-off: the whole cast (explorers, aliens, monsters, people) waving you through. */
export function ClosingSection() {
  return (
    <section
      aria-labelledby="closing-title"
      className={cx(styles.closing, "relative isolate mt-12 overflow-clip lg:mt-20")}
    >
      <div className="relative mx-auto flex max-w-[90rem] flex-col items-center px-4 pt-24 pb-10 text-center md:px-8 lg:pt-32">
        <h2 id="closing-title" className="display text-[clamp(2.3rem,5vw,4.4rem)] text-ink">
          <Words>Bring your group over.</Words>
        </h2>
        <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-soft">
          Create a Space, share one invite link, and everyone lands in the same universe.
        </p>
        <Link href="/signup" className={cx(buttonClass("primary", "lg"), "mt-9")}>
          Open Realm
        </Link>

        <div className="mt-14 flex items-end justify-center gap-2 sm:gap-5">
          <Explorer
            who="monster-gloop"
            waving
            delay={1.1}
            className="w-[4rem] max-md:hidden sm:w-[5.8rem] md:w-[8rem]"
          />
          <Explorer
            who="human-maya"
            waving
            delay={0.3}
            className="w-[2.7rem] sm:w-[3.9rem] md:w-[5.4rem]"
          />
          <Explorer
            who="alien-zib"
            waving
            delay={0.8}
            className="w-[2.7rem] sm:w-[3.9rem] md:w-[5.3rem]"
          />
          <Explorer who="astro-teal" waving className="w-[3.5rem] sm:w-[5.1rem] md:w-[7.1rem]" />
          <Explorer
            who="monster-bruno"
            waving
            delay={0.55}
            className="w-[4.3rem] sm:w-[6.2rem] md:w-[8.6rem]"
          />
          <Explorer
            who="alien-nova"
            waving
            delay={1.3}
            className="w-[2.3rem] sm:w-[3.2rem] md:w-[4.5rem]"
          />
          <Explorer
            who="human-leo"
            waving
            delay={0.15}
            className="w-[2.6rem] max-md:hidden sm:w-[3.7rem] md:w-[5.2rem]"
          />
        </div>
      </div>
    </section>
  );
}
