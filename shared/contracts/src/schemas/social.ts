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
    /** Whether the person asking has liked or saved it. */
    liked: z.boolean(),
    saved: z.boolean(),
    createdAt: IsoDateTime,
    editedAt: IsoDateTime.nullable(),
    /**
     * Taken down after reports, or by a Space's moderators. Only its author still sees it, so
     * they know why it went quiet.
     */
    hidden: z.boolean(),
  })
  .meta({ id: "Post" });
export type Post = z.infer<typeof Post>;

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
  })
  .meta({ id: "CreatePostBody" });
export type CreatePostBody = z.infer<typeof CreatePostBody>;

export const UpdatePostBody = z
  .object({
    caption: z.string().trim().max(Limits.caption.max).nullable(),
    visibility: PostVisibility,
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
  })
  .meta({ id: "Comment" });
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
    /** False for a private account you don't follow: only posts they marked public show. */
    canSeeAll: z.boolean(),
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

export const ActivityType = z.enum([
  "follow",
  "follow_request",
  "post_like",
  "post_comment",
  "comment_reply",
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
    read: z.boolean(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "Activity" });
export type Activity = z.infer<typeof Activity>;

export const ActivityPage = z
  .object({ items: z.array(Activity), nextCursor: Snowflake.nullable(), unread: z.number().int() })
  .meta({ id: "ActivityPage" });
export type ActivityPage = z.infer<typeof ActivityPage>;
