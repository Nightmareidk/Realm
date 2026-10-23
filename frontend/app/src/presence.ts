import type { Presence } from "@realm/contracts";
import type { ReadyPayload } from "@realm/contracts/gateway";
import { useSyncExternalStore } from "react";
import { live } from "./live";

/**
 * Who's around: the people in your conversations and Spaces who show it ("Active now" in a chat).
 * Filled when the live connection signs in, then kept fresh; anyone who hides it stays unseen.
 */
let around = new Map<string, Presence["status"]>();
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

live.on((type, data) => {
  if (type === "READY") {
    around = new Map((data as ReadyPayload).presences.map((p) => [p.userId, p.status]));
    emit();
  }
  if (type === "PRESENCE_UPDATE") {
    const p = data as Presence;
    around = new Map(around);
    if (p.status === "offline") around.delete(p.userId);
    else around.set(p.userId, p.status);
    emit();
  }
});
live.onStatus((s) => {
  if (s === "off" && around.size) {
    around = new Map();
    emit();
  }
});

/** Someone's status: "online", "idle", "dnd", or null when they're away or hide it. */
export function usePresence(userId: string | undefined) {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => (userId ? (around.get(userId) ?? null) : null),
  );
}
