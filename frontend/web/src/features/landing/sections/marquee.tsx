import Image from "next/image";
import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import { people } from "../demo";
import styles from "../fun.module.css";

type Ink = "spaces" | "feed" | "profiles" | "boards";
type Message = { who: { name: string; ink: Ink; avatar?: string }; text: string };

const { noor, tomas, kenji, amara, priya, ilya, mateo, saoirse } = people;

const ROW_A: Message[] = [
  { who: tomas, text: "who's on tonight?" },
  { who: noor, text: "new clip dropped 🔥" },
  { who: kenji, text: "gg!!" },
  { who: amara, text: "raid at 9?" },
  { who: priya, text: "brb snacks" },
  { who: ilya, text: "that was insane" },
  { who: saoirse, text: "welcome to the Space!" },
  { who: mateo, text: "lfg?" },
];
const ROW_B: Message[] = [
  { who: amara, text: "meme review 😂" },
  { who: kenji, text: "patch notes are out" },
  { who: noor, text: "same time tomorrow?" },
  { who: ilya, text: "pinned it 📌" },
  { who: tomas, text: "128 upvotes!!" },
  { who: priya, text: "vc in 5" },
  { who: mateo, text: "saved for later" },
  { who: saoirse, text: "new pfp who dis" },
];

function Row({ items, reverse, speed }: { items: Message[]; reverse?: boolean; speed: number }) {
  // Two copies back to back so the loop is seamless; the copy number keeps keys unique.
  const doubled = [0, 1].flatMap((copy) => items.map((m) => ({ copy, ...m })));
  return (
    <div className={styles.marqueeWrap}>
      <div
        className={cx(styles.marquee, reverse && styles.reverse)}
        style={{ "--speed": `${speed}s` } as CSSProperties}
      >
        {doubled.map(({ copy, who, text }) => (
          <span
            key={`${copy}-${text}`}
            className={styles.sticker}
            style={{ "--tone": `var(--r-${who.ink}-solid)` } as CSSProperties}
          >
            <span className={styles.stickerAvatar}>
              {who.avatar && <Image src={who.avatar} alt="" width={72} height={72} />}
            </span>
            <span className={styles.stickerName}>{who.name.split(" ")[0]}</span>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Two rows of chat messages drifting past: the sound of a busy Realm. Decorative. */
export function StickerMarquee() {
  return (
    <section aria-hidden="true" className="relative overflow-clip py-10">
      <div className="grid gap-3 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
        <Row items={ROW_A} speed={70} />
        <Row items={ROW_B} speed={80} reverse />
      </div>
    </section>
  );
}
