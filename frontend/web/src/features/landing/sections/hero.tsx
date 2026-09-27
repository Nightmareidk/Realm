import Image from "next/image";
import Link from "next/link";
import { buttonClass } from "@/components/button";
import { cx } from "@/lib/cx";
import styles from "../fun.module.css";
import { RotatingWord } from "../rotating-word";
import { Hero3D } from "../three/hero-3d";

const WORDS = [
  { word: "chat", color: "#2dd4bf" },
  { word: "post", color: "#60a5fa" },
  { word: "show off", color: "#a78bfa" },
  { word: "vote", color: "#f472b6" },
  { word: "hang out", color: "#b1ef4a" },
];

/**
 * First viewport: the headline with a word that keeps changing, and the live 3D universe where the
 * explorers orbit the eclipse (with a rendered poster while it loads).
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate -mt-16 overflow-clip pt-16 pb-8 lg:pb-12"
      style={{
        background:
          "radial-gradient(50% 45% at 72% 42%, rgb(45 212 191 / 0.16), transparent 70%), radial-gradient(40% 45% at 15% 15%, rgb(167 139 250 / 0.14), transparent 70%), linear-gradient(180deg, #03070d 0%, #071322 55%, var(--r-ground) 100%)",
      }}
    >
      <div className="mx-auto grid max-w-[90rem] grid-cols-1 items-center gap-6 px-4 pt-10 md:px-8 lg:grid-cols-12 lg:gap-4 lg:pt-6">
        <div className="relative z-10 lg:col-span-5 lg:pb-10">
          <h1 id="hero-title" className="display text-[clamp(2.4rem,4.6vw,4.5rem)] text-[#f4fbff]">
            <span className="sr-only">
              One place to chat, post, show off, vote and hang out with your crew.
            </span>
            <span aria-hidden="true" className="block">
              One place to
            </span>
            <RotatingWord items={WORDS} />
            <span aria-hidden="true" className="block">
              with your crew.
            </span>
          </h1>
          <p className="mt-6 max-w-[40ch] text-lg leading-relaxed text-[#cfdcec] md:text-xl">
            Spaces, a feed, profiles and discussion boards. Four apps, one Realm. Early access is
            open in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={cx(buttonClass("primary", "lg"), styles.bouncy)}>
              Open Realm
            </Link>
            <Link
              href="#download"
              className={cx(
                buttonClass("secondary", "lg"),
                styles.bouncy,
                "border-[#cfe3ff]/40 text-[#f4fbff] hover:border-[#cfe3ff] hover:bg-white/5",
              )}
            >
              Download
            </Link>
          </div>
        </div>
        <div className="relative lg:col-span-7 lg:-mr-10">
          <Hero3D
            className="aspect-[5/4] w-full"
            fallback={
              <Image
                src="/art/hero-poster.webp"
                alt=""
                width={1200}
                height={960}
                priority
                className="h-auto w-full"
              />
            }
          />
        </div>
      </div>
    </section>
  );
}
