import {
  AndroidLogo,
  AppleLogo,
  Browser,
  DownloadSimple,
  LinuxLogo,
  WindowsLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { Release, ReleasePlatform } from "@realm/contracts";
import Link from "next/link";
import type { ComponentType } from "react";
import { cx } from "@/lib/cx";
import styles from "./sections.module.css";

type Icon = ComponentType<{ size?: number; "aria-hidden"?: boolean }>;

/** Every app Realm will ship, in the order people look for them. */
export const APPS: { platform: ReleasePlatform; name: string; kind: string; Icon: Icon }[] = [
  { platform: "windows", name: "Windows", kind: "Desktop app", Icon: WindowsLogo },
  { platform: "macos", name: "macOS", kind: "Desktop app", Icon: AppleLogo },
  { platform: "linux", name: "Linux", kind: "Desktop app", Icon: LinuxLogo },
  { platform: "ios", name: "iPhone", kind: "Phone app", Icon: AppleLogo },
  { platform: "android", name: "Android", kind: "Phone app", Icon: AndroidLogo },
];

const isLive = (r: Release | undefined) => r?.status === "available" && Boolean(r.url);

function details(r: Release) {
  return [
    r.version && `Version ${r.version}`,
    r.sizeBytes && `${Math.round(r.sizeBytes / 1_000_000)} MB`,
    r.minOs && `Needs ${r.minOs}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * One honest row per platform, straight from `GET /v1/releases`: a download button when the app
 * is published, "Coming soon" until then. The browser row is always live.
 */
export function PlatformRows({ releases }: { releases: Release[] }) {
  const byPlatform = new Map(releases.map((r) => [r.platform, r]));
  return (
    <ul className={styles.rows}>
      <li data-reveal className={styles.row}>
        <span className={styles.rowIcon}>
          <Browser size={20} aria-hidden />
        </span>
        <div>
          <b>Web</b>
          <span>Any modern browser, nothing to install</span>
        </div>
        <Link href="/signup" className={cx(styles.tag, styles.tagNow)}>
          Open Realm
        </Link>
      </li>
      {APPS.map(({ platform, name, kind, Icon }) => {
        const release = byPlatform.get(platform);
        const live = isLive(release);
        return (
          <li key={platform} data-reveal className={styles.row}>
            <span className={styles.rowIcon}>
              <Icon size={20} aria-hidden />
            </span>
            <div>
              <b>{name}</b>
              <span>{live && release ? details(release) || kind : kind}</span>
            </div>
            {live && release?.url ? (
              <a href={release.url} className={cx(styles.tag, styles.tagNow)}>
                <DownloadSimple size={15} aria-hidden /> Download
                <span className="sr-only"> for {name}</span>
              </a>
            ) : (
              <em className={styles.tag}>Coming soon</em>
            )}
          </li>
        );
      })}
    </ul>
  );
}
