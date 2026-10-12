import type { Metadata } from "next";
import Link from "next/link";
import { actionClass } from "@/features/home/chrome";
import { PlatformRows } from "@/features/home/platforms";
import styles from "@/features/home/sections.module.css";
import { cx } from "@/lib/cx";
import { getReleases } from "@/lib/releases";

export const metadata: Metadata = {
  title: "Download",
  description: "Use Realm in your browser today. Desktop and phone apps are on the way.",
  alternates: { canonical: "/download" },
};

export default async function DownloadPage() {
  const releases = await getReleases();
  return (
    <section aria-labelledby="download-title" className={cx(styles.section, styles.page)}>
      <div className={cx(styles.wrap, styles.platforms)}>
        <div>
          <h1 id="download-title" className={styles.h2}>
            <span className="block">In your browser now.</span>
            <span className="block">Apps next.</span>
          </h1>
          <p className={styles.lead}>
            Realm works fully in the browser today, on a computer or a phone. The apps for desktop
            and phones use the same account; each one appears here the day it's ready.
          </p>
          <Link href="/signup" className={cx(actionClass, "mt-8 h-14 px-7 text-[1.05rem]")}>
            Open Realm in your browser
          </Link>
        </div>
        <PlatformRows releases={releases} />
      </div>
    </section>
  );
}
