import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
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
 * the black hole in an aurora sky; by day the sun rising over a sea of cloud, seen from orbit.
 */
export function Hero() {
  return (
    <HeroScene
      copy={
        <>
          <h1
            id="hero-title"
            className="display text-[clamp(2.7rem,5vw,4.9rem)] leading-[0.98] font-bold text-ink"
          >
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
          <p className="lead mt-6 max-w-[38ch]">
            Spaces, a feed, profiles and discussion boards. Four apps, one Realm. Early access is
            open in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonClass("primary", "lg")} data-magnetic="">
              Open Realm
              <ArrowRight
                size={18}
                weight="bold"
                className="transition-transform duration-200 ease-out group-hover/button:translate-x-0.5"
              />
            </Link>
            <Link
              href="#download"
              className={cx(buttonClass("secondary", "lg"), "backdrop-blur-md")}
            >
              Download
            </Link>
          </div>
        </>
      }
    />
  );
}
