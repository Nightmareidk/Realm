"use client";

import {
  BookmarkSimple,
  ChatCircle,
  Check,
  GridFour,
  Heart,
  LinkSimple,
  LockSimple,
  MusicNotes,
  PencilSimple,
  PlayCircle,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import type {
  Channel,
  FollowState,
  Highlight,
  HighlightDetail,
  Post,
  PostPage,
  Profile,
  Story,
  UserSummary,
} from "@realm/contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAmbient } from "@/features/app/ambient";
import { Avatar } from "@/features/spaces/person";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { onMade, openComposer } from "./composer";
import { PostDialog } from "./post-dialog";
import { compact, useFetch, Verified } from "./shared";
import { Ring, StoryViewer } from "./stories";

type Tab = "posts" | "clips" | "saved";

/** A small dialog shell in Look B. */
function Sheet({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it (the dialog's own cancel).
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={cx(
        "m-auto max-h-[86vh] overflow-hidden rounded-[22px] bg-surface p-0 text-fg backdrop:bg-[rgb(5_5_7/0.8)]",
        wide ? "w-[min(44rem,calc(100vw-1.5rem))]" : "w-[min(26rem,calc(100vw-1.5rem))]",
      )}
    >
      {open && (
        <div className="flex max-h-[86vh] flex-col">
          <header className="flex items-center border-b border-line px-4 py-3">
            <h2 className="flex-1 text-center font-display text-[1.05rem] font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
            >
              <X aria-hidden="true" size={20} />
              <span className="sr-only">Close</span>
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Followers or following, with a way to see each person. */
function PeopleList({ path }: { path: string }) {
  const list = useFetch<{ items: UserSummary[] }>(path);
  if (list.loading && !list.data)
    return (
      <p role="status" className="p-5 text-fg-soft">
        Loading…
      </p>
    );
  const items = list.data?.items ?? [];
  if (!items.length) return <p className="p-6 text-center text-fg-soft">Nobody yet.</p>;
  return (
    <ul className="p-2">
      {items.map((u) => (
        <li key={u.id}>
          <Link
            href={`/u/${u.username}`}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-fg/6"
          >
            <Avatar user={u} size={44} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-bold">
                <span className="truncate">{u.displayName}</span>
                <Verified kind={u.verified} size={13} />
              </span>
              <span className="block truncate text-[0.85rem] text-fg-soft">@{u.username}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Make a highlight: pick Stories from every day, name it, and it goes on your profile. */
function NewHighlight({ onDone }: { onDone: (h: Highlight) => void }) {
  const archive = useFetch<{ items: Story[] }>("/stories/archive");
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const items = archive.data?.items ?? [];
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!picked.length) return setError("Pick at least one Story.");
    if (!title.trim()) return setError("Give it a name.");
    setBusy(true);
    setError("");
    try {
      onDone(
        await api<Highlight>("/stories/highlights", {
          body: { title: title.trim(), storyIds: picked },
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not saved. Try again.");
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="p-4">
      {archive.loading && !archive.data ? (
        <p role="status" className="text-fg-soft">
          Loading your Stories…
        </p>
      ) : items.length === 0 ? (
        <div className="py-8 text-center">
          <p className="font-bold">No Stories yet</p>
          <p className="mt-1 text-fg-soft">Share a Story first; then keep the best ones here.</p>
          <button
            type="button"
            onClick={() => openComposer({ mode: "story" })}
            className="mt-4 h-10 rounded-full bg-accent px-5 font-bold text-on-accent"
          >
            New Story
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[0.92rem] text-fg-soft">
            Pick Stories from any day. They play in the order you pick them.
          </p>
          <ul className="grid grid-cols-4 gap-1.5 max-sm:grid-cols-3">
            {items.map((s) => {
              const n = picked.indexOf(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={n >= 0}
                    onClick={() =>
                      setPicked((p) => (n >= 0 ? p.filter((x) => x !== s.id) : [...p, s.id]))
                    }
                    className="relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-surface-raised"
                  >
                    {s.media.kind === "image" ? (
                      // biome-ignore lint/performance/noImgElement: your own Story photo.
                      <img src={s.media.url} alt="" className="size-full object-cover" />
                    ) : (
                      <video src={s.media.url} muted className="size-full object-cover" />
                    )}
                    <span
                      className={cx(
                        "absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full text-[0.75rem] font-extrabold",
                        n >= 0
                          ? "bg-accent text-on-accent"
                          : "bg-[rgb(9_9_12/0.5)] shadow-[inset_0_0_0_2px_rgb(255_255_255/0.8)]",
                      )}
                    >
                      {n >= 0 ? n + 1 : ""}
                    </span>
                    <span className="absolute bottom-1 left-1.5 text-[0.7rem] font-bold text-fg drop-shadow">
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="mt-4 block">
            <span className="mb-1.5 block font-bold">Name</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={30}
              placeholder="Like Summer, Gigs, Food"
              className="h-11 w-full rounded-input border-[1.5px] border-line-strong bg-base/70 px-3.5 text-fg outline-none placeholder:text-fg-muted focus-visible:border-accent"
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-[0.92rem] text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            aria-disabled={busy || undefined}
            className="mt-4 h-12 w-full rounded-full bg-accent font-bold text-on-accent aria-disabled:opacity-70"
          >
            {busy ? "Saving…" : `Add to your profile${picked.length ? ` (${picked.length})` : ""}`}
          </button>
        </>
      )}
    </form>
  );
}

/**
 * Someone's profile in Look B. Their picture lights the top; their name in big type; posts,
 * followers and following said quietly in one line; Highlights in circles; then posts in tall
 * 4:5 tiles (Posts, Clips, and Saved on your own).
 */
export function ProfileView({ username }: { username: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const profile = useFetch<Profile>(`/users/${encodeURIComponent(username)}/profile`);
  const p = profile.data;
  const [tab, setTab] = useState<Tab>("posts");
  const posts = useFetch<PostPage>(
    p?.canSeeAll || p?.isSelf
      ? tab === "saved"
        ? "/users/@me/saved"
        : `/users/${encodeURIComponent(username)}/posts?kind=${tab === "clips" ? "clip" : "image"}`
      : null,
  );
  const highlights = useFetch<{ items: Highlight[] }>(
    `/stories/highlights/of/${encodeURIComponent(username)}`,
  );
  const stories = useFetch<{ items: Story[] }>(`/stories/of/${encodeURIComponent(username)}`);
  const [list, setList] = useState<Post[]>([]);
  const [open, setOpen] = useState<Post | null>(null);
  const [people, setPeople] = useState<"followers" | "following" | null>(null);
  const [making, setMaking] = useState(false);
  const [watching, setWatching] = useState<{ title?: string; stories: Story[] } | null>(null);
  const [follow, setFollow] = useState<FollowState>("none");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => setList(posts.data?.items ?? []), [posts.data]);
  useEffect(() => {
    if (p) setFollow(p.follow);
  }, [p]);
  useEffect(
    () =>
      onMade(({ post, story }) => {
        if (post && p?.isSelf && tab === "posts") setList((l) => [post, ...l]);
        if (story) void stories.reload();
      }),
    [p?.isSelf, tab, stories],
  );
  // A shared link (…?post=id) opens that post (only when the address changes).
  // biome-ignore lint/correctness/useExhaustiveDependencies: open is set by this effect.
  useEffect(() => {
    const id = search.get("post");
    if (!id || open) return;
    api<Post>(`/posts/${id}`)
      .then(setOpen)
      .catch(() => {});
  }, [search]);

  useAmbient(p?.user.bannerUrl ?? p?.user.avatarUrl ?? null);

  if (profile.error && !p) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="font-display text-[1.6rem] font-extrabold text-fg">This account isn't here</p>
        <p className="mt-2 text-fg-soft">The link may be wrong, or the account was removed.</p>
        <Link
          href="/explore"
          className="mt-5 inline-grid h-11 place-items-center rounded-full bg-fg/10 px-5 font-bold"
        >
          Search for people
        </Link>
      </div>
    );
  }
  if (!p) {
    return (
      <p role="status" className="py-20 text-center text-fg-soft">
        Loading the profile…
      </p>
    );
  }

  const u = p.user;
  const live = stories.data?.items ?? [];
  const followBtn = async () => {
    setBusy(true);
    try {
      if (follow === "none") {
        const r = await api<{ follow: FollowState }>(`/users/${u.username}/follow`, {
          method: "PUT",
        });
        setFollow(r.follow);
      } else {
        await api(`/users/${u.username}/follow`, { method: "DELETE" });
        setFollow("none");
      }
      void profile.reload();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const message = async () => {
    try {
      const dm = await api<Channel>("/users/@me/channels", { body: { recipientIds: [u.id] } });
      router.push(`/messages/${dm.id}`);
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Can't message them right now.");
    }
  };
  const shareProfile = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/u/${u.username}`);
      setNote("Profile link copied");
    } catch {
      setNote(`${location.origin}/u/${u.username}`);
    }
    setTimeout(() => setNote(""), 2400);
  };
  const openHighlight = async (h: Highlight) => {
    try {
      const d = await api<HighlightDetail>(`/stories/highlights/${h.id}`);
      if (d.stories.length) setWatching({ title: d.title, stories: d.stories });
    } catch {}
  };
  const removeHighlight = async (h: Highlight) => {
    if (!confirm(`Delete the highlight "${h.title}"? The Stories stay in your archive.`)) return;
    await api(`/stories/highlights/${h.id}`, { method: "DELETE" }).catch(() => {});
    void highlights.reload();
  };

  const stat = (n: number, word: string, onClick?: () => void) => {
    const inner = (
      <>
        <b className="font-bold text-fg tabular-nums">{compact(n)}</b> {word}
      </>
    );
    return onClick ? (
      <button type="button" onClick={onClick} className="text-fg-soft hover:text-fg">
        {inner}
      </button>
    ) : (
      <span className="text-fg-soft">{inner}</span>
    );
  };
  const canList = p.isSelf || p.canSeeAll;

  return (
    <div className="mx-auto w-full max-w-[58.5rem] px-8 pb-12 max-md:px-4">
      {/* Who they are. */}
      <section className="flex items-center gap-8 pt-6 pb-7 max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <button
          type="button"
          disabled={!live.length}
          onClick={() => setWatching({ stories: live })}
          className="shrink-0 rounded-full disabled:cursor-default"
        >
          {live.length ? (
            <Ring unseen={live.some((s) => !s.seen)} size={156}>
              <Avatar user={u} size={146} />
            </Ring>
          ) : (
            <Avatar
              user={u}
              size={150}
              className="shadow-[0_0_0_4px_var(--r-surface),0_20px_50px_-20px_rgb(0_0_0/0.8)]"
            />
          )}
          <span className="sr-only">
            {live.length ? `Watch ${u.displayName}'s Story` : u.displayName}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-[2.15rem] leading-tight font-extrabold tracking-[-0.025em] text-fg">
              {u.displayName}
            </h1>
            <Verified kind={u.verified} size={22} />
            {p.isPrivate && (
              <LockSimple aria-label="Private account" size={18} className="text-fg-soft" />
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.95rem] text-fg-soft">
            <span>@{u.username}</span>
            {u.pronouns && <span>· {u.pronouns}</span>}
            {p.category && <span>· {p.category}</span>}
            {p.followsYou && !p.isSelf && (
              <span className="rounded-full bg-fg/10 px-2 py-0.5 text-[0.78rem] font-bold text-fg">
                Follows you
              </span>
            )}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem]">
            {stat(p.counts.posts, p.counts.posts === 1 ? "post" : "posts")}
            {stat(
              p.counts.followers,
              p.counts.followers === 1 ? "follower" : "followers",
              canList ? () => setPeople("followers") : undefined,
            )}
            {stat(
              p.counts.following,
              "following",
              canList ? () => setPeople("following") : undefined,
            )}
          </p>
          {u.bio && (
            <p className="mt-3 max-w-[34rem] whitespace-pre-line text-[0.98rem] leading-relaxed text-fg">
              {u.bio}
            </p>
          )}
          {p.websiteUrl && /^https?:\/\//i.test(p.websiteUrl) && (
            <a
              href={p.websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="mt-1.5 inline-flex items-center gap-1.5 text-[0.92rem] font-bold text-accent hover:underline"
            >
              <LinkSimple aria-hidden="true" size={15} />
              {p.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {p.isSelf ? (
              <>
                <Link
                  href="/settings/profile"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-fg/10 px-4 font-bold text-fg hover:bg-fg/15"
                >
                  <PencilSimple aria-hidden="true" size={16} />
                  Edit profile
                </Link>
                <button
                  type="button"
                  onClick={() => void shareProfile()}
                  className="h-10 rounded-full bg-fg/10 px-4 font-bold text-fg hover:bg-fg/15"
                >
                  Share profile
                </button>
                <button
                  type="button"
                  onClick={() => openComposer({ mode: "post" })}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 font-bold text-on-accent"
                >
                  <Plus aria-hidden="true" size={16} weight="bold" />
                  New post
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  aria-disabled={busy || undefined}
                  onClick={() => void followBtn()}
                  className={cx(
                    "inline-flex h-10 items-center gap-1.5 rounded-full px-5 font-bold",
                    follow === "none"
                      ? "bg-accent text-on-accent"
                      : "bg-fg/10 text-fg hover:bg-fg/15",
                  )}
                >
                  {follow === "following" && <Check aria-hidden="true" size={16} weight="bold" />}
                  {follow === "following"
                    ? "Following"
                    : follow === "requested"
                      ? "Requested"
                      : p.followsYou
                        ? "Follow back"
                        : "Follow"}
                </button>
                <button
                  type="button"
                  onClick={() => void message()}
                  className="h-10 rounded-full bg-fg/10 px-5 font-bold text-fg hover:bg-fg/15"
                >
                  Message
                </button>
              </>
            )}
          </div>
          <p role="status" className="mt-2 text-[0.9rem] text-fg-soft empty:hidden">
            {note}
          </p>
        </div>
      </section>

      {/* Highlights. */}
      {(p.isSelf || (highlights.data?.items.length ?? 0) > 0) && (
        <section aria-label="Highlights" className="pb-6">
          <ul className="flex gap-5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {p.isSelf && (
              <li className="w-[84px] shrink-0 text-center">
                <button
                  type="button"
                  onClick={() => setMaking(true)}
                  className="mx-auto grid size-[78px] place-items-center rounded-full border-[1.5px] border-dashed border-line-strong text-fg-soft hover:border-fg-soft hover:text-fg"
                >
                  <Plus aria-hidden="true" size={26} />
                  <span className="sr-only">New highlight</span>
                </button>
                <span className="mt-1.5 block text-[0.8rem] font-bold text-fg-soft">New</span>
              </li>
            )}
            {(highlights.data?.items ?? []).map((h) => (
              <li key={h.id} className="group relative w-[84px] shrink-0 text-center">
                <button
                  type="button"
                  onClick={() => void openHighlight(h)}
                  className="mx-auto block"
                >
                  <span className="grid size-[78px] place-items-center rounded-full bg-surface-raised p-[3px] shadow-[inset_0_0_0_1.5px_var(--r-border-strong)]">
                    {h.cover ? (
                      // biome-ignore lint/performance/noImgElement: a highlight's cover, behind an access check.
                      <img
                        src={h.cover.url}
                        alt=""
                        className="size-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="size-full rounded-full bg-surface" />
                    )}
                  </span>
                  <span className="mt-1.5 block truncate text-[0.8rem] font-bold text-fg">
                    {h.title}
                  </span>
                </button>
                {p.isSelf && (
                  <button
                    type="button"
                    onClick={() => void removeHighlight(h)}
                    className="absolute top-0 right-0 grid size-7 place-items-center rounded-full bg-surface-raised text-fg-soft opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger"
                  >
                    <Trash aria-hidden="true" size={14} />
                    <span className="sr-only">Delete the highlight {h.title}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Posts. */}
      <div
        role="tablist"
        aria-label="Posts"
        className="flex justify-center gap-2 border-t border-line pt-3 pb-4"
      >
        {(
          [
            ["posts", "Posts", GridFour],
            ["clips", "Clips", PlayCircle],
            ...(p.isSelf ? [["saved", "Saved", BookmarkSimple] as const] : []),
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx(
              "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.92rem] font-bold transition-colors",
              tab === k ? "bg-fg text-base" : "text-fg-soft hover:bg-fg/6 hover:text-fg",
            )}
          >
            <Icon aria-hidden="true" size={18} weight={tab === k ? "fill" : "regular"} />
            {label}
          </button>
        ))}
      </div>
      {!canList ? (
        <div className="py-14 text-center">
          <LockSimple aria-hidden="true" size={36} className="mx-auto text-fg-soft" />
          <p className="mt-3 font-display text-[1.3rem] font-extrabold text-fg">
            This account is private
          </p>
          <p className="mt-1 text-fg-soft">Follow them to see their posts and Highlights.</p>
        </div>
      ) : posts.loading && !posts.data ? (
        <p role="status" className="py-14 text-center text-fg-soft">
          Loading posts…
        </p>
      ) : list.length === 0 ? (
        <div className="py-14 text-center">
          <p className="font-display text-[1.3rem] font-extrabold text-fg">
            {tab === "saved"
              ? "Nothing saved yet"
              : tab === "clips"
                ? "No Clips yet"
                : "No posts yet"}
          </p>
          <p className="mt-1 text-fg-soft">
            {tab === "saved"
              ? "Tap the bookmark on any post to keep it here, just for you."
              : p.isSelf
                ? "Share your first one; your song plays when people open it."
                : "When they share something, it shows up here."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1 overflow-hidden rounded-[18px]">
          {list.map((post) => {
            const m = post.media[0];
            return (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => setOpen(post)}
                  className="group relative block aspect-[4/5] w-full overflow-hidden bg-surface-raised"
                >
                  {m?.kind === "video" ? (
                    <video
                      src={m.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover"
                    />
                  ) : m ? (
                    // biome-ignore lint/performance/noImgElement: people's photos, behind an access check.
                    <img
                      src={m.url}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="grid size-full place-items-center p-3 text-[0.9rem] text-fg">
                      {post.caption}
                    </span>
                  )}
                  <span className="absolute top-2 right-2 flex gap-1.5 text-fg drop-shadow">
                    {post.kind === "clip" && (
                      <PlayCircle aria-hidden="true" size={20} weight="fill" />
                    )}
                    {post.sound && <MusicNotes aria-hidden="true" size={18} weight="bold" />}
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center gap-5 bg-[rgb(9_9_12/0.45)] font-bold text-fg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <span className="flex items-center gap-1.5">
                      <Heart aria-hidden="true" size={20} weight="fill" />
                      {compact(post.likeCount)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ChatCircle aria-hidden="true" size={20} weight="fill" />
                      {compact(post.commentCount)}
                    </span>
                  </span>
                  <span className="sr-only">
                    Open the post{post.caption ? `: ${post.caption.slice(0, 80)}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <PostDialog
        post={open}
        onChange={(x) => {
          setOpen(x);
          setList((l) => l.map((y) => (y.id === x.id ? x : y)));
        }}
        onClose={() => {
          setOpen(null);
          if (search.get("post")) router.replace(`/u/${u.username}`);
        }}
      />
      <Sheet
        open={people !== null}
        title={people === "following" ? "Following" : "Followers"}
        onClose={() => setPeople(null)}
      >
        {people && <PeopleList path={`/users/${encodeURIComponent(u.username)}/${people}`} />}
      </Sheet>
      <Sheet open={making} title="New highlight" onClose={() => setMaking(false)} wide>
        <NewHighlight
          onDone={() => {
            setMaking(false);
            void highlights.reload();
          }}
        />
      </Sheet>
      {watching && (
        <StoryViewer
          rings={[{ author: (watching.stories[0] as Story).author, stories: watching.stories }]}
          start={0}
          title={watching.title}
          onClose={() => {
            setWatching(null);
            void stories.reload();
          }}
        />
      )}
    </div>
  );
}
