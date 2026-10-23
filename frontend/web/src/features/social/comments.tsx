"use client";

import { ArrowUp, Heart, Trash } from "@phosphor-icons/react";
import type { Comment, CommentPage, Post } from "@realm/contracts";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { ago, useFetch, Verified } from "./shared";

/**
 * A post's comments, oldest first, with a box to add yours. Empty, it says so and asks you to
 * start the conversation. You can delete your own comments, and the post's author anyone's.
 */
export function Comments({ post, onCount }: { post: Post; onCount?: (n: number) => void }) {
  const me = useRealm((s) => s.me);
  const page = useFetch<CommentPage>(`/posts/${post.id}/comments`);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const items = page.data?.items ?? [];

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const made = await api<Comment>(`/posts/${post.id}/comments`, {
        body: { body, ...(replyTo ? { parentId: replyTo.id } : {}) },
      });
      page.setData({ items: [...items, made], nextCursor: page.data?.nextCursor ?? null });
      onCount?.(items.length + 1);
      setText("");
      setReplyTo(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  const like = async (c: Comment) => {
    const on = !c.liked;
    const put = (x: Partial<Comment>) =>
      page.setData((d) =>
        d ? { ...d, items: d.items.map((y) => (y.id === c.id ? { ...y, ...x } : y)) } : d,
      );
    put({ liked: on, likeCount: c.likeCount + (on ? 1 : -1) });
    try {
      put(
        await api<{ likeCount: number; liked: boolean }>(`/posts/${post.id}/comments/${c.id}/like`, {
          method: on ? "PUT" : "DELETE",
        }),
      );
    } catch {
      put({ liked: c.liked, likeCount: c.likeCount });
    }
  };

  const remove = async (c: Comment) => {
    try {
      await api(`/posts/${post.id}/comments/${c.id}`, { method: "DELETE" });
      const left = items.filter((x) => x.id !== c.id);
      page.setData({ items: left, nextCursor: page.data?.nextCursor ?? null });
      onCount?.(left.length);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not deleted. Try again.");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {page.loading && !page.data ? (
          <p role="status" className="text-fg-soft">
            Loading comments…
          </p>
        ) : items.length === 0 ? (
          <div className="grid h-full place-items-center py-10 text-center">
            <div>
              <p className="font-display text-[1.3rem] font-extrabold text-fg">No comments yet</p>
              <p className="mt-1 text-fg-soft">Start the conversation.</p>
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((c) => (
              <li
                key={c.id}
                className="flex gap-3"
                style={{ marginLeft: Math.min(c.depth, 3) * 28 }}
              >
                <Link href={`/u/${c.author.username}`} className="shrink-0">
                  <Avatar user={c.author} size={34} />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.95rem] leading-snug text-fg">
                    <Link
                      href={`/u/${c.author.username}`}
                      className="inline-flex items-center gap-1 font-bold"
                    >
                      {c.author.username}
                      <Verified kind={c.author.verified} size={13} />
                    </Link>{" "}
                    {c.hidden ? <em className="text-fg-soft">Hidden after reports</em> : c.body}
                  </p>
                  <p className="mt-1 flex gap-3 text-[0.8rem] font-bold text-fg-soft">
                    <span>{ago(c.createdAt)}</span>
                    <button type="button" onClick={() => setReplyTo(c)} className="hover:text-fg">
                      Reply
                    </button>
                    {c.likeCount > 0 && (
                      <span>
                        {c.likeCount} {c.likeCount === 1 ? "like" : "likes"}
                      </span>
                    )}
                    {(c.author.id === me?.id || post.author.id === me?.id) && (
                      <button
                        type="button"
                        onClick={() => void remove(c)}
                        className="inline-flex items-center gap-1 hover:text-danger"
                      >
                        <Trash aria-hidden="true" size={13} />
                        Delete
                      </button>
                    )}
                  </p>
                </div>
                {!c.hidden && (
                  <button
                    type="button"
                    aria-pressed={c.liked}
                    onClick={() => void like(c)}
                    className={cx(
                      "mt-1 grid size-7 shrink-0 place-items-center rounded-full transition-transform active:scale-90",
                      c.liked ? "text-[#ff6b8b]" : "text-fg-soft hover:text-fg",
                    )}
                  >
                    <Heart aria-hidden="true" size={15} weight={c.liked ? "fill" : "regular"} />
                    <span className="sr-only">{c.liked ? "Unlike the comment" : "Like the comment"}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={send} className="border-t border-line px-3 py-3">
        {replyTo && (
          <p className="mb-2 flex items-center justify-between px-1 text-[0.85rem] text-fg-soft">
            Replying to @{replyTo.author.username}
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="font-bold hover:text-fg"
            >
              Cancel
            </button>
          </p>
        )}
        {error && (
          <p role="alert" className="mb-2 px-1 text-[0.88rem] text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2 rounded-full bg-surface-raised py-1 pr-1 pl-4">
          <label htmlFor={`c-${post.id}`} className="sr-only">
            Add a comment
          </label>
          <input
            id={`c-${post.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2200}
            placeholder={replyTo ? `Reply to ${replyTo.author.displayName}…` : "Add a comment…"}
            className="h-10 min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-muted"
          />
          <button
            type="submit"
            aria-disabled={!text.trim() || sending || undefined}
            className="grid size-9 place-items-center rounded-full bg-accent text-on-accent aria-disabled:opacity-40"
          >
            <ArrowUp aria-hidden="true" size={17} weight="bold" />
            <span className="sr-only">Post the comment</span>
          </button>
        </div>
      </form>
    </div>
  );
}
