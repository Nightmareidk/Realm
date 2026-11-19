import {
  ApproveDeviceBody,
  ClaimedKeyPackages,
  ClaimKeyPackagesBody,
  OwnDevice,
  OwnDevices,
  PublicDevices,
  RegisterDeviceBody,
  ResetAccountKeyBody,
  ResumeDeviceBody,
  RevokeDeviceBody,
  SetAccountKeyBody,
  Snowflake,
  UploadKeyPackagesBody,
} from "@realm/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { authOf, requireAuth } from "../../plugins/context";
import type { E2eeService } from "./service";

const ById = z.object({ id: Snowflake });

/**
 * `/e2ee/...`: devices, account keys and KeyPackages for end-to-end encrypted chats. Registered
 * with a quiet log level, so request lines (and IPs) for these routes aren't written to the log.
 */
export const e2eeRoutes =
  (e2ee: E2eeService): FastifyPluginAsyncZod =>
  async (app) => {
    app.addHook("preHandler", requireAuth);

    app.get("/devices", { schema: { response: { 200: OwnDevices } } }, async (req) =>
      e2ee.ownDevices(authOf(req)),
    );

    app.post(
      "/devices",
      { schema: { body: RegisterDeviceBody, response: { 201: OwnDevice } } },
      async (req, reply) =>
        reply.status(201).send(await e2ee.register(authOf(req), req.body.signatureKey)),
    );

    app.post(
      "/devices/:id/resume",
      { schema: { params: ById, body: ResumeDeviceBody, response: { 200: OwnDevice } } },
      async (req) =>
        e2ee.resume(authOf(req), BigInt(req.params.id), req.body.at, req.body.signature),
    );

    app.post(
      "/devices/:id/approve",
      { schema: { params: ById, body: ApproveDeviceBody } },
      async (req, reply) => {
        await e2ee.approve(
          authOf(req),
          BigInt(req.params.id),
          req.body.issuedAt,
          req.body.signature,
          req.client,
        );
        return reply.status(204).send();
      },
    );

    app.post(
      "/devices/:id/revoke",
      { schema: { params: ById, body: RevokeDeviceBody } },
      async (req, reply) => {
        await e2ee.revoke(authOf(req), BigInt(req.params.id), req.body, req.client);
        return reply.status(204).send();
      },
    );

    app.post("/account-key", { schema: { body: SetAccountKeyBody } }, async (req, reply) => {
      await e2ee.setAccountKey(authOf(req), req.body.publicKey);
      return reply.status(204).send();
    });

    app.post(
      "/account-key/reset",
      { schema: { body: ResetAccountKeyBody } },
      async (req, reply) => {
        await e2ee.resetAccountKey(authOf(req), req.body, req.client);
        return reply.status(204).send();
      },
    );

    app.get(
      "/users/:id",
      { schema: { params: ById, response: { 200: PublicDevices } } },
      async (req) => e2ee.publicDevices(authOf(req).userId, BigInt(req.params.id)),
    );

    app.post("/key-packages", { schema: { body: UploadKeyPackagesBody } }, async (req, reply) => {
      await e2ee.uploadKeyPackages(authOf(req), req.body.keyPackages);
      return reply.status(204).send();
    });

    app.get(
      "/key-packages/count",
      { schema: { response: { 200: z.object({ unclaimed: z.number().int() }) } } },
      async (req) => e2ee.keyPackageCount(authOf(req)),
    );

    app.post(
      "/key-packages/claim",
      { schema: { body: ClaimKeyPackagesBody, response: { 200: ClaimedKeyPackages } } },
      async (req) => e2ee.claim(authOf(req), req.body.userIds),
    );
  };
