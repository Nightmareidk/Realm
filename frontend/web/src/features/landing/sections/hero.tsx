import Link from "next/link";
import { buttonClass } from "@/components/button";
import { cx } from "@/lib/cx";
import { RotatingWord } from "../rotating-word";
import { HeroScene } from "../three/hero-3d";

// Token colours, so each word stays readable on the night sky and on the bright day sky alike.
const WORDS = [
  { word: "chat", color: "var(--r-spaces-text)" },
  { word: "post", color: "var(--r-feed-text)" },
  { word: "share clips", color: "var(--r-profiles-text)" },
  { word: "vote", color: "var(--r-boards-text)" },
  { word: "hang out", color: "var(--r-overprint)" },
];

/**
 * First viewport: the headline with a word that keeps changing, over the live 3D universe. At night
 * the black hole in an aurora sky; by day the sun over rolling hills and a brick gateway.
 */
export function Hero() {
  return (
    <HeroScene
      copy={
        <>
          <h1 id="hero-title" className="display text-[clamp(2.4rem,4.6vw,4.5rem)] text-ink">
            <span className="sr-only">
              One place to chat, post, share clips, vote and hang out with your crew.
            </span>
            <span aria-hidden="true" className="block">
              One place to
            </span>
            <RotatingWord items={WORDS} />
            <span aria-hidden="true" className="block">
              with your crew.
            </span>
          </h1>
          <p className="mt-6 max-w-[40ch] text-lg leading-relaxed text-ink-soft md:text-xl">
            Spaces, a feed, profiles and discussion boards. Four apps, one Realm. Early access is
            open in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonClass("primary", "lg")}>
              Open Realm
            </Link>
            <Link
              href="#download"
              className={cx(buttonClass("secondary", "lg"), "bg-ground/30 backdrop-blur-sm")}
            >
              Download
            </Link>
          </div>
        </>
      }
    />
  );
}
