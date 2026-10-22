import type { StoryFeed, StoryRing } from "@realm/contracts";
import { useSyncExternalStore } from "react";
import { api } from "../server";

/**
 * The Stories row on Home and the Story viewer share one list, so watching a Story clears its
 * ring straight away and deleting one takes it out everywhere.
 */

let rings: StoryRing[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

function set(next: StoryRing[]) {
  rings = next;
  emit();
}

/** Load (or reload) the Stories of you and the people you follow. Failures keep what's shown. */
export function loadStories(): Promise<void> {
  if (loading) return loading;
  loading = api<StoryFeed>("/stories/feed")
    .then((f) => set(f.rings))
    .catch(() => {
      if (rings === null) set([]);
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function useStories() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => rings,
  );
}

/** You watched it: tell the server (once) and clear it here. */
export function markSeen(storyId: string) {
  if (!rings) return;
  let changed = false;
  const next = rings.map((r) => {
    if (!r.stories.some((st) => st.id === storyId && !st.seen)) return r;
    changed = true;
    const stories = r.stories.map((st) => (st.id === storyId ? { ...st, seen: true } : st));
    return { ...r, stories, unseen: stories.some((st) => !st.seen) };
  });
  if (!changed) return;
  set(next);
  api(`/stories/${storyId}/view`, { method: "POST" }).catch(() => {
    // Not counted this time; the ring is still cleared on this phone.
  });
}

/** Take a Story out after its author deletes it. */
export function dropStory(storyId: string) {
  if (!rings) return;
  set(
    rings
      .map((r) => ({ ...r, stories: r.stories.filter((st) => st.id !== storyId) }))
      .filter((r) => r.stories.length > 0),
  );
}
