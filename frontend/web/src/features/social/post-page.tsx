"use client";

import type { Post } from "@realm/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAmbient } from "@/features/app/ambient";
import { PostCard } from "./post-card";
import { PostDialog } from "./post-dialog";
import { useFetch } from "./shared";

/** A single post on its own page, with its comments a click away; gone posts say so. */
export function PostPageView({ id }: { id: string }) {
  const loaded = useFetch<Post>(/^\d{1,20}$/.test(id) ? `/posts/${id}` : null);
  const [post, setPost] = useState<Post | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => setPost(loaded.data), [loaded.data]);
  const first = post?.media[0];
  useAmbient(first?.kind === "image" ? first.url : null);

  if (!post) {
    return loaded.loading ? (
      <p role="status" className="py-20 text-center text-fg-soft">
        Loading the post…
      </p>
    ) : (
      <div className="px-6 py-20 text-center">
        <p className="font-display text-[1.6rem] font-extrabold text-fg">This post isn't here</p>
        <p className="mt-2 text-fg-soft">It may have been deleted, or its account is private.</p>
        <Link
          href="/home"
          className="mt-5 inline-grid h-11 place-items-center rounded-full bg-fg/10 px-5 font-bold"
        >
          Back to Home
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-[36.25rem] px-4 pt-2 pb-12">
      <PostCard
        post={post}
        onChange={setPost}
        onOpen={() => setOpen(true)}
        onRemoved={() => setPost(null)}
      />
      <PostDialog post={open ? post : null} onChange={setPost} onClose={() => setOpen(false)} />
    </div>
  );
}
