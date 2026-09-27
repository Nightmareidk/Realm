import {
  BookmarkSimple,
  ChatCircle,
  DotsThree,
  Heart,
  MusicNotes,
  Play,
  Repeat,
  ShareFat,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { Fragment } from "react";
import { Avatar } from "@/components/avatar";
import { cx } from "@/lib/cx";
import { clip, post } from "../demo";
import { PreviewFrame } from "./preview-frame";

const light = "text-[oklch(0.98_0.01_285)]";

/** A short vertical clip: progress, creator, caption, sound, and an action rail. */
function ClipCard({ className }: { className?: string }) {
  return (
    <div className={cx("relative aspect-[9/16] overflow-hidden rounded-2xl bg-land", className)}>
      <Image src={clip.image} alt="" fill sizes="240px" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.12_0.04_280/0.9)] via-transparent to-[oklch(0.12_0.04_280/0.35)]" />
      <div className="absolute inset-x-3 top-3 h-0.5 overflow-hidden rounded-full bg-[oklch(1_0_0/0.25)]">
        <div className="h-full w-[38%] rounded-full bg-[oklch(1_0_0/0.9)]" />
      </div>
      <span
        className={cx(
          light,
          "absolute top-6 left-3 flex size-8 items-center justify-center rounded-full bg-[oklch(0.12_0.04_280/0.5)] backdrop-blur-sm",
        )}
      >
        <Play size={13} weight="fill" />
      </span>
      <div
        className={cx(
          light,
          "absolute right-2 bottom-20 flex flex-col items-center gap-3 text-[0.62rem]",
        )}
      >
        <span className="flex flex-col items-center gap-0.5">
          <Heart size={20} weight="fill" className="text-[oklch(0.72_0.2_350)]" />
          <span className="tabular">{clip.likes}</span>
        </span>
        <span className="flex flex-col items-center gap-0.5">
          <ChatCircle size={20} weight="fill" />
          <span className="tabular">{clip.comments}</span>
        </span>
        <ShareFat size={20} weight="fill" />
      </div>
      <div className={cx(light, "absolute inset-x-3 bottom-3")}>
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Avatar name={clip.by.name} ink={clip.by.ink} src={clip.by.avatar} size="xs" />@
          {clip.by.handle}
          <span className="rounded-full border border-[oklch(1_0_0/0.5)] px-1.5 text-[0.6rem] font-semibold">
            Follow
          </span>
        </p>
        <p className="mt-1.5 pr-8 text-sm leading-snug">{clip.caption}</p>
        <p className="mt-1.5 flex items-center gap-1 truncate text-[0.65rem] opacity-80">
          <MusicNotes size={11} weight="fill" /> {clip.sound}
        </p>
      </div>
    </div>
  );
}

/** Mentions and tags in the post's colour; everything else is plain text. */
function RichText({ text, tags }: { text: string; tags: string[] }) {
  const parts = text.split(/(@\w+)/g);
  return (
    <p className="text-sm leading-snug text-ink-soft">
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed sentence split once.
          <span key={i} className="font-semibold text-feed-text">
            {part}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed sentence split once.
          <Fragment key={i}>{part}</Fragment>
        ),
      )}{" "}
      {tags.map((t) => (
        <span key={t} className="text-feed-text">
          {t}{" "}
        </span>
      ))}
    </p>
  );
}

function PostCard({ compact }: { compact: boolean }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-rule bg-panel-raised/40 p-4">
      <header className="flex items-center gap-2.5">
        <Avatar name={post.by.name} ink={post.by.ink} src={post.by.avatar} size="md" />
        <div className="min-w-0 leading-tight">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            {post.by.name}
            <span className="rounded-full bg-spaces-fill px-1.5 text-[0.6rem] font-semibold text-spaces-text @max-[26rem]:hidden">
              {post.space}
            </span>
          </p>
          <p className="text-xs text-ink-muted">
            @{post.by.handle} · <span className="tabular">{post.time}</span>
          </p>
        </div>
        <DotsThree size={18} weight="bold" className="ml-auto text-ink-muted" />
      </header>
      <RichText text={post.text} tags={post.tags} />
      {!compact && (
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-land">
          <Image
            src={post.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 420px, 90vw"
            className="object-cover"
          />
          <span className="tabular absolute top-2.5 right-2.5 rounded-full bg-[oklch(0.12_0.04_280/0.6)] px-2 py-0.5 text-[0.65rem] font-semibold text-[oklch(0.98_0.01_285)] backdrop-blur-sm">
            1 / 4
          </span>
        </div>
      )}
      <footer className="flex items-center gap-4 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5 font-semibold text-boards-text">
          <Heart size={18} weight="fill" /> <span className="tabular">{post.likes}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ChatCircle size={18} /> <span className="tabular">{post.comments}</span>
        </span>
        <Repeat size={18} />
        <ShareFat size={18} />
        <BookmarkSimple size={18} weight="fill" className="ml-auto text-ink-soft" />
      </footer>
      {!compact && (
        <>
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="flex -space-x-1.5">
              {post.likedBy.map((p) => (
                <Avatar
                  key={p.handle}
                  name={p.name}
                  ink={p.ink}
                  src={p.avatar}
                  size="xs"
                  className="rounded-full ring-2 ring-panel"
                />
              ))}
            </span>
            <span>
              Liked by{" "}
              <span className="font-semibold text-ink-soft">{post.likedBy[0]?.handle}</span> and{" "}
              <span className="tabular">{post.likes - 1}</span> others
            </span>
          </p>
          <div className="flex items-start gap-2">
            <Avatar
              name={post.topComment.who.name}
              ink={post.topComment.who.ink}
              src={post.topComment.who.avatar}
              size="xs"
            />
            <p className="rounded-2xl rounded-tl-md bg-panel-raised px-3 py-1.5 text-xs text-ink-soft">
              <span className="font-semibold text-ink">{post.topComment.who.handle}</span>{" "}
              {post.topComment.text}
            </p>
          </div>
          <div className="flex h-9 items-center rounded-full border border-rule bg-ground/50 px-3.5 text-xs text-ink-muted">
            Add a comment
          </div>
        </>
      )}
    </article>
  );
}

function Tabs() {
  return (
    <div className="flex gap-1.5 border-b border-rule px-4 py-2.5 text-sm">
      <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-ground">
        Following
      </span>
      <span className="rounded-full px-3 py-1 text-xs text-ink-muted">For you</span>
      <span className="rounded-full px-3 py-1 text-xs text-ink-muted">Clips</span>
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
