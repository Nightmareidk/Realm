import { Explorer } from "../art";
import { Words } from "../words";

/**
 * The belief in one line, set big: its words light up one after another as you read down it
 * (scroll-fx.tsx, `light`). Two of the cast drift past at the edges.
 */
export function StatementSection() {
  return (
    <section aria-label="One app instead of four" className="relative overflow-clip py-24 lg:py-40">
      <div className="mx-auto max-w-[72rem] px-4 md:px-8">
        <p
          data-fx="light"
          className="display text-[clamp(2.1rem,4.6vw,4.4rem)] leading-[1.06] text-ink"
        >
          <Words>
            One app instead of four. Your Spaces, your feed, your profile and your boards live
            together, with one set of friends and one way to get around.
          </Words>
        </p>
      </div>
      <div
        data-fx="parallax"
        data-speed="0.5"
        aria-hidden="true"
        className="absolute top-10 left-[2%] w-20 max-xl:hidden 2xl:left-[6%] 2xl:w-24"
      >
        <Explorer who="alien-meshy" waving delay={0.6} />
      </div>
      <div
        data-fx="parallax"
        data-speed="-0.4"
        aria-hidden="true"
        className="absolute right-[2%] bottom-6 w-32 max-xl:hidden 2xl:right-[5%] 2xl:w-36"
      >
        <Explorer who="monster-bruno" waving delay={1.4} />
      </div>
    </section>
  );
}
