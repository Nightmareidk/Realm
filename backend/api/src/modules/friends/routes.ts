import { Relationship, RelationshipType, Username } from "@realm/contracts";
import { Limits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import { FriendsService } from "./service";

const Who = z.object({ username: Username });

/** `/users/@me/relationships`: your friends, and friend requests both ways. */
export const friendRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    const friends = new FriendsService(deps);
    app.get(
      "/@me/relationships",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ items: z.array(Relationship) }) } },
      },
      async (req) => ({ items: await friends.list(authOf(req).userId) }),
    );
    app.put(
      "/@me/relationships/:username",
      {
        preHandler: requireAuth,
        schema: { params: Who, response: { 200: z.object({ type: RelationshipType }) } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.follow, userId.toString());
        return { type: await friends.add(userId, req.params.username) };
      },
    );
    app.delete(
      "/@me/relationships/:username",
      { preHandler: requireAuth, schema: { params: Who } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.follow, userId.toString());
        await friends.remove(userId, req.params.username);
        return reply.status(204).send();
      },
    );
  };
