import type { Post, PostPage } from "@realm/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { live } from "./live";
import { ApiError, api } from "./server";

/** Loads one thing from the API, with a way to load it again. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, setData, error, loading, reload: load };
}

/** A list of posts that pages as you scroll, refreshes on pull, and takes updated posts. */
export function usePosts(path: string | null) {
  const [items, setItems] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const fetchPage = useCallback(
    async (before: string | null) => {
      if (!path) return null;
      const join = path.includes("?") ? "&" : "?";
      return api<PostPage>(`${path}${before ? `${join}before=${before}` : ""}`);
    },
    [path],
  );

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const page = await fetchPage(null);
      if (page) {
        setItems(page.items);
        setCursor(page.nextCursor);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      busy.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchPage]);

  const more = useCallback(async () => {
    if (busy.current || !cursor) return;
    busy.current = true;
    try {
      const page = await fetchPage(cursor);
      if (page) {
        setItems((now) => [...now, ...page.items.filter((p) => !now.some((n) => n.id === p.id))]);
        setCursor(page.nextCursor);
      }
    } catch {
      // Scrolling again retries.
    } finally {
      busy.current = false;
    }
  }, [cursor, fetchPage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => onPostsChanged(refresh), [refresh]);

  // Likes and comments on posts you're looking at, as they happen.
  useEffect(
    () =>
      live.on((type, data) => {
        if (type !== "POST_COUNTS") return;
        const d = data as { id: string; likeCount: number; commentCount: number };
        setItems((now) =>
          now.some((p) => p.id === d.id)
            ? now.map((p) =>
                p.id === d.id ? { ...p, likeCount: d.likeCount, commentCount: d.commentCount } : p,
              )
            : now,
        );
      }),
    [],
  );

  const update = useCallback((post: Post) => {
    setItems((now) => now.map((p) => (p.id === post.id ? post : p)));
  }, []);
  const remove = useCallback((id: string) => {
    setItems((now) => now.filter((p) => p.id !== id));
  }, []);

  return { items, loading, refreshing, error, refresh, more, update, remove };
}

/* After posting or deleting, every list on screen loads again. */
const listeners = new Set<() => void>();
export function postsChanged() {
  for (const l of listeners) l();
}
function onPostsChanged(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
