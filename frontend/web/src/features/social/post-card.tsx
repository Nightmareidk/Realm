"use client";

import {
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  ChatCircle,
  DotsThree,
  Flag,
  Heart,
  PaperPlaneTilt,
  Trash,
} from "@phosphor-icons/react";
import type { Post } from "@realm/contracts";
import Link from "next/link";
import { useState } from "react";
import { Popover, row } from "@/features/app/menus";
import { openReport, useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { ago, compact, SongChip, Verified } from "./shared";

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

/** A post's pictures (or its Clip), with arrows between photos. */
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
      {post.media.length > 1 && (
        <>
          {at > 0 && (
            <button
              type="button"
              onClick={() => setAt(at - 1)}
              className="absolute top-1/2 left-3 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-fg/85 text-base"
            >
              <CaretLeft aria-hidden="true" size={16} weight="bold" />
              <span className="sr-only">Previous photo</span>
            </button>
          )}
          {at < post.media.length - 1 && (
            <button
              type="button"
              onClick={() => setAt(at + 1)}
              className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-fg/85 text-base"
            >
              <CaretRight aria-hidden="true" size={16} weight="bold" />
              <span className="sr-only">Next photo</span>
            </button>
          )}
          <span className="absolute top-3 right-3 rounded-full bg-[rgb(9_9_12/0.7)] px-2.5 py-1 text-[0.78rem] font-bold text-fg tabular-nums">
            {at + 1}/{post.media.length}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * A post in Look B: the photo lights the room around it, the song sits on the photo, then likes,
 * comments, share and save, and the caption.
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
  const first = post.media[0];
  const glow = first && first.kind === "image" ? first.url : null;
  const mine = post.author.id === me;

  const share = async () => {
    const link = `${location.origin}/u/${post.author.username}?post=${post.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setNote("Link copied");
    } catch {
      setNote(link);
    }
    setTimeout(() => setNote(""), 2400);
  };

  const remove = async () => {
    if (!confirm("Delete this post? This can't be undone.")) return;
    try {
      await api(`/posts/${post.id}`, { method: "DELETE" });
      onRemoved?.();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Not deleted. Try again.");
    }
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
          </p>
        </div>
        <Popover
          label="Post options"
          buttonClass="grid size-9 place-items-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg aria-expanded:bg-fg/8"
          panelClass="w-[14rem]"
          button={<DotsThree aria-hidden="true" size={22} weight="bold" />}
        >
          {(close) => (
            <div>
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
                  className={row}
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
        <button
          type="button"
          onClick={onOpen}
          onDoubleClick={() => !post.liked && void toggle(post, "like", onChange)}
          className="block w-full"
          aria-label="Open the post"
        >
          <PostMedia post={post} className="aspect-[4/5] max-h-[600px] w-full" />
        </button>
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
        <button type="button" onClick={() => void share()}>
          <PaperPlaneTilt aria-hidden="true" size={26} />
          <span className="sr-only">Share</span>
        </button>
        <span role="status" className="text-[0.85rem] text-fg-soft">
          {note}
        </span>
        <button
          type="button"
          aria-pressed={post.saved}
          onClick={() => void toggle(post, "save", onChange)}
          className="ml-auto"
        >
          <BookmarkSimple aria-hidden="true" size={26} weight={post.saved ? "fill" : "regular"} />
          <span className="sr-only">{post.saved ? "Saved" : "Save"}</span>
        </button>
      </div>
      {post.caption && (
        <p className="px-1.5 pt-1 text-[0.92rem] text-fg-soft">
          <Link href={`/u/${post.author.username}`} className="font-bold text-fg">
            {post.author.username}
          </Link>{" "}
          {post.caption}
        </p>
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
    </article>
  );
}
