"use client";

import { ChatCircle, UserMinus, UserPlus } from "@phosphor-icons/react";
import type { Relationship } from "@realm/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { openConversation } from "@/features/realtime/actions";
import { useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { useFetch, Verified } from "./shared";

const pillish = "h-9 shrink-0 rounded-full px-4 text-[0.88rem] font-bold";

/**
 * Friends (as chat apps keep them): add someone by their username, answer requests, and your
 * friends with who's around now first. Friends can message each other straight away.
 */
export function FriendsView() {
  const router = useRouter();
  const list = useFetch<{ items: Relationship[] }>("/users/@me/relationships");
  const presence = useRealm((s) => s.presence);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Requests and new friends turn up without a reload.
  const reload = list.reload;
  useEffect(() => {
    const t = setInterval(() => void reload(), 30_000);
    return () => clearInterval(t);
  }, [reload]);

  const items = list.data?.items ?? [];
  const incoming = items.filter((r) => r.type === "pending_incoming");
  const outgoing = items.filter((r) => r.type === "pending_outgoing");
  const friends = items
    .filter((r) => r.type === "friend")
    .sort(
      (a, b) => Number(presence[b.user.id] === "online") - Number(presence[a.user.id] === "online"),
    );

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const who = name.trim().replace(/^@/, "").toLowerCase();
    if (!who) return;
    setBusy(true);
    setNote("");
    try {
      const r = await api<{ type: Relationship["type"] }>(
        `/users/@me/relationships/${encodeURIComponent(who)}`,
        {
          method: "PUT",
        },
      );
      setNote(
        r.type === "friend" ? `You and @${who} are friends now.` : `Request sent to @${who}.`,
      );
      setName("");
      void list.reload();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const answer = async (r: Relationship, yes: boolean) => {
    try {
      await api(`/users/@me/relationships/${r.user.username}`, { method: yes ? "PUT" : "DELETE" });
      void list.reload();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  };
  const message = async (r: Relationship) => {
    try {
      const dm = await openConversation([r.user.id]);
      router.push(`/messages/${dm.id}`);
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Can't message them right now.");
    }
  };

  const row = (r: Relationship, line: string, actions: React.ReactNode) => (
    <li
      key={r.user.id}
      className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-fg/[0.04]"
    >
      <Link href={`/u/${r.user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar user={r.user} size={48} presence={presence[r.user.id]} />
        <span className="min-w-0">
          <span className="flex items-center gap-1 font-bold text-fg">
            <span className="truncate">{r.user.displayName}</span>
            <Verified kind={r.user.verified} size={14} />
          </span>
          <span
            className={cx(
              "block truncate text-[0.88rem]",
              line === "Active now" ? "text-presence" : "text-fg-soft",
            )}
          >
            {line}
          </span>
        </span>
      </Link>
      <span className="flex shrink-0 gap-1.5">{actions}</span>
    </li>
  );

  return (
    <div className="mx-auto w-full max-w-[40rem] px-6 pb-12 max-md:px-3">
      <div className="flex items-center justify-between pt-2 pb-5">
        <h1 className="font-display text-[2rem] font-extrabold tracking-[-0.02em] text-fg">
          Friends
        </h1>
        <Link href="/messages" className="text-[0.9rem] font-bold text-fg-soft hover:text-fg">
          Messages
        </Link>
      </div>
      <form
        onSubmit={add}
        className="flex items-center gap-2 rounded-full bg-surface-raised py-1 pr-1 pl-4"
      >
        <UserPlus aria-hidden="true" size={19} className="text-fg-soft" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a friend by their username"
          aria-label="Friend's username"
          autoCapitalize="none"
          className="h-10 min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-muted"
        />
        <button
          type="submit"
          aria-disabled={busy || undefined}
          className={cx(pillish, "bg-accent text-on-accent")}
        >
          {busy ? "Adding" : "Add"}
        </button>
      </form>
      <p role="status" className="px-2 pt-2 text-[0.9rem] text-fg-soft empty:hidden">
        {note}
      </p>

      {incoming.length > 0 && (
        <section className="mt-6" aria-label="Friend requests">
          <h2 className="mb-1 px-2 text-[0.8rem] font-bold tracking-wider text-fg-soft uppercase">
            Asked to be your friend · {incoming.length}
          </h2>
          <ul>
            {incoming.map((r) =>
              row(
                r,
                `@${r.user.username} · wants to be friends`,
                <>
                  <button
                    type="button"
                    onClick={() => void answer(r, true)}
                    className={cx(pillish, "bg-accent text-on-accent")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void answer(r, false)}
                    className={cx(pillish, "bg-fg/10 text-fg")}
                  >
                    Decline
                  </button>
                </>,
              ),
            )}
          </ul>
        </section>
      )}
      {outgoing.length > 0 && (
        <section className="mt-6" aria-label="Waiting on them">
          <h2 className="mb-1 px-2 text-[0.8rem] font-bold tracking-wider text-fg-soft uppercase">
            Waiting on them · {outgoing.length}
          </h2>
          <ul>
            {outgoing.map((r) =>
              row(
                r,
                `@${r.user.username} · request sent`,
                <button
                  type="button"
                  onClick={() => void answer(r, false)}
                  className={cx(pillish, "bg-fg/10 text-fg")}
                >
                  Cancel
                </button>,
              ),
            )}
          </ul>
        </section>
      )}
      <section className="mt-6" aria-label="Your friends">
        <h2 className="mb-1 px-2 text-[0.8rem] font-bold tracking-wider text-fg-soft uppercase">
          Friends · {friends.length}
        </h2>
        {list.loading && !list.data ? (
          <p role="status" className="px-2 text-fg-soft">
            Loading…
          </p>
        ) : friends.length === 0 ? (
          <p className="px-2 py-4 text-fg-soft">
            No friends here yet. Add someone by their username, or accept a request.
          </p>
        ) : (
          <ul>
            {friends.map((r) => {
              const status = presence[r.user.id];
              const line =
                status === "online"
                  ? "Active now"
                  : status === "idle"
                    ? "Away"
                    : status === "dnd"
                      ? "Busy"
                      : `@${r.user.username}`;
              return row(
                r,
                line,
                <>
                  <button
                    type="button"
                    onClick={() => void message(r)}
                    className="grid size-9 place-items-center rounded-full bg-fg/10 text-fg hover:bg-fg/15"
                  >
                    <ChatCircle aria-hidden="true" size={18} />
                    <span className="sr-only">Message {r.user.displayName}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Remove ${r.user.displayName} as a friend? You can still follow each other.`,
                        )
                      ) {
                        void answer(r, false);
                      }
                    }}
                    className="grid size-9 place-items-center rounded-full text-fg-soft hover:bg-fg/10 hover:text-danger"
                  >
                    <UserMinus aria-hidden="true" size={18} />
                    <span className="sr-only">Remove {r.user.displayName}</span>
                  </button>
                </>,
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
