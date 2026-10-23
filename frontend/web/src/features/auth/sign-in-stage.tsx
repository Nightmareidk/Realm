import { ChatsCircle, MusicNotes, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/features/home/chrome";
import styles from "./sign-in-stage.module.css";

const POINTS = [
  {
    icon: MusicNotes,
    title: "Songs on everything",
    line: "Posts and Stories play their music; keep listening while you look around.",
  },
  {
    icon: UsersThree,
    title: "Spaces for your people",
    line: "Rooms to chat in, voice to hang out in, and your own rules.",
  },
  {
    icon: ChatsCircle,
    title: "Chats in your colours",
    line: "Seen, unsend, photos that disappear, and a colour for every chat.",
  },
];

/**
 * Signing in, in Look B: Realm's light glowing behind, what Realm is in three lines, and the card.
 * No pretend app behind the form. The light moves slowly unless motion is turned down.
 */
export function SignInStage({ card, header }: { card: ReactNode; header?: ReactNode }) {
  return (
    <div className="relative isolate flex flex-1 flex-col">
      <div aria-hidden="true" className={styles.light}>
        <span className={styles.one} />
        <span className={styles.two} />
        <span className={styles.three} />
      </div>
      {header}
      <main
        id="main"
        className="mx-auto flex w-full max-w-[76rem] flex-1 items-center gap-16 px-6 pt-2 pb-10 lg:py-16 max-lg:justify-center"
      >
        <section className="min-w-0 flex-1 max-lg:hidden" aria-labelledby="realm-is">
          <Link
            href="/"
            aria-label="Realm home"
            className="inline-flex rounded-full text-fg [&_span:last-child]:text-[2rem]"
          >
            <Wordmark />
          </Link>
          <h1
            id="realm-is"
            className="mt-10 max-w-[34rem] font-display text-[3.4rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-fg"
          >
            Your people. Your Spaces. Your songs.
          </h1>
          <ul className="mt-10 max-w-[30rem] space-y-5">
            {POINTS.map(({ icon: Icon, title, line }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-fg/8 text-accent">
                  <Icon aria-hidden="true" size={22} weight="fill" />
                </span>
                <span>
                  <span className="block font-bold text-fg">{title}</span>
                  <span className="block text-[0.95rem] leading-snug text-fg-soft">{line}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        {card}
      </main>
    </div>
  );
}
