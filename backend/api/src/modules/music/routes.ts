import {
  CreateSoundBody,
  CreateStoryBody,
  Snowflake,
  Sound,
  SoundList,
  SoundSearchQuery,
  Story,
  StoryFeed,
  Username,
} from "@realm/contracts";
import { Limits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import type { MusicService } from "./service";

const Id = z.object({ id: Snowflake });

/** `/sounds`: the free library, creators' own sounds. */
export const soundRoutes =
  (deps: Deps, music: MusicService): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/",
      { preHandler: requireAuth, schema: { querystring: SoundSearchQuery, response: { 200: SoundList } } },
      async (req) => {
        await enforceLimit(deps, Limits.soundSearch, authOf(req).userId.toString());
        return { items: await music.search(req.query.q) };
      },
    );
    app.get(
      "/trending",
      { preHandler: requireAuth, schema: { response: { 200: SoundList } } },
      async () => ({ items: await music.trending() }),
    );
    app.get(
      "/mine",
      { preHandler: requireAuth, schema: { response: { 200: SoundList } } },
      async (req) => ({ items: await music.mine(authOf(req).userId) }),
    );
    app.post(
      "/",
      { preHandler: requireAuth, schema: { body: CreateSoundBody, response: { 201: Sound } } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.postCreate, userId.toString());
        return reply.status(201).send(await music.create(userId, req.body));
      },
    );
    app.get(
      "/:id",
      { preHandler: requireAuth, schema: { params: Id, response: { 200: Sound } } },
      async (req) => music.get(BigInt(req.params.id)),
    );
  };

/** `/stories`: a day-long photo or video, with music if you like. */
export const storyRoutes =
  (deps: Deps, music: MusicService): FastifyPluginAsyncZod =>
  async (app) => {
    app.post(
      "/",
      { preHandler: requireAuth, schema: { body: CreateStoryBody, response: { 201: Story } } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.storyCreate, userId.toString());
        return reply.status(201).send(await music.createStory(userId, req.body));
      },
    );
    app.get(
      "/feed",
      { preHandler: requireAuth, schema: { response: { 200: StoryFeed } } },
      async (req) => music.feed(authOf(req).userId),
    );
    app.get(
      "/of/:username",
      {
        preHandler: requireAuth,
        schema: { params: z.object({ username: Username }), response: { 200: z.object({ items: z.array(Story) }) } },
      },
      async (req) => ({ items: await music.ofUser(req.params.username, authOf(req).userId) }),
    );
    app.post("/:id/view", { preHandler: requireAuth, schema: { params: Id } }, async (req, reply) => {
      await music.view(authOf(req).userId, BigInt(req.params.id));
      return reply.status(204).send();
    });
    app.delete("/:id", { preHandler: requireAuth, schema: { params: Id } }, async (req, reply) => {
      await music.remove(authOf(req).userId, BigInt(req.params.id));
      return reply.status(204).send();
    });
  };
