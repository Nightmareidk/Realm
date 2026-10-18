import { inArray, schema, sql } from "@realm/db";
import type { Deps } from "../deps";
import { AppError } from "./errors";
import { alertOwnerOnce, markOwnerAlertSent, rearmOwnerAlerts } from "./owner-alerts";

const { media } = schema;

/** Cloudflare counts storage in decimal gigabytes. */
const GB = 1_000_000_000;
/** Warnings on the way up, as a share of the limit (9, 9.3 and 9.7 GB of 10). */
const WARN_AT = [90, 93, 97] as const;
const KEYS = [...WARN_AT.map((p) => `storage:${p}`), "storage:full"];

type GuardDeps = Pick<Deps, "db" | "config" | "mailer" | "logger">;

const gb = (bytes: number) => (bytes / GB).toFixed(1);
const limitBytes = (deps: GuardDeps) => deps.config.REALM_STORAGE_LIMIT_GB * GB;

/**
 * Everything kept in storage, by the uploads table: finished files and uploads still arriving
 * (counted early, so a burst of uploads can't slip past the limit together).
 */
export async function storedBytes(deps: Pick<Deps, "db">): Promise<number> {
  const [row] = await deps.db
    .select({ total: sql<string>`coalesce(sum(${media.sizeBytes}), 0)` })
    .from(media)
    .where(inArray(media.status, ["pending", "processing", "ready"]));
  return Number(row?.total ?? 0);
}

/**
 * Before an upload: refuse it if it would take storage past the limit, so storage never costs
 * money by surprise. The owner hears about it the first time.
 */
export async function ensureRoom(deps: GuardDeps, adding: number): Promise<void> {
  if (!deps.config.REALM_STORAGE_LIMIT_GB) return;
  const limit = limitBytes(deps);
  const used = await storedBytes(deps);
  if (used + adding <= limit) return;
  await alertFull(deps, used, limit);
  throw new AppError(
    507,
    "UPLOADS_PAUSED",
    "Photo and video uploads are paused for now while Realm makes room. Posts and messages with words still work.",
  );
}

/**
 * After an upload: email the owner as storage passes 90%, 93% and 97% of the limit, and when it's
 * full. Each warning goes out once; when space frees up below 90%, they can go out again.
 */
export async function noteStorage(deps: GuardDeps): Promise<void> {
  if (!deps.config.REALM_STORAGE_LIMIT_GB) return;
  const limit = limitBytes(deps);
  const used = await storedBytes(deps);
  const share = (used / limit) * 100;
  if (share < WARN_AT[0]) {
    await rearmOwnerAlerts(deps, KEYS);
    return;
  }
  if (share >= 100) {
    await alertFull(deps, used, limit);
    return;
  }
  // The highest warning passed goes out; any lower ones it skipped over are marked as sent too.
  const passed = WARN_AT.filter((p) => share >= p);
  for (const p of [...passed].reverse()) {
    const sent = await alertOwnerOnce(deps, `storage:${p}`, {
      subject: `Realm storage: ${gb(used)} GB of ${gb(limit)} GB used`,
      text: [
        `Realm's photos and videos now take ${gb(used)} GB of the ${gb(limit)} GB limit (${Math.floor(share)}%).`,
        "",
        `Cloudflare R2 is free up to 10 GB. When Realm reaches ${gb(limit)} GB it stops taking new photos and videos, so storage never costs you money by surprise. Posts and messages with words keep working.`,
        "",
        "To make room: delete old test uploads in Cloudflare (R2, bucket realm-media).",
        "To keep going past it: raise REALM_STORAGE_LIMIT_GB in Realm's settings. Past 10 GB, Cloudflare charges about $0.015 per GB a month.",
      ].join("\n"),
    });
    if (sent) {
      for (const lower of passed.filter((q) => q < p)) {
        await markOwnerAlertSent(deps, `storage:${lower}`);
      }
    }
    break;
  }
}

async function alertFull(deps: GuardDeps, used: number, limit: number) {
  // A full store covers every warning before it.
  for (const p of WARN_AT) await markOwnerAlertSent(deps, `storage:${p}`);
  await alertOwnerOnce(deps, "storage:full", {
    subject: "Realm storage is full: photo and video uploads are paused",
    text: [
      `Realm's photos and videos take ${gb(used)} GB, the ${gb(limit)} GB limit, so Realm has paused new photo and video uploads. People see a message saying so; posts and messages with words still work.`,
      "",
      "To make room: delete old uploads in Cloudflare (R2, bucket realm-media).",
      "To keep going: raise REALM_STORAGE_LIMIT_GB in Realm's settings and restart Realm. Past 10 GB, Cloudflare charges about $0.015 per GB a month.",
    ].join("\n"),
  });
}
