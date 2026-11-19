"use client";

import {
  Archive,
  BellSimple,
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  ChatCircle,
  ChatCircleSlash,
  CheckCircle,
  DotsThree,
  EnvelopeSimpleOpen,
  EyeSlash,
  Flag,
  FolderSimple,
  Heart,
  HourglassMedium,
  Link as LinkIcon,
  PaperPlaneTilt,
  PencilSimple,
  PushPin,
  Repeat,
  Trash,
  UserMinus,
} from "@phosphor-icons/react";
import type { Post, QuotedPost } from "@realm/contracts";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Popover, row } from "@/features/app/menus";
import { openReport, useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { CollectionPicker, MentionText, TagsOnPhoto } from "./post-extras";
import { SendSheet } from "./send-sheet";
import { ago, compact, SongChip, Verified } from "./shared";

/** Where a post lives on the website (what Send and Copy link share). */
export const postLink = (id: string) =>
  `${typeof location === "undefined" ? "https://tomyrealm.com" : location.origin}/p/${id}`;

/** Like, save or repost, shown at once and put back if the server says no. */
export async function toggle(
  post: Post,
  what: "like" | "save" | "repost",
  onChange: (p: Post) => void,
) {
  const on = what === "like" ? !post.liked : what === "save" ? !post.saved : !post.reposted;
  const next =
    what === "like"
      ? { ...post, liked: on, likeCount: Math.max(0, post.likeCount + (on ? 1 : -1)) }
      : what === "save"
        ? { ...post, saved: on }
        : {
            ...post,
            reposted: on,
            repostCount: Math.max(0, (post.repostCount ?? 0) + (on ? 1 : -1)),
          };
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
/** "23 days", "5 hours": how long until a time capsule opens. */
function untilOpen(opensAt: string, now: number) {
  const ms = Date.parse(opensAt) - now;
  if (ms <= 60_000) return { n: "<1", unit: "minute" };
  const unit = (n: number, word: string) => ({ n: String(n), unit: n === 1 ? word : `${word}s` });
  // Rounded, so a capsule that opens in 22 days and 23 hours says 23 days.
  const days = ms / 86_400_000;
  if (days >= 2 * 365) return unit(Math.round(days / 365), "year");
  if (days >= 60) return unit(Math.round(days / 30.4), "month");
  if (days >= 1.5) return unit(Math.round(days), "day");
  const hours = ms / 3_600_000;
  if (hours >= 1) return unit(Math.round(hours), "hour");
  return unit(Math.max(1, Math.round(ms / 60_000)), "minute");
}

function opensOn(opensAt: string) {
  const at = new Date(opensAt);
  const day = at.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (at.getTime() - Date.now() > 2 * 86_400_000) return day;
  return `${day}, ${at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Someone's time capsule that hasn't opened: a countdown and the day, never what's inside.
 * "Remind me" saves it, so they're told when it opens. At that moment it asks for the post
 * again, and what's inside appears.
 */
export function SealedCapsule({
  post,
  onChange,
  onRemind,
}: {
  post: Post;
  onChange: (p: Post) => void;
  onRemind: () => void;
}) {
  const opensAt = post.capsule?.opensAt ?? post.createdAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const close = Date.parse(opensAt) - Date.now() < 120_000;
    const tick = setInterval(() => setNow(Date.now()), close ? 1000 : 30_000);
    const wait = Date.parse(opensAt) - Date.now() + 1500;
    const open =
      wait < 2_000_000_000
        ? setTimeout(
            () => {
              api<Post>(`/posts/${post.id}`)
                .then((fresh) => onChange({ ...fresh, repostedBy: post.repostedBy }))
                .catch(() => {});
            },
            Math.max(0, wait),
          )
        : null;
    return () => {
      clearInterval(tick);
      if (open) clearTimeout(open);
    };
  }, [opensAt, post.id, post.repostedBy, onChange]);
  const left = untilOpen(opensAt, now);
  return (
    <div className="r-capsule relative grid place-items-center overflow-hidden rounded-[18px] border border-accent bg-surface-sunken px-6 py-9 text-center">
      <span
        aria-hidden="true"
        className="r-capsule-pool pointer-events-none absolute -top-40 left-1/2 size-80 -translate-x-1/2 rounded-full bg-accent opacity-15 blur-3xl"
      />
      <span className="relative grid size-14 place-items-center rounded-full border-[1.5px] border-accent bg-base text-accent">
        <HourglassMedium aria-hidden="true" size={26} />
      </span>
      <p className="relative mt-3 font-bold text-[0.78rem] text-accent uppercase tracking-[0.12em]">
        Time capsule
      </p>
      <p className="relative mt-3 font-display text-[4rem] text-fg leading-none tabular-nums">
        {left.n}
      </p>
      <p className="relative mt-1 font-bold text-fg-soft">{left.unit} to go</p>
      <p className="relative mt-3 font-bold text-[0.95rem] text-fg">Opens {opensOn(opensAt)}</p>
      <p className="relative mt-1 max-w-sm text-[0.88rem] text-fg-soft">
        Sealed {shortDay(post.createdAt)}. What's inside stays hidden until then.
      </p>
      <button
        type="button"
        aria-pressed={post.saved}
        onClick={onRemind}
        className={cx(
          "relative mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-bold transition-transform duration-150 active:scale-95",
          post.saved ? "border border-line-strong text-fg" : "bg-accent text-on-accent",
        )}
      >
        {post.saved ? (
          <CheckCircle aria-hidden="true" size={18} />
        ) : (
          <BellSimple aria-hidden="true" size={18} />
        )}
        {post.saved ? "We'll tell you when it opens" : "Remind me"}
      </button>
    </div>
  );
}

/** Above a capsule: "only you can see this" while sealed (its author), and once it opened. */
export function CapsuleNote({ post, mine }: { post: Post; mine: boolean }) {
  const c = post.capsule;
  if (!c || (c.sealed && !mine)) return null;
  return c.sealed ? (
    <p className="mx-1.5 mb-3 flex items-start gap-2 rounded-[14px] border border-line bg-surface-sunken p-3 text-[0.88rem] text-fg-soft">
      <HourglassMedium aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent" />
      <span>
        <strong className="text-fg">Sealed until {opensOn(c.opensAt)}.</strong> Only you can see
        what's inside. Likes and comments open with it.
      </span>
    </p>
  ) : (
    <p className="mx-1.5 mb-3 flex items-center gap-2 text-[0.88rem] text-fg-soft">
      <EnvelopeSimpleOpen aria-hidden="true" size={18} className="shrink-0 text-accent" />
      <span>
        <strong className="text-fg">Time capsule</strong> · sealed {shortDay(post.createdAt)},
        opened {shortDay(c.opensAt)}
      </span>
    </p>
  );
}

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
        <MentionText text={post.caption} />
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

/** "2 days left", "5 hours left", "Final result". */
function pollLeft(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Final result";
  const hours = Math.round(ms / 3_600_000);
  if (hours >= 48) return `${Math.round(hours / 24)} days left`;
  if (hours >= 24) return "1 day left";
  if (hours >= 2) return `${hours} hours left`;
  if (ms >= 3_600_000) return "1 hour left";
  const mins = Math.round(ms / 60_000);
  return mins > 1 ? `${mins} minutes left` : "Ends in a minute";
}

/**
 * A poll on a post. Before you vote: the choices as buttons and no numbers. After (or once it's
 * over, or on your own post): each choice as a bar filled to its share, yours with a tick.
 */
function PollBlock({ post, onChange }: { post: Post; onChange: (p: Post) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const poll = post.poll;
  if (!poll) return null;
  const open = poll.options.every((o) => o.votes !== null);
  const canVote = !poll.ended && poll.voted === null;
  const top = Math.max(0, ...poll.options.map((o) => o.votes ?? 0));
  const vote = async (choice: number) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<Post>(`/posts/${post.id}/poll/vote`, {
        method: "PUT",
        body: { choice },
      });
      onChange({ ...next, repostedBy: post.repostedBy });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Your vote didn't count. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 px-1.5 pt-2">
      {poll.options.map((o, i) => {
        const share = poll.total > 0 ? (o.votes ?? 0) / poll.total : 0;
        const mine = poll.voted === i;
        const strong = mine || (top > 0 && o.votes === top);
        return open ? (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: a poll's choices never move.
            key={i}
            type="button"
            disabled={!canVote || busy}
            onClick={() => void vote(i)}
            className="relative flex min-h-11 items-center gap-2 overflow-hidden rounded-input bg-fg/5 px-4 py-2 text-left text-[0.95rem] text-fg enabled:active:scale-[0.99]"
          >
            <span
              aria-hidden="true"
              className={cx(
                "absolute inset-y-0 left-0 w-full origin-left transition-transform duration-500 ease-out motion-reduce:transition-none",
                mine ? "bg-accent/30" : "bg-fg/12",
              )}
              style={{ transform: `scaleX(${share})` }}
            />
            <span className={cx("relative min-w-0 flex-1", strong && "font-bold")}>{o.text}</span>
            {mine && (
              <CheckCircle
                aria-hidden="true"
                size={17}
                weight="fill"
                className="relative text-accent"
              />
            )}
            <span className={cx("relative tabular-nums", strong && "font-bold")}>
              {Math.round(share * 100)}%
            </span>
            {mine && <span className="sr-only">Your vote</span>}
          </button>
        ) : (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: a poll's choices never move.
            key={i}
            type="button"
            disabled={busy}
            onClick={() => void vote(i)}
            className="min-h-11 rounded-input border-[1.5px] border-line-strong px-4 py-2 text-left text-[0.95rem] font-bold text-fg hover:bg-fg/6 active:scale-[0.99]"
          >
            {o.text}
          </button>
        );
      })}
      <p className="text-[0.85rem] text-fg-soft">
        {compact(poll.total)} {poll.total === 1 ? "vote" : "votes"} · {pollLeft(poll.endsAt)}
        {!open ? " · Vote to see results" : canVote ? " · Pick a choice to vote" : ""}
      </p>
      {error && (
        <p role="alert" className="text-[0.85rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** The post a quote is about, small, under the quote's own words. */
function QuotedBlock({ quoted }: { quoted: QuotedPost }) {
  const q = quoted.post;
  if (!q) {
    return (
      <p className="mx-1.5 mt-2 flex items-center gap-2 rounded-[18px] border-[1.5px] border-line px-3.5 py-3 text-[0.9rem] text-fg-soft">
        <EyeSlash aria-hidden="true" size={16} />
        This post isn't available any more.
      </p>
    );
  }
  return (
    <Link
      href={`/p/${quoted.id}`}
      className="mx-1.5 mt-2 flex gap-3 rounded-[18px] border-[1.5px] border-line bg-fg/4 px-3.5 py-3 hover:bg-fg/7"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-[0.88rem]">
          <Avatar user={q.author} size={20} />
          <span className="truncate font-bold text-fg">{q.author.displayName}</span>
          <Verified kind={q.author.verified} size={13} />
          <span className="shrink-0 text-fg-soft">· {ago(q.createdAt)}</span>
        </span>
        {q.caption && (
          <span className="line-clamp-4 whitespace-pre-line text-[0.94rem] text-fg">
            {q.caption}
          </span>
        )}
        {(q.hasPoll || q.kind === "clip") && (
          <span className="text-[0.82rem] font-bold text-fg-soft">
            {q.hasPoll ? "Poll" : "Clip"}
          </span>
        )}
      </span>
      {q.media && q.media.kind !== "video" && (
        // biome-ignore lint/performance/noImgElement: people's photos, behind an access check.
        <img
          src={q.media.url}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-[72px] shrink-0 rounded-[14px] object-cover"
        />
      )}
    </Link>
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
  const [picking, setPicking] = useState(false);
  const [burst, setBurst] = useState(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = post.media[0];
  const glow = first && first.kind === "image" ? first.url : null;
  const mine = post.author.id === me;
  const taggedMe = !mine && post.tags.some((u) => u.id === me);
  // A hidden like count is the author's alone.
  const showLikes = mine || !post.hideLikes;
  // Only someone else's public post, outside a Space, can be reposted.
  // A sealed time capsule: no likes, comments or reposts yet; only its author sees inside.
  const sealed = Boolean(post.capsule?.sealed);
  const sealedForMe = sealed && !mine;
  // Words only (no photo or clip): a thread-style post, the text big beside the avatar.
  const wordsOnly = post.kind === "text" && !sealedForMe;
  const canRepost = Boolean(me) && !mine && post.visibility === "public" && !post.space && !sealed;
  const by = post.repostedBy;

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
  /** The author's switches: archive, hide the like count, turn comments off. */
  const set = async (
    body: { archived?: boolean; hideLikes?: boolean; commentsOff?: boolean },
    done: string,
  ) => {
    try {
      const p = await api<Post>(`/posts/${post.id}`, { method: "PATCH", body });
      if (body.archived) {
        onRemoved?.();
        return;
      }
      onChange(p);
      say(done);
    } catch (err) {
      say(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  };
  const untag = async () => {
    try {
      await api(`/posts/${post.id}/tags/@me`, { method: "DELETE" });
      onChange({ ...post, tags: post.tags.filter((u) => u.id !== me) });
      say("You're no longer tagged");
    } catch {
      say("That didn't work. Try again.");
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
      {by && (
        <Link
          href={`/u/${by.username}`}
          className="flex w-fit items-center gap-1.5 px-1 pb-1 text-[0.82rem] font-bold text-fg-soft hover:text-fg"
        >
          <Repeat aria-hidden="true" size={15} weight="bold" />
          {by.id === me ? "You" : by.displayName} reposted
        </Link>
      )}
      <header
        className={cx(
          "flex gap-2.5 px-1 pt-1",
          wordsOnly ? "items-start pb-0.5" : "items-center pb-2.5",
        )}
      >
        <Link href={`/u/${post.author.username}`} className="shrink-0">
          <Avatar user={post.author} size={38} />
        </Link>
        <div className="min-w-0 flex-1">
          {wordsOnly ? (
            // Name, @handle and time on one line, the way word posts read elsewhere.
            <p className="flex min-w-0 items-center gap-1 text-fg-soft">
              <Link
                href={`/u/${post.author.username}`}
                className="flex min-w-0 items-center gap-1 font-bold text-fg hover:underline"
              >
                <span className="truncate">{post.author.displayName}</span>
                <Verified kind={post.author.verified} size={14} />
              </Link>
              <span className="truncate text-[0.92rem]">
                @{post.author.username} · {ago(post.createdAt)}
                {post.editedAt ? " · Edited" : ""}
                {post.pinned ? " · Pinned" : ""}
              </span>
            </p>
          ) : (
            <Link
              href={`/u/${post.author.username}`}
              className="flex items-center gap-1 font-bold text-fg hover:underline"
            >
              <span className="truncate">{post.author.displayName}</span>
              <Verified kind={post.author.verified} size={14} />
            </Link>
          )}
          {wordsOnly ? (
            post.space && (
              <p className="truncate text-[0.82rem] text-fg-soft">in {post.space.name}</p>
            )
          ) : (
            <p className="truncate text-[0.82rem] text-fg-soft">
              {post.space ? `${post.space.name} · ` : ""}
              {ago(post.createdAt)}
              {post.editedAt ? " · Edited" : ""}
              {post.pinned ? " · Pinned" : ""}
            </p>
          )}
          {wordsOnly && post.caption && !editing && (
            <p className="mt-1 text-[1rem] leading-[1.45] break-words whitespace-pre-line text-fg">
              <MentionText text={post.caption} />
            </p>
          )}
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
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      close();
                      void set(
                        { hideLikes: !post.hideLikes },
                        post.hideLikes ? "Like count shown" : "Like count hidden from others",
                      );
                    }}
                  >
                    <EyeSlash aria-hidden="true" size={19} />
                    {post.hideLikes ? "Show like count" : "Hide like count"}
                  </button>
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      close();
                      void set(
                        { commentsOff: !post.commentsOff },
                        post.commentsOff ? "Comments are on" : "Comments are off",
                      );
                    }}
                  >
                    <ChatCircleSlash aria-hidden="true" size={19} />
                    {post.commentsOff ? "Turn on comments" : "Turn off comments"}
                  </button>
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      close();
                      void set({ archived: true }, "Archived");
                    }}
                  >
                    <Archive aria-hidden="true" size={19} />
                    Archive
                  </button>
                </>
              )}
              <button
                type="button"
                className={row}
                onClick={() => {
                  close();
                  setPicking(true);
                }}
              >
                <FolderSimple aria-hidden="true" size={19} />
                Save to a collection
              </button>
              {taggedMe && (
                <button
                  type="button"
                  className={row}
                  onClick={() => {
                    close();
                    void untag();
                  }}
                >
                  <UserMinus aria-hidden="true" size={19} />
                  Remove me from this post
                </button>
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

      <CapsuleNote post={post} mine={mine} />
      {sealedForMe ? (
        <SealedCapsule
          post={post}
          onChange={onChange}
          onRemind={() => {
            void toggle(post, "save", onChange);
            say(post.saved ? "Reminder cancelled" : "We'll tell you when it opens.");
          }}
        />
      ) : wordsOnly ? null : (
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
              className="r-burst pointer-events-none absolute inset-0 grid place-items-center text-like"
              onAnimationEnd={() => setBurst(0)}
            >
              <Heart size={110} weight="fill" />
            </span>
          )}
          <TagsOnPhoto tags={post.tags} />
          {post.sound && (
            <SongChip
              sound={post.sound}
              playKey={`post:${post.id}`}
              from={`${post.author.displayName}'s post`}
              className="absolute bottom-3 left-3"
            />
          )}
        </div>
      )}

      {wordsOnly && (post.poll || post.quoted) && (
        <div className="pr-1.5 pl-[3.25rem]">
          <PollBlock post={post} onChange={onChange} />
          {post.quoted && <QuotedBlock quoted={post.quoted} />}
        </div>
      )}
      <div
        className={cx(
          "flex items-center text-fg",
          wordsOnly ? "gap-[22px] pt-2 pr-1.5 pb-1 pl-[3.25rem]" : "gap-[18px] px-1.5 pt-3 pb-1",
        )}
      >
        {!sealed && (
          <button
            type="button"
            aria-pressed={post.liked}
            onClick={() => void toggle(post, "like", onChange)}
            className="flex items-center gap-1.5 font-bold transition-transform duration-150 active:scale-90"
          >
            <Heart
              aria-hidden="true"
              size={wordsOnly ? 21 : 26}
              weight={post.liked ? "fill" : "regular"}
              className={post.liked ? "text-like" : undefined}
            />
            {showLikes && (!wordsOnly || post.likeCount > 0) && (
              <span className="text-[0.88rem] tabular-nums">{compact(post.likeCount)}</span>
            )}
            <span className="sr-only">{post.liked ? "Liked" : "Like"}</span>
          </button>
        )}
        {!post.commentsOff && !sealed && (
          <button type="button" onClick={onOpen} className="flex items-center gap-1.5 font-bold">
            <ChatCircle aria-hidden="true" size={wordsOnly ? 21 : 26} />
            {(!wordsOnly || post.commentCount > 0) && (
              <span className="text-[0.88rem] tabular-nums">{compact(post.commentCount)}</span>
            )}
            <span className="sr-only">Comments</span>
          </button>
        )}
        {canRepost && (
          <button
            type="button"
            aria-pressed={post.reposted}
            onClick={() => {
              void toggle(post, "repost", onChange);
              say(post.reposted ? "Repost undone" : "Reposted to your followers");
            }}
            className="flex items-center gap-1.5 font-bold transition-transform duration-150 active:scale-90"
          >
            <Repeat
              aria-hidden="true"
              size={wordsOnly ? 21 : 26}
              weight={post.reposted ? "bold" : "regular"}
              className={post.reposted ? "text-[#2fbf71]" : undefined}
            />
            {(post.repostCount ?? 0) > 0 && (
              <span className="text-[0.88rem] tabular-nums">{compact(post.repostCount)}</span>
            )}
            <span className="sr-only">{post.reposted ? "Undo repost" : "Repost"}</span>
          </button>
        )}
        <button type="button" onClick={() => setSending(true)}>
          <PaperPlaneTilt aria-hidden="true" size={wordsOnly ? 21 : 26} />
          <span className="sr-only">Send</span>
        </button>
        <span role="status" className="min-w-0 truncate text-[0.85rem] text-fg-soft">
          {note}
        </span>
        {!sealedForMe && (
          <button
            type="button"
            aria-pressed={post.saved}
            onClick={() => {
              void toggle(post, "save", onChange);
              say(post.saved ? "Removed from Saved" : "Saved. Find it on your profile.");
            }}
            className="ml-auto"
          >
            <BookmarkSimple
              aria-hidden="true"
              size={wordsOnly ? 21 : 26}
              weight={post.saved ? "fill" : "regular"}
            />
            <span className="sr-only">{post.saved ? "Saved" : "Save"}</span>
          </button>
        )}
      </div>
      {editing ? (
        <EditCaption
          post={post}
          onDone={(p) => {
            setEditing(false);
            if (p) onChange(p);
          }}
        />
      ) : wordsOnly ? null : (
        <Caption post={post} />
      )}
      {!wordsOnly && <PollBlock post={post} onChange={onChange} />}
      {!wordsOnly && post.quoted && <QuotedBlock quoted={post.quoted} />}
      {post.hideLikes && !mine && post.liked && (
        <p className="px-1.5 pt-1 text-[0.88rem] text-fg-soft">Liked by you and others</p>
      )}
      {post.commentCount > 0 && !post.commentsOff && !wordsOnly && (
        <button
          type="button"
          onClick={onOpen}
          className="px-1.5 pt-1 text-[0.88rem] text-fg-soft hover:text-fg"
        >
          View all {compact(post.commentCount)} comments
        </button>
      )}
      <CollectionPicker
        postId={post.id}
        open={picking}
        onClose={() => setPicking(false)}
        onSaved={(name) => {
          onChange({ ...post, saved: true });
          say(`Saved to ${name}`);
        }}
      />
      <SendSheet
        open={sending}
        link={postLink(post.id)}
        what="post"
        onClose={() => setSending(false)}
      />
    </article>
  );
}
