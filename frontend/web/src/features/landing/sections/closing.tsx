import Link from "next/link";
import { buttonClass } from "@/components/button";
import { cx } from "@/lib/cx";
import { Art, Explorer } from "../art";
import styles from "../fun.module.css";
import { Words } from "../words";

/** The send-off: the whole crew waving you through, under an aurora. */
export function ClosingSection() {
  return (
    <section
      aria-labelledby="closing-title"
      className={cx(styles.closing, "relative isolate mt-12 overflow-clip lg:mt-20")}
    >
      <div className="relative mx-auto flex max-w-[90rem] flex-col items-center px-4 pt-24 pb-10 text-center md:px-8 lg:pt-32">
        <Art name="spark" motion="spin" className="top-16 left-[12%] w-14 md:w-20" />
        <Art name="heart" motion="b" delay={0.7} className="top-24 right-[14%] w-14 md:w-20" />
        <Art
          name="controller"
          delay={1.3}
          className="bottom-40 left-[6%] w-20 max-md:hidden md:w-28"
        />
        <Art
          name="bubble"
          motion="c"
          delay={0.4}
          className="right-[6%] bottom-48 w-20 max-md:hidden md:w-24"
        />

        <h2 id="closing-title" className="display text-[clamp(2.3rem,5vw,4.4rem)] text-ink">
          <Words>Bring your group over.</Words>
        </h2>
        <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-soft">
          Create a Space, share one invite link, and everyone lands in the same universe.
        </p>
        <Link href="/signup" className={cx(buttonClass("primary", "lg"), styles.bouncy, "mt-9")}>
          Open Realm
        </Link>

        <div className="mt-14 flex items-end justify-center gap-1 sm:gap-4">
          <Explorer tone="pink" waving delay={0.9} className="w-20 sm:w-28 md:w-36" />
          <Explorer tone="teal" waving className="w-24 sm:w-36 md:w-44" />
          <Explorer tone="violet" waving delay={0.45} className="w-24 sm:w-36 md:w-44" />
          <Explorer tone="blue" waving delay={1.3} className="w-20 sm:w-28 md:w-36" />
        </div>
      </div>
    </section>
  );
}
