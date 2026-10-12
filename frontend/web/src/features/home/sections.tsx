import type { Release } from "@realm/contracts";
import Image from "next/image";
import Link from "next/link";
import { cx } from "@/lib/cx";
import { actionClass, ghostClass } from "./chrome";
import styles from "./sections.module.css";

/**
 * Honest about privacy: what's protected today comes first, then what changes before public
 * launch, said as a promise rather than a feature.
 */
export function PrivacySection() {
  const rows = [
    {
      title: "Protected, not end-to-end encrypted",
      body: "Spaces, posts, profiles and, for now, direct messages. They're encrypted on their way to Realm, and every conversation says which kind of protection it has.",
      when: "Today",
      now: true,
    },
    {
      title: "End-to-end encryption for direct messages",
      body: "Before public launch, direct messages and group chats will be end-to-end encrypted, so only the people in them can read them. Not even Realm.",
      when: "Before public launch",
      now: false,
    },
  ];
  return (
    <section id="privacy" aria-labelledby="privacy-title" className={styles.section}>
      <div className={styles.wrap}>
        <h2 id="privacy-title" data-reveal className={styles.h2}>
          <span className="block">Private where it counts.</span>
          <span className="block">Honest about the rest.</span>
        </h2>
        <ul className={cx(styles.rows, styles.privacyRows)}>
          {rows.map((r) => (
            <li key={r.title} data-reveal className={cx(styles.row, styles.privacyRow)}>
              <div>
                <b>{r.title}</b>
                <span>{r.body}</span>
              </div>
              <em className={cx(styles.tag, r.now && styles.tagNow)}>{r.when}</em>
            </li>
          ))}
        </ul>
        <p data-reveal className={styles.controls}>
          You can see and sign out of every device you're signed in on. Realm is for people 13 and
          over.
        </p>
      </div>
    </section>
  );
}

/** Where Realm runs: one honest line per kind of device, from the same release data as /download. */
export function PlatformsSection({ releases }: { releases: Release[] }) {
  const live = (platforms: string[]) =>
    releases.some((r) => platforms.includes(r.platform) && r.status === "available" && r.url);
  const rows = [
    ["Web", "Open it in any modern browser", true],
    [
      "Windows, macOS and Linux",
      "Desktop apps with push-to-talk and notifications",
      live(["windows", "macos", "linux"]),
    ],
    ["iPhone and Android", "Native apps, the same account", live(["ios", "android"])],
  ] as const;
  return (
    <section id="download" aria-labelledby="download-title" className={styles.section}>
      <div className={cx(styles.wrap, styles.platforms)}>
        <div>
          <h2 id="download-title" data-reveal className={styles.h2}>
            <span className="block">In your browser now.</span>
            <span className="block">Apps next.</span>
          </h2>
          <Link
            href="/signup"
            data-reveal
            className={cx(actionClass, "mt-8 h-14 px-7 text-[1.05rem]")}
          >
            Open Realm in your browser
          </Link>
        </div>
        <ul className={styles.rows}>
          {rows.map(([name, line, now]) => (
            <li key={name} data-reveal className={styles.row}>
              <div>
                <b>{name}</b>
                <span>{line}</span>
              </div>
              {name === "Web" ? (
                <em className={cx(styles.tag, styles.tagNow)}>Available now</em>
              ) : (
                <Link href="/download" className={cx(styles.tag, now && styles.tagNow)}>
                  {now ? "Download" : "Coming soon"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The send-off: the three phones fanned, and the one action. */
export function ClosingSection() {
  const phones = ["lobby", "chat", "profile"];
  return (
    <section aria-labelledby="close-title" className={cx(styles.section, styles.close)}>
      <div className={styles.wrap}>
        <h2 id="close-title" data-reveal className={cx(styles.h2, styles.closeTitle)}>
          Bring your crew over.
        </h2>
        <p data-reveal className={styles.lead}>
          Make a Space, share one link, and everyone's in.
        </p>
        <div data-reveal className={styles.closeActions}>
          <Link href="/signup" className={cx(actionClass, "h-14 px-7 text-[1.05rem]")}>
            Open Realm in your browser
          </Link>
          <Link href="/login" className={cx(ghostClass, "h-14 px-7 text-[1.05rem]")}>
            Sign in
          </Link>
        </div>
        <div className={styles.fan} aria-hidden="true">
          {phones.map((s, i) => (
            <figure key={s} data-fan={i - 1} className={styles.phone}>
              <Image src={`/home/screens/${s}.webp`} alt="" width={390} height={844} />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
