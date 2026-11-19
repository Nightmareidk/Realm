import { z } from "zod";
import { Snowflake } from "../ids";
import { Limits } from "../limits";
import { IsoDateTime, MediaRef } from "./common";
import { SoundPick, SoundUse } from "./music";
import { PublicUser, ThemeAccent, UserSummary } from "./users";

/**
 * Posts, Clips, follows and profiles: the Instagram side of Realm. A post is photos (or text)
 * with a caption; a Clip is one short vertical video. Both live on a profile, can also be shared
 * to a Space, and follow the author's account privacy unless the author marks one public.
 */

export const AccountKind = z.enum(["personal", "business"]);
export type AccountKind = z.infer<typeof AccountKind>;

export const PostKind = z.enum(["image", "clip", "text"]);
export type PostKind = z.infer<typeof PostKind>;

/**
 * Who sees a post: everyone, the author's followers, or only the Space it was shared to. A
 * private account's posts default to followers; marking one public shows it to everyone.
 */
export const PostVisibility = z.enum(["public", "followers", "space"]);
export type PostVisibility = z.infer<typeof PostVisibility>;

/** The Space a post was shared to, as a post shows it. */
export const PostSpace = z
  .object({
    id: Snowflake,
    name: z.string(),
    accent: ThemeAccent,
    iconUrl: z.string().nullable(),
  })
  .meta({ id: "PostSpace" });

/** How long a poll can stay open, in hours (an hour up to a week). */
export const POLL_HOURS = [1, 6, 24, 72, 168] as const;
export const POLL_OPTION_MAX = 40;

/** A poll someone adds to a text post: two to four different choices. */
export const PollInput = z
  .object({
    options: z.array(z.string().trim().min(1).max(POLL_OPTION_MAX)).min(2).max(4),
    hours: z.literal(POLL_HOURS).default(24),
  })
  .refine((p) => new Set(p.options.map((o) => o.toLowerCase())).size === p.options.length, {
    message: "Two choices are the same.",
  })
  .meta({ id: "PollInput" });
export type PollInput = z.infer<typeof PollInput>;

/**
 * A poll as a post shows it. The numbers stay hidden (`votes` is null) until the person asking
 * has voted or the poll has ended, so nobody just follows the crowd; its author always sees them.
 * Who picked what is never shown to anyone.
 */
export const Poll = z
  .object({
    options: z.array(z.object({ text: z.string(), votes: z.number().int().nullable() })),
    total: z.number().int(),
    /** The choice the person asking picked (its place in `options`), if they voted. */
    voted: z.number().int().nullable(),
    endsAt: IsoDateTime,
    ended: z.boolean(),
  })
  .meta({ id: "Poll" });
export type Poll = z.infer<typeof Poll>;

export const VotePollBody = z
  .object({ choice: z.number().int().min(0).max(3) })
  .meta({ id: "VotePollBody" });
export type VotePollBody = z.infer<typeof VotePollBody>;

/**
 * The post a quote post shows under its own words. `post` is null when it can't be shown any
 * more: deleted, no longer public, or its author and the viewer blocked each other.
 */
export const QuotedPost = z
  .object({
    id: Snowflake,
    post: z
      .object({
        author: UserSummary,
        kind: PostKind,
        caption: z.string().nullable(),
        /** Its first photo or video, if it has one. */
        media: MediaRef.nullable(),
        hasPoll: z.boolean(),
        createdAt: IsoDateTime,
      })
      .nullable(),
  })
  .meta({ id: "QuotedPost" });
export type QuotedPost = z.infer<typeof QuotedPost>;

/** A time capsule opens at least this long after it's posted, and at most this long. */
export const CAPSULE_MIN_MS = 60 * 60 * 1000;
export const CAPSULE_MAX_MS = 5 * 366 * 24 * 60 * 60 * 1000;

/**
 * A time capsule: a post sealed until a date its author picked. Until then everyone else sees
 * only that it exists and when it opens; nothing that's inside it.
 */
export const Capsule = z
  .object({
    opensAt: IsoDateTime,
    /** Still sealed. Its author still sees what's inside; nobody else does. */
    sealed: z.boolean(),
  })
  .meta({ id: "Capsule" });
export type Capsule = z.infer<typeof Capsule>;

export const Post = z
  .object({
    id: Snowflake,
    author: UserSummary,
    kind: PostKind,
    caption: z.string().nullable(),
    media: z.array(MediaRef),
    space: PostSpace.nullable(),
    /** The music on it, and the part that plays. */
    sound: SoundUse.nullable(),
    visibility: PostVisibility,
    likeCount: z.number().int(),
    commentCount: z.number().int(),
    /** How many people shared it with their followers, and whether the person asking did. */
    repostCount: z.number().int(),
    reposted: z.boolean(),
    /** In Home: someone you follow reposted it, which is why it's there. */
    repostedBy: UserSummary.nullable(),
    /** A quote post: the post it's about. */
    quoted: QuotedPost.nullable(),
    poll: Poll.nullable(),
    capsule: Capsule.nullable(),
    /** Whether the person asking has liked or saved it. */
    liked: z.boolean(),
    saved: z.boolean(),
    createdAt: IsoDateTime,
    editedAt: IsoDateTime.nullable(),
    /** Pinned to the top of its author's profile. */
    pinned: z.boolean(),
    /** People tagged in it. */
    tags: z.array(UserSummary),
    /** The author hid the like count: others see 0 here and "Liked by others". */
    hideLikes: z.boolean(),
    commentsOff: z.boolean(),
    /** Archived: only its author sees it (in their Archive). */
    archived: z.boolean(),
    /**
     * Taken down after reports, or by a Space's moderators. Only its author still sees it, so
     * they know why it went quiet.
     */
    hidden: z.boolean(),
  })
  .meta({ id: "Post" });
export type Post = z.infer<typeof Post>;

/** A #tag: letters and numbers in any language, and _. Stored and compared in lower case. */
export const HASHTAG_MAX = 50;
/** A caption's tags count up to this many; the rest stay as plain words. */
export const HASHTAGS_PER_POST = 10;
export const Hashtag = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[\p{L}\p{N}_]{2,50}$/u, "That isn't a tag");

/** The #tags in a piece of text, lowercased, each once, in the order they appear. */
export function hashtagsIn(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(
    /(?:^|[^\p{L}\p{N}_&#])#([\p{L}\p{N}_]{2,50})(?![\p{L}\p{N}_])/gu,
  )) {
    const tag = m[1]?.toLowerCase();
    // A number on its own ("#1") is a ranking, not a topic.
    if (tag && !/^\d+$/.test(tag)) found.add(tag);
    if (found.size >= HASHTAGS_PER_POST) break;
  }
  return [...found];
}

export const TrendingTags = z
  .object({
    tags: z.array(z.object({ tag: z.string(), posts: z.number().int() })),
  })
  .meta({ id: "TrendingTags" });
export type TrendingTags = z.infer<typeof TrendingTags>;

export const PostPage = z
  .object({ items: z.array(Post), nextCursor: Snowflake.nullable() })
  .meta({ id: "PostPage" });
export type PostPage = z.infer<typeof PostPage>;

export const CreatePostBody = z
  .object({
    kind: PostKind,
    caption: z.string().trim().max(Limits.caption.max).optional(),
    /** Photos for an image post (1 to 10), one video for a Clip, none for text. */
    mediaIds: z.array(Snowflake).max(Limits.postMedia.max).default([]),
    /** Also share it to this Space (you must be a member). */
    spaceId: Snowflake.optional(),
    /** Left out: public, or followers for a private account; "space" needs a spaceId. */
    visibility: PostVisibility.optional(),
    /** Music: a sound from the library or a creator's own, and which part plays. */
    sound: SoundPick.optional(),
    /** People to tag, by username (they're told, and it shows on their Tagged tab). */
    tags: z.array(z.string().trim().min(1).max(64)).max(Limits.postTags).optional(),
    hideLikes: z.boolean().optional(),
    commentsOff: z.boolean().optional(),
    /** A poll, on a text post. */
    poll: PollInput.optional(),
    /** Make it a quote post: someone's public post shown under your words. */
    quoteOf: Snowflake.optional(),
    /** Seal it as a time capsule that opens at this moment (an hour to five years ahead). */
    opensAt: IsoDateTime.optional(),
  })
  .meta({ id: "CreatePostBody" });
export type CreatePostBody = z.infer<typeof CreatePostBody>;

export const UpdatePostBody = z
  .object({
    caption: z.string().trim().max(Limits.caption.max).nullable(),
    visibility: PostVisibility,
    tags: z.array(z.string().trim().min(1).max(64)).max(Limits.postTags),
    hideLikes: z.boolean(),
    commentsOff: z.boolean(),
    archived: z.boolean(),
  })
  .partial()
  .meta({ id: "UpdatePostBody" });
export type UpdatePostBody = z.infer<typeof UpdatePostBody>;

export const Comment = z
  .object({
    id: Snowflake,
    postId: Snowflake,
    parentId: Snowflake.nullable(),
    author: UserSummary,
    body: z.string(),
    depth: z.number().int(),
    createdAt: IsoDateTime,
    /** Taken down after reports; only its author still sees it. */
    hidden: z.boolean(),
    likeCount: z.number().int(),
    /** Whether the person asking has liked it. */
    liked: z.boolean(),
  })
  .meta({ id: "Comment" });

export const CommentLike = z
  .object({ likeCount: z.number().int(), liked: z.boolean() })
  .meta({ id: "CommentLike" });
export type CommentLike = z.infer<typeof CommentLike>;
export type Comment = z.infer<typeof Comment>;

export const CommentPage = z
  .object({ items: z.array(Comment), nextCursor: Snowflake.nullable() })
  .meta({ id: "CommentPage" });
export type CommentPage = z.infer<typeof CommentPage>;

export const CreateCommentBody = z
  .object({
    body: z.string().trim().min(1).max(Limits.postComment.max),
    parentId: Snowflake.optional(),
  })
  .meta({ id: "CreateCommentBody" });
export type CreateCommentBody = z.infer<typeof CreateCommentBody>;

/** Where you stand with someone: not following, asked (a private account), or following. */
export const FollowState = z.enum(["none", "requested", "following"]);
export type FollowState = z.infer<typeof FollowState>;

export const Profile = z
  .object({
    user: PublicUser,
    accountKind: AccountKind,
    category: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    isPrivate: z.boolean(),
    isSelf: z.boolean(),
    counts: z.object({
      posts: z.number().int(),
      followers: z.number().int(),
      following: z.number().int(),
    }),
    follow: FollowState,
    followsYou: z.boolean(),
    /** People you follow who follow them (up to three), and how many in all. */
    followedBy: z.object({ users: z.array(UserSummary), count: z.number().int() }),
    /** False for a private account you don't follow: only posts they marked public show. */
    canSeeAll: z.boolean(),
    /** On your Close Friends list. */
    closeFriend: z.boolean(),
    /** What you've muted of theirs (their posts and/or Stories stop showing in your feed). */
    muted: z.object({ posts: z.boolean(), stories: z.boolean() }),
  })
  .meta({ id: "Profile" });
export type Profile = z.infer<typeof Profile>;

export const FollowResult = z.object({ follow: FollowState }).meta({ id: "FollowResult" });

export const FollowRequest = z
  .object({ user: UserSummary, createdAt: IsoDateTime })
  .meta({ id: "FollowRequest" });
export type FollowRequest = z.infer<typeof FollowRequest>;

export const UserList = z
  .object({ items: z.array(UserSummary), nextCursor: Snowflake.nullable() })
  .meta({ id: "UserList" });

/** Your account kind and business details, set from the profile editor. */
export const UpdateAccountBody = z
  .object({
    accountKind: AccountKind,
    category: z.string().trim().max(40).nullable(),
    websiteUrl: z
      .url({ protocol: /^https?$/ })
      .max(200)
      .nullable(),
  })
  .partial()
  .meta({ id: "UpdateAccountBody" });
export type UpdateAccountBody = z.infer<typeof UpdateAccountBody>;

export const SearchResults = z
  .object({
    users: z.array(UserSummary),
    spaces: z.array(
      z.object({
        id: Snowflake,
        name: z.string(),
        accent: ThemeAccent,
        iconUrl: z.string().nullable(),
        memberCount: z.number().int(),
        joined: z.boolean(),
      }),
    ),
  })
  .meta({ id: "SearchResults" });
export type SearchResults = z.infer<typeof SearchResults>;

/** Someone you may know, and why they're suggested ("Follows you", "In Late Night Lobby"). */
export const Suggestion = z
  .object({ user: UserSummary, reason: z.string(), followsYou: z.boolean() })
  .meta({ id: "Suggestion" });
export type Suggestion = z.infer<typeof Suggestion>;

export const ActivityType = z.enum([
  "follow",
  "follow_request",
  "post_like",
  "post_repost",
  /** Quoted your post in one of theirs (the activity's post is their new one). */
  "post_quote",
  /** A time capsule opened: yours, or one you saved (the activity says which). */
  "capsule_open",
  "post_comment",
  "comment_reply",
  /** Mentioned you in a caption or comment, or tagged you in a post (see `via`). */
  "mention",
]);

/** One line in your notifications (the heart on Home). */
export const Activity = z
  .object({
    id: Snowflake,
    type: ActivityType,
    actor: UserSummary.nullable(),
    /** The post it's about, with a thumbnail when it has one. */
    post: z.object({ id: Snowflake, thumbUrl: z.string().nullable() }).nullable(),
    text: z.string().nullable(),
    /** A follow notice that's really "they accepted your request". */
    accepted: z.boolean(),
    /** For a mention: in a caption, a comment, or a tag on the photo. */
    via: z.enum(["caption", "comment", "tag"]).nullable(),
    /** Where you stand with the person now (for Follow back / Following on the row). */
    youFollow: FollowState,
    read: z.boolean(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "Activity" });
export type Activity = z.infer<typeof Activity>;

export const ActivityPage = z
  .object({ items: z.array(Activity), nextCursor: Snowflake.nullable(), unread: z.number().int() })
  .meta({ id: "ActivityPage" });
export type ActivityPage = z.infer<typeof ActivityPage>;

/** Mute: their posts and/or Stories stop showing in your feed. They're never told. */
export const MuteAccountBody = z
  .object({ posts: z.boolean(), stories: z.boolean() })
  .meta({ id: "MuteAccountBody" });
export type MuteAccountBody = z.infer<typeof MuteAccountBody>;

/** A folder of saved posts. */
export const Collection = z
  .object({
    id: Snowflake,
    name: z.string(),
    count: z.number().int(),
    /** The newest posts' first photos, for the cover (up to four). */
    covers: z.array(z.string()),
    createdAt: IsoDateTime,
  })
  .meta({ id: "Collection" });
export type Collection = z.infer<typeof Collection>;

export const CollectionName = z.string().trim().min(1).max(Limits.collectionName.max);
export const CollectionBody = z.object({ name: CollectionName }).meta({ id: "CollectionBody" });
export type CollectionBody = z.infer<typeof CollectionBody>;

/**
 * Notes: one short line (with a song, if you like) above your picture in Messages, for a day.
 * People who follow each other see each other's; "close_friends" keeps it to that list.
 */
export const NoteAudience = z.enum(["followers", "close_friends"]);
export type NoteAudience = z.infer<typeof NoteAudience>;

export const Note = z
  .object({
    author: UserSummary,
    text: z.string(),
    sound: z
      .object({
        id: Snowflake,
        title: z.string(),
        artist: z.string(),
        coverUrl: z.string().nullable(),
        audioUrl: z.string().nullable(),
        startMs: z.number().int(),
      })
      .nullable(),
    audience: NoteAudience,
    createdAt: IsoDateTime,
    expiresAt: IsoDateTime,
  })
  .meta({ id: "Note" });
export type Note = z.infer<typeof Note>;

export const NoteBody = z
  .object({
    text: z.string().trim().max(Limits.note.max),
    soundId: Snowflake.optional(),
    soundStartMs: z.number().int().min(0).optional(),
    audience: NoteAudience.default("followers"),
  })
  .refine((b) => b.text.length > 0 || b.soundId, { message: "Write something or pick a song." })
  .meta({ id: "NoteBody" });
export type NoteBody = z.infer<typeof NoteBody>;

export const NoteList = z
  .object({ mine: Note.nullable(), items: z.array(Note) })
  .meta({ id: "NoteList" });
export type NoteList = z.infer<typeof NoteList>;
