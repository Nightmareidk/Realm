import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import styles from "../fun.module.css";

const TONES = ["#b1ef4a", "#2dd4bf", "#60a5fa", "#a78bfa", "#f472b6"];

const ROW_A = [
  "lfg?",
  "gg!!",
  "who's on tonight?",
  "new clip dropped 🔥",
  "128 upvotes!!",
  "raid at 9?",
  "brb snacks",
  "that was insane",
  "welcome to the Space!",
];
const ROW_B = [
  "meme review 😂",
  "patch notes are out",
  "same time tomorrow?",
  "pinned it 📌",
  "who made this",
  "vc in 5",
  "saved for later",
  "new pfp who dis",
  "best thread ever",
];

function Row({ items, reverse, speed }: { items: string[]; reverse?: boolean; speed: number }) {
  // Two copies back to back so the loop is seamless; the copy number keeps keys unique.
  const doubled = [0, 1].flatMap((copy) => items.map((text) => ({ copy, text })));
  return (
    <div className={styles.marqueeWrap}>
      <div
        className={cx(styles.marquee, reverse && styles.reverse)}
        style={{ "--speed": `${speed}s` } as CSSProperties}
      >
        {doubled.map(({ copy, text }, i) => (
          <span
            key={`${copy}-${text}`}
            className={styles.sticker}
            style={
              {
                "--tone": TONES[i % TONES.length],
                "--tilt": `${((i * 37) % 7) - 3}deg`,
              } as CSSProperties
            }
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Two rows of chat stickers drifting past: the sound of a busy Realm. Decorative. */
export function StickerMarquee() {
  return (
    <section aria-hidden="true" className="relative overflow-clip py-10">
      <div className="grid gap-4 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <Row items={ROW_A} speed={52} />
        <Row items={ROW_B} speed={60} reverse />
      </div>
    </section>
  );
}
