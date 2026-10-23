"use client";

import { BookmarkSimple, Heart, X } from "@phosphor-icons/react";
import type { Post } from "@realm/contracts";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Avatar } from "@/features/spaces/person";
import { Comments } from "./comments";
import { PostMedia, toggle } from "./post-card";
import { ago, compact, SongChip, Verified } from "./shared";

/**
 * A post opened large: the photo on the left, the author, caption and comments on the right (on
 * phones, one above the other). Escape or the X closes it.
 */
export function PostDialog({
  post,
  onChange,
  onClose,
}: {
  post: Post | null;
  onChange: (p: Post) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (post && !d.open) d.showModal();
    if (!post && d.open) d.close();
  }, [post]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it (the dialog's own cancel).
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={post ? `Post by ${post.author.displayName}` : "Post"}
      className="m-auto max-h-[min(92vh,52rem)] w-[min(72rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] bg-surface p-0 text-fg backdrop:bg-[rgb(5_5_7/0.8)]"
    >
      {post && (
        <div className="flex h-[min(92vh,52rem)] max-md:flex-col">
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#050507] max-md:max-h-[50%]">
            <PostMedia post={post} rounded="rounded-none" fit="contain" className="size-full" />
            {post.sound && (
              <SongChip
                sound={post.sound}
                playKey={`post:${post.id}`}
                from={`${post.author.displayName}'s post`}
                className="absolute bottom-4 left-4"
              />
            )}
          </div>
          <div className="flex w-[25rem] shrink-0 flex-col max-md:min-h-0 max-md:w-full max-md:flex-1">
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Link href={`/u/${post.author.username}`} onClick={onClose}>
                <Avatar user={post.author} size={36} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/u/${post.author.username}`}
                  onClick={onClose}
                  className="flex items-center gap-1 font-bold"
                >
                  <span className="truncate">{post.author.displayName}</span>
                  <Verified kind={post.author.verified} size={14} />
                </Link>
                <p className="text-[0.82rem] text-fg-soft">{ago(post.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid size-9 place-items-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
              >
                <X aria-hidden="true" size={20} />
                <span className="sr-only">Close</span>
              </button>
            </header>
            {post.caption && (
              <p className="border-b border-line px-4 py-3 text-[0.95rem] text-fg">
                <b>{post.author.username}</b> {post.caption}
              </p>
            )}
            <Comments post={post} onCount={(n) => onChange({ ...post, commentCount: n })} />
            <div className="flex items-center gap-4 border-t border-line px-4 py-2.5">
              <button
                type="button"
                aria-pressed={post.liked}
                onClick={() => void toggle(post, "like", onChange)}
                className="flex items-center gap-1.5 font-bold"
              >
                <Heart
                  aria-hidden="true"
                  size={24}
                  weight={post.liked ? "fill" : "regular"}
                  className={post.liked ? "text-[#ff6b8b]" : undefined}
                />
                <span className="text-[0.88rem] tabular-nums">{compact(post.likeCount)} likes</span>
              </button>
              <button
                type="button"
                aria-pressed={post.saved}
                onClick={() => void toggle(post, "save", onChange)}
                className="ml-auto"
              >
                <BookmarkSimple
                  aria-hidden="true"
                  size={24}
                  weight={post.saved ? "fill" : "regular"}
                />
                <span className="sr-only">{post.saved ? "Saved" : "Save"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
