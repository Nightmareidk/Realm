import { BookmarkSimple, ChatCircle, Heart, Play, ShareFat } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { Avatar } from "@/components/avatar";
import { cx } from "@/lib/cx";
import { clip, post } from "../demo";
import { PreviewFrame } from "./preview-frame";

function ClipCard({ className }: { className?: string }) {
  return (
    <div className={cx("relative aspect-[9/16] overflow-hidden rounded-md bg-land", className)}>
      <Image src={clip.image} alt="" fill sizes="240px" className="object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[oklch(0.15_0.03_222/0.85)] to-transparent" />
      <span className="absolute top-3 left-3 flex size-8 items-center justify-center rounded-full bg-[oklch(0.15_0.03_222/0.55)] text-[oklch(0.97_0.01_200)]">
        <Play size={14} weight="fill" />
      </span>
      <div className="absolute inset-x-3 bottom-3 text-[oklch(0.97_0.01_200)]">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Avatar name={clip.by.name} ink={clip.by.ink} size="xs" />@{clip.by.handle}
          <span className="tabular ml-auto font-normal opacity-80">{clip.duration}</span>
        </p>
        <p className="mt-1.5 text-sm leading-snug">{clip.caption}</p>
      </div>
    </div>
  );
}

function PostCard({ compact }: { compact: boolean }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-md border border-rule bg-ground/40 p-4">
      <header className="flex items-center gap-2.5">
        <Avatar name={post.by.name} ink={post.by.ink} size="sm" />
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold text-ink">{post.by.name}</p>
          <p className="text-xs text-ink-muted">
            @{post.by.handle} <span className="tabular">{post.time}</span>
          </p>
        </div>
      </header>
      <p className="text-sm leading-snug text-ink-soft">{post.text}</p>
      {!compact && (
        <div className="relative aspect-[16/10] overflow-hidden rounded-sm bg-land">
          <Image
            src={post.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 420px, 90vw"
            className="object-cover"
          />
        </div>
      )}
      <footer className="flex items-center gap-5 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <Heart size={16} /> <span className="tabular">{post.likes}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ChatCircle size={16} /> <span className="tabular">{post.comments}</span>
        </span>
        <ShareFat size={16} />
        <BookmarkSimple size={16} className="ml-auto" />
      </footer>
    </article>
  );
}

function Tabs() {
  return (
    <div className="flex gap-5 border-b border-rule px-4 text-sm">
      <span className="border-b-2 border-ink py-2.5 font-semibold text-ink">Following</span>
      <span className="py-2.5 text-ink-muted">For you</span>
      <span className="py-2.5 text-ink-muted">Clips</span>
    </div>
  );
}

export function FeedPreview({ variant = "full" }: { variant?: "full" | "compact" }) {
  const compact = variant === "compact";
  return (
    <PreviewFrame label="The Feed with a clip and a post from people you follow" caption={!compact}>
      <Tabs />
      <div className="@container">
        <div
          className={cx(
            "grid gap-4 p-4",
            compact
              ? "grid-cols-[7.5rem_minmax(0,1fr)]"
              : "grid-cols-1 @[30rem]:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] @[40rem]:grid-cols-[13rem_minmax(0,1fr)]",
          )}
        >
          <ClipCard className={compact ? undefined : "@max-[30rem]:hidden"} />
          <PostCard compact={compact} />
        </div>
      </div>
    </PreviewFrame>
  );
}
