import {
  ActivityPage,
  Comment,
  CommentLike,
  CommentPage,
  CreateCommentBody,
  CreatePostBody,
  FollowRequest,
  FollowResult,
  Post,
  PostPage,
  Profile,
  SearchResults,
  Snowflake,
  Suggestion,
  UpdateAccountBody,
  UpdatePostBody,
  UserList,
  Username,
} from "@realm/contracts";
import { schema, sql } from "@realm/db";
import { Limits as RateLimits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { notFound } from "../../lib/errors";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import type { SocialService } from "./service";

const PostParams = z.object({ postId: Snowflake });
const UserParams = z.object({ username: Username });
const Cursor = z.object({
  before: Snowflake.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const viewer = (auth: { userId: bigint } | null) => auth?.userId ?? null;

/** Posts, Clips, comments, the Home feed and search, under /v1. */
export const postRoutes =
  (deps: Deps, social: SocialService): FastifyPluginAsyncZod =>
  async (app) => {
    app.post(
      "/posts",
      { preHandler: requireAuth, schema: { body: CreatePostBody, response: { 201: Post } } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, RateLimits.postCreate, userId.toString());
        return reply.status(201).send(await social.create(userId, req.body));
      },
    );

    app.get(
      "/posts/:postId",
      { schema: { params: PostParams, response: { 200: Post } } },
      async (req) => social.get(BigInt(req.params.postId), viewer(req.auth)),
    );

    app.patch(
      "/posts/:postId",
      {
        preHandler: requireAuth,
        schema: { params: PostParams, body: UpdatePostBody, response: { 200: Post } },
      },
      async (req) => social.update(BigInt(req.params.postId), authOf(req).userId, req.body),
    );

    app.delete(
      "/posts/:postId",
      { preHandler: requireAuth, schema: { params: PostParams } },
      async (req, reply) => {
        await social.remove(BigInt(req.params.postId), authOf(req).userId);
        return reply.status(204).send();
      },
    );

    for (const [path, act] of [
      ["like", (id: bigint, user: bigint, on: boolean) => social.like(id, user, on)],
      ["save", (id: bigint, user: bigint, on: boolean) => social.save(id, user, on)],
    ] as const) {
      for (const on of [true, false]) {
        app.route({
          method: on ? "PUT" : "DELETE",
          url: `/posts/:postId/${path}`,
          preHandler: requireAuth,
          schema: { params: PostParams, response: { 200: Post } },
          handler: async (req) => {
            const { userId } = authOf(req);
            await enforceLimit(deps, RateLimits.react, userId.toString());
            const { postId } = req.params as z.infer<typeof PostParams>;
            return act(BigInt(postId), userId, on);
          },
        });
      }
    }

    app.get(
      "/posts/:postId/comments",
      { schema: { params: PostParams, response: { 200: CommentPage } } },
      async (req) => ({
        items: await social.comments(BigInt(req.params.postId), viewer(req.auth)),
        nextCursor: null,
      }),
    );

    app.post(
      "/posts/:postId/comments",
      {
        preHandler: requireAuth,
        schema: { params: PostParams, body: CreateCommentBody, response: { 201: Comment } },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, RateLimits.commentCreate, userId.toString());
        return reply
          .status(201)
          .send(await social.comment(BigInt(req.params.postId), userId, req.body));
      },
    );

    for (const method of ["put", "delete"] as const) {
      app[method](
        "/posts/:postId/pin",
        { preHandler: requireAuth, schema: { params: PostParams, response: { 200: Post } } },
        async (req) => social.pin(BigInt(req.params.postId), authOf(req).userId, method === "put"),
      );
    }

    for (const method of ["put", "delete"] as const) {
      app[method](
        "/posts/:postId/comments/:commentId/like",
        {
          preHandler: requireAuth,
          schema: {
            params: PostParams.extend({ commentId: Snowflake }),
            response: { 200: CommentLike },
          },
        },
        async (req) => {
          const { userId } = authOf(req);
          await enforceLimit(deps, RateLimits.react, userId.toString());
          return social.likeComment(
            BigInt(req.params.postId),
            BigInt(req.params.commentId),
            userId,
            method === "put",
          );
        },
      );
    }

    app.delete(
      "/posts/:postId/comments/:commentId",
      {
        preHandler: requireAuth,
        schema: { params: PostParams.extend({ commentId: Snowflake }) },
      },
      async (req, reply) => {
        await social.deleteComment(
          BigInt(req.params.postId),
          BigInt(req.params.commentId),
          authOf(req).userId,
        );
        return reply.status(204).send();
      },
    );

    app.get(
      "/feed",
      { preHandler: requireAuth, schema: { querystring: Cursor, response: { 200: PostPage } } },
      async (req) =>
        social.home(
          authOf(req).userId,
          req.query.before ? BigInt(req.query.before) : null,
          req.query.limit,
        ),
    );

    app.get(
      "/clips",
      { schema: { querystring: Cursor, response: { 200: PostPage } } },
      async (req) =>
        social.clips(
          viewer(req.auth),
          req.query.before ? BigInt(req.query.before) : null,
          req.query.limit,
        ),
    );

    app.get(
      "/search",
      {
        schema: {
          querystring: z.object({ q: z.string().max(64) }),
          response: { 200: SearchResults },
        },
      },
      async (req) => {
        await enforceLimit(deps, RateLimits.search, req.auth?.userId.toString() ?? req.ip);
        return social.search(req.query.q, viewer(req.auth));
      },
    );
  };

/** Profiles, follows, saved posts and activity, under /v1/users. */
export const socialUserRoutes =
  (deps: Deps, social: SocialService): FastifyPluginAsyncZod =>
  async (app) => {
    const idOf = async (username: string) => {
      const [row] = await deps.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          sql`lower(${schema.users.username}) = ${username} and ${schema.users.status} = 'active'`,
        )
        .limit(1);
      if (!row) throw notFound("User");
      return row.id;
    };

    app.get(
      "/@me/saved",
      { preHandler: requireAuth, schema: { querystring: Cursor, response: { 200: PostPage } } },
      async (req) =>
        social.saved(
          authOf(req).userId,
          req.query.before ? BigInt(req.query.before) : null,
          req.query.limit,
        ),
    );

    app.get(
      "/@me/suggestions",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ items: z.array(Suggestion) }) } },
      },
      async (req) => ({ items: await social.suggestions(authOf(req).userId) }),
    );

    app.get(
      "/@me/activity",
      {
        preHandler: requireAuth,
        schema: {
          querystring: z.object({ before: Snowflake.optional() }),
          response: { 200: ActivityPage },
        },
      },
      async (req) =>
        social.activity(authOf(req).userId, req.query.before ? BigInt(req.query.before) : null),
    );

    app.post("/@me/activity/read", { preHandler: requireAuth }, async (req, reply) => {
      await social.markActivityRead(authOf(req).userId);
      return reply.status(204).send();
    });

    app.patch(
      "/@me/account",
      { preHandler: requireAuth, schema: { body: UpdateAccountBody, response: { 200: Profile } } },
      async (req) => {
        const { userId } = authOf(req);
        await social.updateAccount(userId, req.body);
        const [me] = await deps.db
          .select({ username: schema.users.username })
          .from(schema.users)
          .where(sql`${schema.users.id} = ${userId}`);
        if (!me) throw notFound("User");
        return social.profile(me.username, userId);
      },
    );

    app.get(
      "/@me/follow-requests",
      { preHandler: requireAuth, schema: { response: { 200: z.array(FollowRequest) } } },
      async (req) => social.requests(authOf(req).userId),
    );

    app.post(
      "/@me/follow-requests/:username",
      { preHandler: requireAuth, schema: { params: UserParams } },
      async (req, reply) => {
        await social.respond(authOf(req).userId, await idOf(req.params.username), true);
        return reply.status(204).send();
      },
    );

    app.delete(
      "/@me/follow-requests/:username",
      { preHandler: requireAuth, schema: { params: UserParams } },
      async (req, reply) => {
        await social.respond(authOf(req).userId, await idOf(req.params.username), false);
        return reply.status(204).send();
      },
    );

    app.delete(
      "/@me/followers/:username",
      { preHandler: requireAuth, schema: { params: UserParams } },
      async (req, reply) => {
        await social.removeFollower(authOf(req).userId, await idOf(req.params.username));
        return reply.status(204).send();
      },
    );

    app.get(
      "/:username/profile",
      { schema: { params: UserParams, response: { 200: Profile } } },
      async (req) => social.profile(req.params.username, viewer(req.auth)),
    );

    app.get(
      "/:username/posts",
      {
        schema: {
          params: UserParams,
          querystring: Cursor.extend({ kind: z.enum(["image", "clip"]).optional() }),
          response: { 200: PostPage },
        },
      },
      async (req) =>
        social.byAuthor(
          await idOf(req.params.username),
          viewer(req.auth),
          req.query.kind ?? null,
          req.query.before ? BigInt(req.query.before) : null,
          req.query.limit,
        ),
    );

    for (const side of ["followers", "following"] as const) {
      app.get(
        `/:username/${side}`,
        {
          schema: {
            params: UserParams,
            querystring: z.object({ before: Snowflake.optional() }),
            response: { 200: UserList },
          },
        },
        async (req) => {
          const { username } = req.params as z.infer<typeof UserParams>;
          const { before } = req.query as { before?: string };
          return social.people(
            await idOf(username),
            viewer(req.auth),
            side,
            before ? BigInt(before) : null,
          );
        },
      );
    }

    app.put(
      "/:username/follow",
      { preHandler: requireAuth, schema: { params: UserParams, response: { 200: FollowResult } } },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, RateLimits.follow, userId.toString());
        return { follow: await social.follow(userId, await idOf(req.params.username)) };
      },
    );

    app.delete(
      "/:username/follow",
      { preHandler: requireAuth, schema: { params: UserParams, response: { 200: FollowResult } } },
      async (req) => ({
        follow: await social.unfollow(authOf(req).userId, await idOf(req.params.username)),
      }),
    );
  };
