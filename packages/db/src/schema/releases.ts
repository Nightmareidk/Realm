import { bigint, pgEnum, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { tstz } from "./_columns";

export const releasePlatform = pgEnum("release_platform", [
  "windows",
  "macos",
  "linux",
  "android",
  "ios",
]);
export const releaseStatus = pgEnum("release_status", ["coming_soon", "available"]);
export const releaseChannel = pgEnum("release_channel", ["stable", "beta"]);

/** Drives the download portal and (later) desktop auto-update. */
export const releases = pgTable(
  "releases",
  {
    platform: releasePlatform().notNull(),
    channel: releaseChannel().notNull().default("stable"),
    status: releaseStatus().notNull().default("coming_soon"),
    version: text(),
    url: text(),
    sha256: text(),
    sizeBytes: bigint({ mode: "number" }),
    minOs: text(),
    publishedAt: tstz(),
  },
  (t) => [primaryKey({ columns: [t.platform, t.channel] })],
);
