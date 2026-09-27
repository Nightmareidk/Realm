import { Explorer } from "../art";
import { AppWindow } from "../hero/app-window";
import { HeroFragments } from "../hero/fragments";
import { Phone } from "../hero/phone";
import { Words } from "../words";

/** The product itself: the web app and the phone view, with the crew peeking in. */
export function ShowcaseSection() {
  return (
    <section aria-labelledby="showcase-title" className="py-16 lg:py-24">
      <div className="mx-auto max-w-[90rem] px-4 md:px-8">
        <div className="mx-auto max-w-[46rem] text-center">
          <h2 id="showcase-title" className="display text-[clamp(2.1rem,4vw,3.6rem)] text-ink">
            <Words>Everything your group does, in one app.</Words>
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-lg leading-relaxed text-ink-soft">
            Chat in Spaces, catch up on the feed, check out a friend&apos;s profile, and settle
            debates on boards. No more switching between four different apps.
          </p>
        </div>

        <div
          className="reveal relative mx-auto mt-14 max-w-[70rem] rounded-xl border border-rule p-4 md:p-10"
          style={{
            background:
              "radial-gradient(70% 90% at 50% 0%, rgb(45 212 191 / 0.24), transparent 70%), radial-gradient(50% 60% at 100% 100%, rgb(167 139 250 / 0.22), transparent 70%), radial-gradient(40% 50% at 0% 100%, rgb(177 239 74 / 0.1), transparent 70%), var(--r-panel)",
          }}
        >
          <Explorer
            tone="teal"
            waving
            className="absolute -top-20 left-4 w-24 md:-top-24 md:left-10 md:w-32"
          />
          <Explorer
            tone="pink"
            delay={0.8}
            className="absolute -bottom-10 -left-6 w-24 max-md:hidden md:w-28"
          />

          <div className="relative mx-auto max-w-[56rem]">
            <AppWindow className="shadow-[0_40px_80px_-30px_rgb(2_8_18/0.9)]" />
            <Phone className="absolute -right-4 -bottom-10 w-[34%] max-w-[13rem] drop-shadow-[0_30px_40px_rgb(2_8_18/0.8)] md:-right-16 md:w-[26%]" />
            <div className="pointer-events-none absolute inset-0 max-md:hidden">
              <HeroFragments />
            </div>
          </div>
          <p className="mt-16 text-center text-xs text-ink-muted md:mt-12">
            Product previews show example content.
          </p>
        </div>
      </div>
    </section>
  );
}
