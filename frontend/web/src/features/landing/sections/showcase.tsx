import { Explorer } from "../art";
import { AppWindow } from "../hero/app-window";
import { HeroFragments } from "../hero/fragments";
import { Phone } from "../hero/phone";
import { Words } from "../words";

/**
 * The product itself: the web app and the phone view. The window tips up to face you as it scrolls
 * in, the phone and two of the crew drift at their own pace in front of it, and the moments around
 * it (a mention, a board thread) spring in.
 */
export function ShowcaseSection() {
  return (
    <section aria-labelledby="showcase-title" className="relative py-20 lg:py-32">
      <div className="mx-auto max-w-[90rem] px-4 md:px-8">
        <div className="mx-auto max-w-[56rem] text-center">
          <h2
            id="showcase-title"
            data-fx="words"
            className="display text-[clamp(2.5rem,5.4vw,5.25rem)] text-ink"
          >
            <Words>Everything your group does, in one app.</Words>
          </h2>
          <p data-fx="fade" className="lead mx-auto mt-6 max-w-[50ch]">
            Chat in Spaces, catch up on the feed, check out a friend&apos;s profile, and settle
            debates on boards. No more switching between four different apps.
          </p>
        </div>

        <div className="relative mx-auto mt-28 max-w-[74rem] md:mt-24">
          {/* The light the window sits in: the four worlds' inks, soft and wide. Its own layer, so
              the scroll's zoom scales the blurred light rather than blurring it again each frame. */}
          <div
            aria-hidden="true"
            data-fx="zoom"
            className="pointer-events-none absolute inset-x-[4%] top-[6%] bottom-[-6%] -z-10 rounded-[50%] opacity-80 blur-3xl will-change-transform"
            style={{
              background:
                "radial-gradient(50% 60% at 30% 40%, color-mix(in oklch, var(--r-spaces-solid) 45%, transparent), transparent 70%), radial-gradient(45% 55% at 72% 35%, color-mix(in oklch, var(--r-profiles-solid) 45%, transparent), transparent 70%), radial-gradient(40% 50% at 55% 90%, color-mix(in oklch, var(--r-overprint-fill) 30%, transparent), transparent 70%)",
            }}
          />

          <div data-fx="tilt" className="relative">
            <AppWindow className="shadow-[0_50px_100px_-40px_color-mix(in_oklch,var(--r-shadow)_85%,transparent)]" />
            <div className="pointer-events-none absolute inset-0 max-md:hidden">
              <HeroFragments />
            </div>
          </div>

          <div
            data-fx="parallax"
            data-speed="-0.35"
            className="absolute -right-2 -bottom-16 w-[34%] max-w-[15rem] md:-right-14 md:w-[24%]"
          >
            <Phone className="drop-shadow-[0_36px_40px_color-mix(in_oklch,var(--r-shadow)_80%,transparent)]" />
          </div>

          <div
            data-fx="parallax"
            data-speed="0.3"
            className="absolute bottom-full left-4 z-10 w-20 translate-y-9 md:left-14 md:w-32"
          >
            <div data-fx="pop">
              <Explorer who="astro-teal" waving />
            </div>
          </div>
          <div
            data-fx="parallax"
            data-speed="-0.25"
            className="absolute -bottom-14 -left-10 z-10 w-24 max-md:hidden md:w-36"
          >
            <div data-fx="pop" data-delay="0.2">
              <Explorer who="monster-gloop" waving delay={1.2} />
            </div>
          </div>
        </div>

        <p className="mt-24 text-center text-xs text-ink-muted md:mt-20">
          Product previews show example content.
        </p>
      </div>
    </section>
  );
}
