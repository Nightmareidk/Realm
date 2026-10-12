import { createHash } from "node:crypto";
import { Limits } from "@realm/server-core";
import type { Deps } from "../deps";
import { AppError } from "./errors";

const slowDown = (message: string, retryAfter?: number) =>
  new AppError(429, "SLOW_DOWN", message, undefined, retryAfter);

const LINK = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|ru|ly|me|app|link)\b/i;
const NEW_ACCOUNT_MS = 24 * 3600 * 1000;

/**
 * Automated spam checks on every message, so nobody has to read messages to catch spam
 * (owner, 2026-10-04). They aim at reach, not at people chatting: bursts, the same text again
 * and again, and links from brand-new or unverified accounts.
 */
export async function guardMessage(
  deps: Deps,
  author: { id: bigint; createdAt: Date; emailVerifiedAt: Date | null },
  content: string,
) {
  const who = author.id.toString();
  const flood = await deps.limiter.hit(Limits.messageFlood, who);
  if (!flood.allowed) {
    throw slowDown("You're sending fast. Wait a few seconds.", flood.resetSeconds);
  }

  const text = content.trim().toLowerCase().replace(/\s+/g, " ");
  if (text.length >= 6) {
    const digest = createHash("sha1").update(text).digest("base64url");
    const { count } = await deps.kv.incr(`dup:${who}:${digest}`, 120);
    if (count > 3) {
      throw slowDown("You've sent that a few times already. Try saying something new.", 120);
    }
  }

  const fresh = Date.now() - author.createdAt.getTime() < NEW_ACCOUNT_MS || !author.emailVerifiedAt;
  if (fresh && LINK.test(content)) {
    const links = await deps.limiter.hit(Limits.newAccountLinks, who);
    if (!links.allowed) {
      throw slowDown(
        "New accounts can share a few links at a time. Confirm your email or try again soon.",
        links.resetSeconds,
      );
    }
  }
}
