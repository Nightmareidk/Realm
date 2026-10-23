"use client";

import {
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  ChatCircle,
  DotsThree,
  Flag,
  Heart,
  Link as LinkIcon,
  PaperPlaneTilt,
  PencilSimple,
  PushPin,
  Trash,
} from "@phosphor-icons/react";
import type { Post } from "@realm/contracts";
import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { Popover, row } from "@/features/app/menus";
import { openReport, useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { SendSheet } from "./send-sheet";
import { ago, compact, SongChip, Verified } from "./shared";

/** Where a post lives on the website (what Send and Copy link share). */
export const postLink = (id: string) =>
  `${typeof location === "undefined" ? "https://tomyrealm.com" : location.origin}/p/${id}`;

/** Like or save, shown at once and put back if the server says no. */
export async function toggle(post: Post, what: "like" | "save", onChange: (p: Post) => void) {
  const on = what === "like" ? !post.liked : !post.saved;
  const next =
    what === "like"
      ? { ...post, liked: on, likeCount: post.likeCount + (on ? 1 : -1) }
      : { ...post, saved: on };
  onChange(next);
  try {
    await api(`/posts/${post.id}/${what}`, { method: on ? "PUT" : "DELETE" });
  } catch {
    onChange(post);
  }
}

/** A post's pictures (or its Clip), with arrows and dots between photos. */
export function PostMedia({
  post,
  rounded = "rounded-[28px]",
  fit = "cover",
  className,
}: {
  post: Post;
  rounded?: string;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const [at, setAt] = useState(0);
  const m = post.media[at];
  if (!m) return null;
  const many = post.media.length > 1;
  const step = (by: number) => (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setAt((a) => Math.min(post.media.length - 1, Math.max(0, a + by)));
  };
  return (
    <div className={cx("relative overflow-hidden bg-surface-sunken", rounded, className)}>
      {m.kind === "video" ? (
        <video
          src={m.url}
          className={cx("size-full", fit === "cover" ? "object-cover" : "object-contain")}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        // biome-ignore lint/performance/noImgElement: people's photos, behind an access check.
        <img
          key={m.id}
          src={m.url}
          alt={
            post.caption
              ? `Photo: ${post.caption.slice(0, 100)}`
              : `Photo by ${post.author.displayName}`
          }
          className={cx("size-full", fit === "cover" ? "object-cover" : "object-contain")}
          loading="lazy"
          decoding="async"
        />
      )}
      {many && (
        <>
          {at > 0 && (
            <button
              type="button"
              onClick={step(-1)}
              className="absolute top-1/2 left-3 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-fg/85 text-base"
            >
              <CaretLeft aria-hidden="true" size={16} weight="bold" />
              <span className="sr-only">Previous photo</span>
            </button>
          )}
          {at < post.media.length - 1 && (
            <button
              type="button"
              onClick={step(1)}
              className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-fg/85 text-base"
            >
              <CaretRight aria-hidden="true" size={16} weight="bold" />
              <span className="sr-only">Next photo</span>
            </button>
          )}
          {/* Dots, the way photo sets show where you are. */}
          <span
            className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5"
            aria-hidden="true"
          >
            {post.media.map((x, i) => (
              <span
                key={x.id}
                className={cx(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === at ? "w-4 bg-fg" : "w-1.5 bg-fg/50",
                )}
              />
            ))}
          </span>
          <span className="sr-only" aria-live="polite">
            Photo {at + 1} of {post.media.length}
          </span>
        </>
      )}
    </div>
  );
}

/** A long caption shows two lines and "more" (Instagram's way), all of it once opened. */
function Caption({ post }: { post: Post }) {
  const [open, setOpen] = useState(false);
  if (!post.caption) return null;
  const long = post.caption.length > 140 || post.caption.split("\n").length > 2;
  return (
    <div className="px-1.5 pt-1 text-[0.92rem] text-fg-soft">
      <p className={cx("whitespace-pre-line", !open && long && "line-clamp-2")}>
        <Link href={`/u/${post.author.username}`} className="font-bold text-fg">
          {post.author.username}
        </Link>{" "}
        {post.caption}
      </p>
      {long && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-bold text-fg-soft hover:text-fg"
        >
          more
        </button>
      )}
    </div>
  );
}

/** Change a post's caption (the post shows "Edited" afterwards). */
function EditCaption({ post, onDone }: { post: Post; onDone: (p: Post | null) => void }) {
  const [text, setText] = useState(post.caption ?? "");
  const [error, setError] = useState("");
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      onDone(
        await api<Post>(`/posts/${post.id}`, {
          method: "PATCH",
          body: { caption: text.trim() || null },
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not saved. Try again.");
    }
  };
  return (
    <form onSubmit={save} className="px-1.5 pt-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2200}
        rows={3}
        aria-label="Caption"
        className="w-full resize-none rounded-input border-[1.5px] border-line-strong bg-base/70 px-3 py-2 text-fg outline-none focus-visible:border-accent"
      />
      {error && <p className="text-[0.88rem] text-danger">{error}</p>}
      <div className="mt-1.5 flex gap-2">
        <button
          type="submit"
          className="h-9 rounded-full bg-accent px-4 text-[0.88rem] font-bold text-on-accent"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => onDone(null)}
          className="h-9 rounded-full px-4 text-[0.88rem] font-bold text-fg-soft hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * A post in Look B: the photo lights the room around it, the song sits on the photo; double-click
 * to like (a heart blooms), then likes, comments, Send, save, and the caption.
 */
export function PostCard({
  post,
  onChange,
  onOpen,
  onRemoved,
}: {
  post: Post;
  onChange: (p: Post) => void;
  /** Opens the post with its comments. */
  onOpen: () => void;
  onRemoved?: () => void;
}) {
  const me = useRealm((s) => s.me?.id);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [burst, setBurst] = useState(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = post.media[0];
  const glow = first && first.kind === "image" ? first.url : null;
  const mine = post.author.id === me;

  const say = (text: string) => {
    setNote(text);
    setTimeout(() => setNote(""), 2400);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(postLink(post.id));
      say("Link copied");
    } catch {
      say(postLink(post.id));
    }
  };
  const remove = async () => {
    if (!confirm("Delete this post? This can't be undone.")) return;
    try {
      await api(`/posts/${post.id}`, { method: "DELETE" });
      onRemoved?.();
    } catch (err) {
      say(err instanceof ApiError ? err.message : "Not deleted. Try again.");
    }
  };
  const pin = async () => {
    try {
      onChange(
        await api<Post>(`/posts/${post.id}/pin`, { method: post.pinned ? "DELETE" : "PUT" }),
      );
      say(post.pinned ? "Unpinned from your profile" : "Pinned to your profile");
    } catch (err) {
      say(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  };
  // One click opens the post; two quick ones like it, with a heart.
  const onMediaClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setBurst((b) => b + 1);
      if (!post.liked) void toggle(post, "like", onChange);
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onOpen();
    }, 260);
  };

  return (
    <article
      className="relative isolate mb-[26px]"
      aria-label={`Post by ${post.author.displayName}`}
    >
      {glow && (
        <span
          aria-hidden="true"
          className="r-soft top-[8%] -left-[12%] -z-10 h-[80%] w-[124%] opacity-60 [mask-image:radial-gradient(closest-side,black_35%,transparent)]"
        >
          {/* biome-ignore lint/performance/noImgElement: a decorative blur of the post's own photo. */}
          <img src={glow} alt="" loading="lazy" decoding="async" />
        </span>
      )}
      <header className="flex items-center gap-2.5 px-1 pt-1 pb-2.5">
        <Link href={`/u/${post.author.username}`} className="shrink-0">
          <Avatar user={post.author} size={38} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/u/${post.author.username}`}
            className="flex items-center gap-1 font-bold text-fg hover:underline"
          >
            <span className="truncate">{post.author.displayName}</span>
            <Verified kind={post.author.verified} size={14} />
          </Link>
          <p className="truncate text-[0.82rem] text-fg-soft">
            {post.space ? `${post.space.name} · ` : ""}
            {ago(post.createdAt)}
            {post.editedAt ? " · Edited" : ""}
            {post.pinned ? " · Pinned" : ""}
          </p>
        </div>
        <Popover
          label="Post options"
          buttonClass="grid size-9 place-items-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg aria-expanded:bg-fg/8"
          panelClass="w-[15rem]"
          button={<DotsThree aria-hidden="true" size={22} weight="bold" />}
        >
          {(close) => (
            <div>
              {mine && (
                <>
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      close();
                      void pin();
                    }}
                  >
                    <PushPin aria-hidden="true" size={19} />
                    {post.pinned ? "Unpin from profile" : "Pin to your profile"}
                  </button>
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      close();
                      setEditing(true);
                    }}
                  >
                    <PencilSimple aria-hidden="true" size={19} />
                    Edit caption
                  </button>
                </>
              )}
              <button
                type="button"
                className={row}
                onClick={() => {
                  close();
                  void copy();
                }}
              >
                <LinkIcon aria-hidden="true" size={19} />
                Copy link
              </button>
              <Link href={`/p/${post.id}`} className={row} onClick={close}>
                <ChatCircle aria-hidden="true" size={19} />
                Go to post
              </Link>
              {mine ? (
                <button
                  type="button"
                  className={cx(row, "text-danger")}
                  onClick={() => {
                    close();
                    void remove();
                  }}
                >
                  <Trash aria-hidden="true" size={19} />
                  Delete
                </button>
              ) : (
                <button
                  type="button"
                  className={cx(row, "text-danger")}
                  onClick={() => {
                    close();
                    openReport({
                      targetType: "post",
                      targetId: post.id,
                      label: `${post.author.displayName}'s post`,
                      blockUserId: post.author.id,
                    });
                  }}
                >
                  <Flag aria-hidden="true" size={19} />
                  Report
                </button>
              )}
            </div>
          )}
        </Popover>
      </header>

      <div className="relative">
        {/* Click opens, double-click likes; keyboard users have the button below. */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the photo also has a real button for keyboards. */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: the sr-only button below does the same. */}
        <div onClick={onMediaClick} className="cursor-pointer">
          <PostMedia post={post} className="aspect-[4/5] max-h-[600px] w-full" />
        </div>
        <button type="button" onClick={onOpen} className="sr-only focus:not-sr-only">
          Open the post
        </button>
        {burst > 0 && (
          <span
            key={burst}
            aria-hidden="true"
            className="r-burst pointer-events-none absolute inset-0 grid place-items-center text-[#ff6b8b]"
            onAnimationEnd={() => setBurst(0)}
          >
            <Heart size={110} weight="fill" />
          </span>
        )}
        {post.sound && (
          <SongChip
            sound={post.sound}
            playKey={`post:${post.id}`}
            from={`${post.author.displayName}'s post`}
            className="absolute bottom-3 left-3"
          />
        )}
      </div>

      <div className="flex items-center gap-[18px] px-1.5 pt-3 pb-1 text-fg">
        <button
          type="button"
          aria-pressed={post.liked}
          onClick={() => void toggle(post, "like", onChange)}
          className="flex items-center gap-1.5 font-bold transition-transform duration-150 active:scale-90"
        >
          <Heart
            aria-hidden="true"
            size={26}
            weight={post.liked ? "fill" : "regular"}
            className={post.liked ? "text-[#ff6b8b]" : undefined}
          />
          <span className="text-[0.88rem] tabular-nums">{compact(post.likeCount)}</span>
          <span className="sr-only">{post.liked ? "Liked" : "Like"}</span>
        </button>
        <button type="button" onClick={onOpen} className="flex items-center gap-1.5 font-bold">
          <ChatCircle aria-hidden="true" size={26} />
          <span className="text-[0.88rem] tabular-nums">{compact(post.commentCount)}</span>
          <span className="sr-only">Comments</span>
        </button>
        <button type="button" onClick={() => setSending(true)}>
          <PaperPlaneTilt aria-hidden="true" size={26} />
          <span className="sr-only">Send</span>
        </button>
        <span role="status" className="min-w-0 truncate text-[0.85rem] text-fg-soft">
          {note}
        </span>
        <button
          type="button"
          aria-pressed={post.saved}
          onClick={() => {
            void toggle(post, "save", onChange);
            say(post.saved ? "Removed from Saved" : "Saved. Find it on your profile.");
          }}
          className="ml-auto"
        >
          <BookmarkSimple aria-hidden="true" size={26} weight={post.saved ? "fill" : "regular"} />
          <span className="sr-only">{post.saved ? "Saved" : "Save"}</span>
        </button>
      </div>
      {editing ? (
        <EditCaption
          post={post}
          onDone={(p) => {
            setEditing(false);
            if (p) onChange(p);
          }}
        />
      ) : (
        <Caption post={post} />
      )}
      {post.commentCount > 0 && (
        <button
          type="button"
          onClick={onOpen}
          className="px-1.5 pt-1 text-[0.88rem] text-fg-soft hover:text-fg"
        >
          View all {compact(post.commentCount)} comments
        </button>
      )}
      <SendSheet
        open={sending}
        link={postLink(post.id)}
        what="post"
        onClose={() => setSending(false)}
      />
    </article>
  );
}
