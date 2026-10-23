"use client";

import type { Activity, ActivityPage, FollowState } from "@realm/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/features/spaces/person";
import { api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { ago, useFetch, Verified } from "./shared";

const SAYS: Record<Activity["type"], string> = {
  follow: "started following you.",
  follow_request: "asked to follow you.",
  post_like: "liked your post.",
  post_comment: "commented:",
  comment_reply: "replied to your comment:",
};

/** When something happened, grouped the way people think about it. */
function bucket(iso: string) {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return "Today";
  if (days < 7) return "This week";
  if (days < 30) return "This month";
  return "Earlier";
}

/**
 * Activity: who followed you, liked or commented, newest first and grouped by when, with Follow
 * back right on the row and the post's picture beside it. Opening it marks everything read.
 */
export function ActivityView() {
  const page = useFetch<ActivityPage>("/users/@me/activity");
  const [states, setStates] = useState<Record<string, FollowState>>({});
  useEffect(() => {
    if (page.data?.unread) void api("/users/@me/activity/read", { body: {} }).catch(() => {});
  }, [page.data?.unread]);

  const items = page.data?.items ?? [];
  const groups: [string, Activity[]][] = [];
  for (const a of items) {
    const b = bucket(a.createdAt);
    const g = groups.find(([k]) => k === b);
    if (g) g[1].push(a);
    else groups.push([b, [a]]);
  }

  const follow = async (a: Activity) => {
    if (!a.actor) return;
    try {
      const r = await api<{ follow: FollowState }>(`/users/${a.actor.username}/follow`, {
        method: "PUT",
      });
      setStates((s) => ({ ...s, [a.id]: r.follow }));
    } catch {}
  };
  const answer = async (a: Activity, yes: boolean) => {
    if (!a.actor) return;
    try {
      await api(`/users/@me/follow-requests/${a.actor.username}`, {
        method: yes ? "POST" : "DELETE",
      });
      setStates((s) => ({ ...s, [a.id]: yes ? "following" : "none" }));
    } catch {}
  };

  return (
    <div className="mx-auto w-full max-w-[40rem] px-6 pb-12 max-md:px-3">
      <h1 className="pt-2 pb-5 font-display text-[2rem] font-extrabold tracking-[-0.02em] text-fg">
        Activity
      </h1>
      {page.loading && !page.data ? (
        <p role="status" className="text-fg-soft">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-[22px] bg-fg/[0.04] px-6 py-12 text-center">
          <p className="font-display text-[1.3rem] font-extrabold text-fg">Nothing yet</p>
          <p className="mt-1 text-fg-soft">
            When people follow you, like or comment, it shows up here.
          </p>
        </div>
      ) : (
        groups.map(([label, list]) => (
          <section key={label} aria-label={label} className="mb-6">
            <h2 className="mb-2 font-display text-[1.05rem] font-bold text-fg">{label}</h2>
            <ul>
              {list.map((a) => {
                const state = states[a.id] ?? a.youFollow;
                const said =
                  a.type === "follow" && a.accepted
                    ? "accepted your follow request."
                    : SAYS[a.type];
                return (
                  <li
                    key={a.id}
                    className={cx(
                      "flex items-center gap-3 rounded-2xl px-2 py-2.5",
                      !a.read && "bg-accent/[0.07]",
                    )}
                  >
                    {a.actor ? (
                      <Link href={`/u/${a.actor.username}`} className="shrink-0">
                        <Avatar user={a.actor} size={46} />
                      </Link>
                    ) : (
                      <span className="size-[46px] shrink-0 rounded-full bg-surface-raised" />
                    )}
                    <p className="min-w-0 flex-1 text-[0.95rem] leading-snug text-fg">
                      {a.actor && (
                        <Link
                          href={`/u/${a.actor.username}`}
                          className="inline-flex items-center gap-1 font-bold"
                        >
                          {a.actor.username}
                          <Verified kind={a.actor.verified} size={13} />
                        </Link>
                      )}{" "}
                      {said}
                      {a.text ? <span className="text-fg-soft"> {a.text}</span> : null}{" "}
                      <span className="text-[0.85rem] text-fg-soft">{ago(a.createdAt)}</span>
                    </p>
                    {a.type === "follow_request" && state === "none" && !states[a.id] ? (
                      <span className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => void answer(a, true)}
                          className="h-9 rounded-full bg-accent px-4 text-[0.88rem] font-bold text-on-accent"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => void answer(a, false)}
                          className="h-9 rounded-full bg-fg/10 px-4 text-[0.88rem] font-bold text-fg"
                        >
                          Delete
                        </button>
                      </span>
                    ) : a.post?.thumbUrl ? (
                      // biome-ignore lint/performance/noImgElement: the post's own thumbnail.
                      <img
                        src={a.post.thumbUrl}
                        alt=""
                        className="size-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (a.type === "follow" || a.type === "follow_request") && a.actor ? (
                      <button
                        type="button"
                        disabled={state !== "none"}
                        onClick={() => void follow(a)}
                        className={cx(
                          "h-9 shrink-0 rounded-full px-4 text-[0.88rem] font-bold",
                          state === "none" ? "bg-accent text-on-accent" : "bg-fg/10 text-fg",
                        )}
                      >
                        {state === "following"
                          ? "Following"
                          : state === "requested"
                            ? "Requested"
                            : "Follow back"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
