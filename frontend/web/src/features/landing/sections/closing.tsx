import Link from "next/link";
import { buttonClass } from "@/components/button";
import { cx } from "@/lib/cx";
import { GatewayScene } from "../hero/gateway-scene";
import styles from "../hero/hero.module.css";

/**
 * The bookend: the whole gateway, unobstructed this time, with the way in placed inside the
 * arch. The course that started in the hero finishes here.
 */
export function ClosingSection() {
  return (
    <section aria-labelledby="closing-title" className={cx(styles.hero, "mt-12 lg:mt-20")}>
      <div
        className={cx(
          styles.copy,
          "relative z-10 mx-auto max-w-[90rem] px-4 pt-24 text-center md:px-8 lg:pt-28",
        )}
      >
        <h2 id="closing-title" className="display-caps text-[clamp(2.2rem,4.6vw,4.25rem)]">
          Bring your group over.
        </h2>
        <p className="mx-auto mt-5 max-w-[42ch] text-lg leading-relaxed">
          Create a Space, share one invite link, and everyone lands in the same place.
        </p>
      </div>
      <div className={cx(styles.stage, styles.closingStage)}>
        <GatewayScene className={styles.scene} />
        <div className={cx(styles.at, styles.doorway)}>
          <Link
            href="/signup"
            className={cx(
              buttonClass("primary", "lg"),
              "shadow-[0_12px_40px_-8px_var(--r-overprint-fill)]",
            )}
          >
            Open Realm
          </Link>
        </div>
      </div>
    </section>
  );
}
