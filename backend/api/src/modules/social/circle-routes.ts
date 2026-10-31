import {
  Collection,
  CollectionBody,
  MuteAccountBody,
  Note,
  NoteBody,
  NoteList,
  PostPage,
  Snowflake,
  Username,
  UserSummary,
} from "@realm/contracts";
import { schema, sql } from "@realm/db";
import { Limits as RateLimits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { notFound } from "../../lib/errors";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import type { CircleService } from "./circle";
import type { SocialService } from "./service";

const UserParams = z.object({ username: Username });
const CollectionParams = z.object({ collectionId: Snowflake });
const ItemParams = CollectionParams.extend({ postId: Snowflake });
const Cursor = z.object({
  before: Snowflake.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const MutedList = z.object({
  items: z.array(z.object({ user: UserSummary, posts: z.boolean(), stories: z.boolean() })),
});

/**
 * Under /v1/users: Close Friends, muting, collections, your Archive, Tagged posts and untagging.
 * Notes live under /v1/notes.
 */
export const circleUserRoutes =
  (deps: Deps, circle: CircleService, social: SocialService): FastifyPluginAsyncZod =>
  async (app) => {
    const limit = (userId: bigint) => enforceLimit(deps, RateLimits.react, userId.toString());

    app.get(
      "/@me/close-friends",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ items: z.array(UserSummary) }) } },
      },
      async (req) => ({ items: await circle.closeFriends(authOf(req).userId) }),
    );
    for (const on of [true, false]) {
      app.route({
        method: on ? "PUT" : "DELETE",
        url: "/@me/close-friends/:username",
        preHandler: requireAuth,
        schema: { params: UserParams },
        handler: async (req, reply) => {
          const { userId } = authOf(req);
          await limit(userId);
          const { username } = req.params as z.infer<typeof UserParams>;
          await circle.setCloseFriend(userId, username, on);
          return reply.status(204).send();
        },
      });
    }

    app.get(
      "/@me/muted",
      { preHandler: requireAuth, schema: { response: { 200: MutedList } } },
      async (req) => circle.muted(authOf(req).userId),
    );
    app.put(
      "/:username/mute",
      {
        preHandler: requireAuth,
        schema: { params: UserParams, body: MuteAccountBody, response: { 200: MuteAccountBody } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await limit(userId);
        return circle.mute(userId, req.params.username, req.body);
      },
    );

    app.get(
      "/@me/collections",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ items: z.array(Collection) }) } },
      },
      async (req) => ({ items: await circle.collections(authOf(req).userId) }),
    );
    app.post(
      "/@me/collections",
      { preHandler: requireAuth, schema: { body: CollectionBody, response: { 201: Collection } } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limit(userId);
        return reply.status(201).send(await circle.createCollection(userId, req.body.name));
      },
    );
    app.patch(
      "/@me/collections/:collectionId",
      {
        preHandler: requireAuth,
        schema: { params: CollectionParams, body: CollectionBody, response: { 200: Collection } },
      },
      async (req) =>
        circle.renameCollection(authOf(req).userId, BigInt(req.params.collectionId), req.body.name),
    );
    app.delete(
      "/@me/collections/:collectionId",
      { preHandler: requireAuth, schema: { params: CollectionParams } },
      async (req, reply) => {
        await circle.deleteCollection(authOf(req).userId, BigInt(req.params.collectionId));
        return reply.status(204).send();
      },
    );
    app.get(
      "/@me/collections/:collectionId/posts",
      {
        preHandler: requireAuth,
        schema: { params: CollectionParams, querystring: Cursor, response: { 200: PostPage } },
      },
      async (req) =>
        circle.collectionPosts(
          authOf(req).userId,
          BigInt(req.params.collectionId),
          req.query.before ? BigInt(req.query.before) : null,
          req.query.limit,
        ),
    );
    for (const on of [true, false]) {
      app.route({
        method: on ? "PUT" : "DELETE",
        url: "/@me/collections/:collectionId/posts/:postId",
        preHandler: requireAuth,
        schema: { params: ItemParams },
        handler: async (req, reply) => {
          const { userId } = authOf(req);
          await limit(userId);
          const p = req.params as z.infer<typeof ItemParams>;
          await circle.setInCollection(userId, BigInt(p.collectionId), BigInt(p.postId), on);
          return reply.status(204).send();
        },
      });
    }

    app.get(
      "/@me/archive",
      { preHandler: requireAuth, schema: { querystring: Cursor, response: { 200: PostPage } } },
      async (req) =>
        social.archived(
          authOf(req).userId,
          req.query.before ? BigInt(req.query.before) : null,
          req.query.limit,
        ),
    );

    app.get(
      "/:username/tagged",
      { schema: { params: UserParams, querystring: Cursor, response: { 200: PostPage } } },
      async (req) => {
        const [row] = await deps.db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(
            sql`lower(${schema.users.username}) = ${req.params.username} and ${schema.users.status} = 'active'`,
          )
          .limit(1);
        if (!row) throw notFound("User");
        return social.tagged(
          row.id,
          req.auth?.userId ?? null,
          req.query.before ? BigInt(req.query.before) : null,
          req.query.limit,
        );
      },
    );
  };

/** Under /v1: Notes, and taking yourself off a post you were tagged in. */
export const noteRoutes =
  (deps: Deps, circle: CircleService, social: SocialService): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/notes",
      { preHandler: requireAuth, schema: { response: { 200: NoteList } } },
      async (req) => circle.notes(authOf(req).userId),
    );
    app.put(
      "/notes/@me",
      { preHandler: requireAuth, schema: { body: NoteBody, response: { 200: Note } } },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, RateLimits.react, userId.toString());
        return circle.setNote(userId, req.body);
      },
    );
    app.delete("/notes/@me", { preHandler: requireAuth }, async (req, reply) => {
      await circle.clearNote(authOf(req).userId);
      return reply.status(204).send();
    });
    app.delete(
      "/posts/:postId/tags/@me",
      { preHandler: requireAuth, schema: { params: z.object({ postId: Snowflake }) } },
      async (req, reply) => {
        await social.untag(BigInt(req.params.postId), authOf(req).userId);
        return reply.status(204).send();
      },
    );
  };
