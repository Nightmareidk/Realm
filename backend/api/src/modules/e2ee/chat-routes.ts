import {
  AckEncryptedBody,
  CommitEncryptedBody,
  EncryptedGroupState,
  EncryptedInbox,
  EncryptedSent,
  InitEncryptedGroupBody,
  OpenEncryptedDmBody,
  ReportEncryptedBody,
  SendEncryptedBody,
  Snowflake,
} from "@realm/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { authOf, requireAuth } from "../../plugins/context";
import type { E2eeChatService } from "./chat-service";

const ByChannel = z.object({ channelId: Snowflake });

/**
 * `/e2ee/channels/...` and `/e2ee/inbox`: encrypted chats. The server takes and hands out
 * ciphertext only. Registered with the same quiet log level as the rest of `/e2ee`.
 */
export const e2eeChatRoutes =
  (chats: E2eeChatService): FastifyPluginAsyncZod =>
  async (app) => {
    app.addHook("preHandler", requireAuth);

    app.post(
      "/channels",
      { schema: { body: OpenEncryptedDmBody, response: { 200: EncryptedGroupState } } },
      async (req) => chats.open(authOf(req), req.body.recipientId),
    );

    app.get(
      "/channels/:channelId",
      { schema: { params: ByChannel, response: { 200: EncryptedGroupState } } },
      async (req) => chats.state(authOf(req), BigInt(req.params.channelId)),
    );

    app.post(
      "/channels/:channelId/group",
      { schema: { params: ByChannel, body: InitEncryptedGroupBody } },
      async (req, reply) => {
        await chats.init(authOf(req), BigInt(req.params.channelId), req.body.welcomes);
        return reply.status(204).send();
      },
    );

    app.post(
      "/channels/:channelId/messages",
      {
        schema: { params: ByChannel, body: SendEncryptedBody, response: { 201: EncryptedSent } },
      },
      async (req, reply) =>
        reply
          .status(201)
          .send(await chats.send(authOf(req), BigInt(req.params.channelId), req.body)),
    );

    app.post(
      "/channels/:channelId/commits",
      {
        schema: { params: ByChannel, body: CommitEncryptedBody, response: { 201: EncryptedSent } },
      },
      async (req, reply) =>
        reply
          .status(201)
          .send(await chats.commit(authOf(req), BigInt(req.params.channelId), req.body)),
    );

    app.post(
      "/channels/:channelId/reports",
      { schema: { params: ByChannel, body: ReportEncryptedBody } },
      async (req, reply) => {
        await chats.report(authOf(req), BigInt(req.params.channelId), req.body);
        return reply.status(204).send();
      },
    );

    app.get("/inbox", { schema: { response: { 200: EncryptedInbox } } }, async (req) =>
      chats.inbox(authOf(req)),
    );

    app.post("/inbox/ack", { schema: { body: AckEncryptedBody } }, async (req, reply) => {
      await chats.ack(authOf(req), req.body.ids);
      return reply.status(204).send();
    });
  };
