import Link from "next/link";
import { buttonClass } from "@/components/button";
import { cx } from "@/lib/cx";
import { AppWindow } from "../hero/app-window";
import { HeroFragments } from "../hero/fragments";
import { GatewayScene } from "../hero/gateway-scene";
import styles from "../hero/hero.module.css";
import { Phone } from "../hero/phone";

/**
 * First viewport: the logo's world at full scale. The headline sits in the night sky, and the
 * real Realm app stands inside the lit gateway with the path leading up to it.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className={cx(styles.hero, "-mt-16 pt-16")}>
      <div
        className={cx(
          styles.copy,
          "relative z-10 mx-auto max-w-[90rem] px-4 pt-12 text-center md:px-8 lg:pt-16",
        )}
      >
        <h1 id="hero-title" className="display-caps text-[clamp(2.4rem,5.2vw,4.75rem)]">
          Four apps. One Realm.
        </h1>
        <p className="mx-auto mt-6 max-w-[46ch] text-lg leading-relaxed md:text-xl">
          Group chat, Spaces, a feed, profiles and discussion boards, together in one place. Early
          access is open in your browser.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className={buttonClass("primary", "lg")}>
            Open Realm
          </Link>
          <Link
            href="#download"
            className={cx(
              buttonClass("secondary", "lg"),
              "border-[oklch(0.86_0.05_300/0.45)] text-[oklch(0.97_0.012_290)] hover:border-[oklch(0.9_0.05_300/0.8)] hover:bg-[oklch(0.9_0.05_300/0.08)]",
            )}
          >
            Download
          </Link>
        </div>
      </div>

      <div className={styles.stage}>
        <GatewayScene className={styles.scene} />
        <AppWindow className={cx(styles.at, styles.window, styles.depthShadow)} />
        <Phone
          className={cx(
            styles.at,
            styles.phone,
            "drop-shadow-[0_30px_40px_oklch(0.08_0.06_285/0.8)]",
          )}
        />
        <HeroFragments />
      </div>
      <p className="relative mx-auto max-w-[90rem] px-4 pb-8 text-center text-xs text-[oklch(0.8_0.03_290)] md:-mt-10 md:px-8 md:text-right">
        Product previews show example content.
      </p>
    </section>
  );
}
