import { Conversation, OpenDmBody, Snowflake, UpdateConversationBody } from "@realm/contracts";
import { Limits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import type { ConversationsService } from "./service";

const ConversationParams = z.object({ channelId: Snowflake });
const RecipientParams = ConversationParams.extend({
  userId: z.union([Snowflake, z.literal("@me")]),
});

/** `/users/@me/channels`: your DMs and group chats. */
export const conversationRoutes =
  (deps: Deps, dms: ConversationsService): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/@me/channels",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ conversations: z.array(Conversation) }) } },
      },
      async (req) => ({ conversations: await dms.list(authOf(req).userId) }),
    );

    app.get(
      "/@me/channels/:channelId",
      {
        preHandler: requireAuth,
        schema: { params: ConversationParams, response: { 200: Conversation } },
      },
      async (req) => dms.one(BigInt(req.params.channelId), authOf(req).userId),
    );

    app.post(
      "/@me/channels",
      {
        preHandler: requireAuth,
        schema: { body: OpenDmBody, response: { 200: Conversation } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.dmOpen, userId.toString());
        return dms.open(userId, req.body);
      },
    );

    app.patch(
      "/@me/channels/:channelId",
      {
        preHandler: requireAuth,
        schema: {
          params: ConversationParams,
          body: UpdateConversationBody,
          response: { 200: Conversation },
        },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.dmChange, userId.toString());
        return dms.update(BigInt(req.params.channelId), userId, req.body);
      },
    );

    // Accept a message request (it moves to your inbox).
    app.post(
      "/@me/channels/:channelId/accept",
      {
        preHandler: requireAuth,
        schema: { params: ConversationParams, response: { 200: Conversation } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.dmChange, userId.toString());
        return dms.accept(BigInt(req.params.channelId), userId);
      },
    );

    app.put(
      "/@me/channels/:channelId/recipients/:userId",
      {
        preHandler: requireAuth,
        schema: { params: RecipientParams, response: { 200: Conversation } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.dmChange, userId.toString());
        const target = req.params.userId === "@me" ? userId : BigInt(req.params.userId);
        return dms.add(BigInt(req.params.channelId), userId, [target]);
      },
    );

    // Leave a group or remove someone from it; for a DM, close it (it comes back with a new message).
    app.delete(
      "/@me/channels/:channelId/recipients/:userId",
      { preHandler: requireAuth, schema: { params: RecipientParams } },
      async (req, reply) => {
        const { userId } = authOf(req);
        const target = req.params.userId === "@me" ? userId : BigInt(req.params.userId);
        await dms.remove(BigInt(req.params.channelId), userId, target);
        return reply.status(204).send();
      },
    );
  };
