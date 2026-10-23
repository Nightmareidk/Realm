"use client";

import { ChatCircle, Heart, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import type { Post, PostPage } from "@realm/contracts";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { player } from "@/features/music/player";
import { Avatar } from "@/features/spaces/person";
import { cx } from "@/lib/cx";
import { toggle } from "./post-card";
import { PostDialog } from "./post-dialog";
import { compact, SongChip, useFetch, Verified } from "./shared";

/** One Clip: it plays when it's on screen, with its song (or its own sound) and its actions. */
function ClipCard({
  post,
  muted,
  onMute,
  onChange,
  onOpen,
}: {
  post: Post;
  muted: boolean;
  onMute: () => void;
  onChange: (p: Post) => void;
  onOpen: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const m = post.media[0];
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const v = video.current;
        if (!v || !e) return;
        if (e.intersectionRatio > 0.6) {
          void v.play().catch(() => {});
          if (post.sound && !muted) {
            player.play(post.sound, {
              from: `${post.author.displayName}'s Clip`,
              startMs: post.sound.startMs,
              key: `post:${post.id}`,
            });
          }
        } else v.pause();
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [post, muted]);

  return (
    <div ref={box} className="flex snap-start snap-always items-end justify-center gap-4 py-3">
      <div className="relative aspect-[9/16] h-[min(78vh,46rem)] overflow-hidden rounded-[22px] bg-[#050507]">
        {m && (
          <video
            ref={video}
            src={m.url}
            loop
            playsInline
            muted={muted || Boolean(post.sound)}
            className="size-full object-cover"
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[rgb(0_0_0/0.7)] to-transparent" />
        <div className="absolute inset-x-4 bottom-4">
          <Link
            href={`/u/${post.author.username}`}
            className="flex items-center gap-2 font-bold text-fg"
          >
            <Avatar user={post.author} size={32} />
            {post.author.displayName}
            <Verified kind={post.author.verified} size={14} />
          </Link>
          {post.caption && (
            <p className="mt-2 line-clamp-2 text-[0.92rem] text-fg">{post.caption}</p>
          )}
          {post.sound && (
            <SongChip
              sound={post.sound}
              playKey={`post:${post.id}`}
              from={`${post.author.displayName}'s Clip`}
              className="mt-2.5"
            />
          )}
        </div>
        <button
          type="button"
          onClick={onMute}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-[rgb(9_9_12/0.6)] text-fg"
        >
          {muted ? (
            <SpeakerSlash aria-hidden="true" size={18} />
          ) : (
            <SpeakerHigh aria-hidden="true" size={18} />
          )}
          <span className="sr-only">{muted ? "Sound on" : "Sound off"}</span>
        </button>
      </div>
      <div className="flex flex-col items-center gap-4 pb-6 text-fg">
        <button
          type="button"
          aria-pressed={post.liked}
          onClick={() => void toggle(post, "like", onChange)}
          className="flex flex-col items-center gap-1 text-[0.8rem] font-bold"
        >
          <span className="grid size-12 place-items-center rounded-full bg-fg/10">
            <Heart
              aria-hidden="true"
              size={24}
              weight={post.liked ? "fill" : "regular"}
              className={post.liked ? "text-[#ff6b8b]" : undefined}
            />
          </span>
          {compact(post.likeCount)}
          <span className="sr-only">{post.liked ? "Liked" : "Like"}</span>
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-col items-center gap-1 text-[0.8rem] font-bold"
        >
          <span className="grid size-12 place-items-center rounded-full bg-fg/10">
            <ChatCircle aria-hidden="true" size={24} />
          </span>
          {compact(post.commentCount)}
          <span className="sr-only">Comments</span>
        </button>
      </div>
    </div>
  );
}

/** Clips: short videos, one at a time, snapping into place as you scroll. */
export function ClipsView() {
  const page = useFetch<PostPage>("/clips");
  const [clips, setClips] = useState<Post[]>([]);
  const [muted, setMuted] = useState(false);
  const [open, setOpen] = useState<Post | null>(null);
  useEffect(() => setClips(page.data?.items ?? []), [page.data]);
  useEffect(() => () => player.pause(), []);
  const change = (p: Post) => {
    setClips((l) => l.map((x) => (x.id === p.id ? p : x)));
    if (open?.id === p.id) setOpen(p);
  };
  return (
    <div className={cx("h-full snap-y snap-mandatory overflow-y-auto px-4")}>
      {page.loading && !page.data ? (
        <p role="status" className="py-20 text-center text-fg-soft">
          Loading Clips…
        </p>
      ) : clips.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-display text-[1.5rem] font-extrabold text-fg">No Clips yet</p>
          <p className="mt-1 text-fg-soft">
            Short videos people share show up here. Make one in the Realm app.
          </p>
        </div>
      ) : (
        clips.map((p) => (
          <ClipCard
            key={p.id}
            post={p}
            muted={muted}
            onMute={() => {
              setMuted((m) => !m);
              if (!muted) player.pause();
            }}
            onChange={change}
            onOpen={() => setOpen(p)}
          />
        ))
      )}
      <PostDialog post={open} onChange={change} onClose={() => setOpen(null)} />
    </div>
  );
}
