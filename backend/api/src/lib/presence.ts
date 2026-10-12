import { isMinor, Limits, type PresenceStatus } from "@realm/contracts";
import type { KeyValueStore } from "@realm/server-core";

/**
 * Who's around. A connected gateway session writes its person's status here and refreshes it
 * with every heartbeat, so a crashed node's people fade to offline within the TTL. Shared by the
 * API (member lists, invite previews, Explore) and the gateway.
 */
export const PRESENCE_TTL_SECONDS = 120;

const key = (userId: string) => `presence:${userId}`;

export async function readPresence(kv: KeyValueStore, userId: string): Promise<PresenceStatus> {
  const value = await kv.get(key(userId));
  return value === "online" || value === "idle" || value === "dnd" ? value : "offline";
}

export async function readPresences(
  kv: KeyValueStore,
  userIds: readonly string[],
): Promise<Map<string, PresenceStatus>> {
  const statuses = await Promise.all(userIds.map((id) => readPresence(kv, id)));
  return new Map(userIds.map((id, i) => [id, statuses[i] ?? "offline"]));
}

export async function writePresence(kv: KeyValueStore, userId: string, status: PresenceStatus) {
  if (status === "offline") await kv.del(key(userId));
  else await kv.set(key(userId), status, PRESENCE_TTL_SECONDS);
}

/**
 * Whether someone's presence may show in a Space: they share it at all, and if they're under 18,
 * only in Spaces small enough to be their own crowd (docs/research/2026-10-phase1-spaces-feed-safety.md
 * §3.4, after Discord's teen defaults).
 */
export function presenceVisibleIn(
  person: { showPresence: boolean; birthDate: string },
  space: { memberCount: number },
): boolean {
  if (!person.showPresence) return false;
  if (isMinor(person.birthDate) && space.memberCount > Limits.teenPresenceSpaceSize) return false;
  return true;
}
