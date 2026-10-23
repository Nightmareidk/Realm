"use client";

import type { Post } from "@realm/contracts";
import Link from "next/link";
import { useFetch } from "./shared";

/** A Realm post link in a message: `…/p/123` (or an older `…/u/name?post=123`). */
const POST_LINK = /https?:\/\/[^\s/]+\/(?:p\/(\d{1,20})|u\/[\w.]+\?post=(\d{1,20}))/;

export const linkedPostId = (text: string | null | undefined) => {
  const m = text ? POST_LINK.exec(text) : null;
  return m ? (m[1] ?? m[2] ?? null) : null;
};

/**
 * A post shared in a chat, shown the way Instagram shows one: the author, the picture and the
 * start of the caption, opening the post. Posts you can't see (private, deleted) say so.
 */
export function PostLinkCard({ id }: { id: string }) {
  const post = useFetch<Post>(`/posts/${id}`);
  const p = post.data;
  if (post.loading && !p) {
    return <span className="block h-24 w-[15rem] animate-pulse rounded-[18px] bg-fg/8" />;
  }
  if (!p) {
    return (
      <span className="block w-[15rem] rounded-[18px] bg-fg/8 px-3.5 py-3 text-[0.88rem] text-fg-soft">
        This post isn't available.
      </span>
    );
  }
  const first = p.media[0];
  return (
    <Link
      href={`/p/${p.id}`}
      className="block w-[15rem] overflow-hidden rounded-[18px] bg-bubble-theirs text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] transition-transform duration-150 hover:scale-[1.01]"
    >
      <span className="flex items-center gap-2 px-3 py-2 text-[0.85rem] font-bold">
        {p.author.displayName}
      </span>
      {first?.kind === "image" ? (
        // biome-ignore lint/performance/noImgElement: the shared post's photo, behind an access check.
        <img src={first.url} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
      ) : first?.kind === "video" ? (
        <video
          src={first.url}
          muted
          playsInline
          preload="metadata"
          className="aspect-[4/5] w-full object-cover"
        />
      ) : null}
      {p.caption && (
        <span className="line-clamp-2 px-3 py-2 text-[0.85rem] text-fg-soft">
          <b className="text-fg">{p.author.username}</b> {p.caption}
        </span>
      )}
    </Link>
  );
}
