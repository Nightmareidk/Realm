"use client";

import { MagnifyingGlass, SpeakerHigh, Star, X } from "@phosphor-icons/react";
import type { SearchResults, UserSummary } from "@realm/contracts";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/features/spaces/person";
import { ApiError, api } from "@/lib/api";

const section = "border-t border-line pt-8 pb-2";
const heading = "font-display text-[1.35rem] font-extrabold tracking-[-0.025em] text-fg";

type Muted = { user: UserSummary; posts: boolean; stories: boolean };

/**
 * Close Friends (who sees Stories and Notes shared to them, with a green ring) and the people
 * you've muted (their posts or Stories stay out of your feed; they're never told).
 */
export function CirclePanel() {
  const [close, setClose] = useState<UserSummary[] | null>(null);
  const [muted, setMuted] = useState<Muted[] | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<UserSummary[]>([]);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([
      api<{ items: UserSummary[] }>("/users/@me/close-friends").catch(() => ({ items: [] })),
      api<{ items: Muted[] }>("/users/@me/muted").catch(() => ({ items: [] })),
    ]);
    setClose(c.items);
    setMuted(m.items);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (!q) return setFound([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<SearchResults>(`/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => setFound(r.users.slice(0, 6)))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const setFriend = async (u: UserSummary, on: boolean) => {
    try {
      await api(`/users/@me/close-friends/${u.username}`, { method: on ? "PUT" : "DELETE" });
      setNote("");
      if (on) setQuery("");
      void load();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  };
  const unmute = async (m: Muted) => {
    try {
      await api(`/users/${m.user.username}/mute`, {
        method: "PUT",
        body: { posts: false, stories: false },
      });
      void load();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  };

  return (
    <>
      <section aria-labelledby="close-friends" className={section}>
        <h2 id="close-friends" className={`${heading} flex items-center gap-2`}>
          <Star aria-hidden="true" size={22} weight="fill" className="text-[#22c55e]" />
          Close Friends
        </h2>
        <p className="mt-2 text-fg-soft">
          Share a Story or a Note to Close Friends and only these people see it. Nobody is told when
          you add or remove them.
        </p>
        <div className="relative mt-4">
          <MagnifyingGlass
            aria-hidden="true"
            size={17}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-soft"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add someone"
            aria-label="Search people to add to Close Friends"
            className="h-11 w-full rounded-full bg-surface-raised pr-3 pl-10 text-fg outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        {found.length > 0 && (
          <ul className="mt-2 rounded-2xl bg-surface-raised p-1.5">
            {found.map((u) => {
              const on = close?.some((c) => c.id === u.id) ?? false;
              return (
                <li key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                  <Avatar user={u} size={36} />
                  <span className="min-w-0 flex-1 truncate font-bold text-fg">{u.username}</span>
                  <button
                    type="button"
                    onClick={() => void setFriend(u, !on)}
                    className={
                      on
                        ? "h-8 rounded-full bg-fg/10 px-3.5 text-[0.85rem] font-bold text-fg"
                        : "h-8 rounded-full bg-[#22c55e] px-3.5 text-[0.85rem] font-bold text-[#04150a]"
                    }
                  >
                    {on ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {note && <p className="mt-2 text-[0.9rem] text-danger">{note}</p>}
        {close === null ? (
          <p className="mt-4 text-fg-soft">Loading…</p>
        ) : close.length === 0 ? (
          <p className="mt-4 text-fg-soft">Nobody yet.</p>
        ) : (
          <ul className="mt-4 space-y-1">
            {close.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <Link href={`/u/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar user={u} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-fg">{u.displayName}</span>
                    <span className="block truncate text-[0.85rem] text-fg-soft">
                      @{u.username}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void setFriend(u, false)}
                  className="grid size-9 place-items-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
                >
                  <X aria-hidden="true" size={17} />
                  <span className="sr-only">Remove {u.displayName} from Close Friends</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="muted-accounts" className={section}>
        <h2 id="muted-accounts" className={heading}>
          Muted accounts
        </h2>
        <p className="mt-2 text-fg-soft">
          You still follow them; their posts or Stories just stay out of your feed. Mute someone
          from the ⋯ on their profile.
        </p>
        {muted === null ? null : muted.length === 0 ? (
          <p className="mt-4 text-fg-soft">You haven't muted anyone.</p>
        ) : (
          <ul className="mt-4 space-y-1">
            {muted.map((m) => (
              <li key={m.user.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <Avatar user={m.user} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-fg">{m.user.displayName}</span>
                  <span className="block text-[0.85rem] text-fg-soft">
                    {m.posts && m.stories ? "Posts and Stories" : m.posts ? "Posts" : "Stories"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void unmute(m)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-fg/10 px-3.5 text-[0.88rem] font-bold text-fg hover:bg-fg/15"
                >
                  <SpeakerHigh aria-hidden="true" size={16} />
                  Unmute
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
