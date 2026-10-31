import {
  BackupCodes,
  ConfirmWithPassword,
  DeletionScheduled,
  TwoStepEnableBody,
  TwoStepSetup,
  TwoStepStatus,
} from "@realm/contracts";
import type { FastifyReply } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Deps } from "../../deps";
import { SESSION_COOKIE } from "../../lib/sessions";
import { authOf, requireAuth } from "../../plugins/context";
import type { AccountService } from "./service";

/** `/users/@me/...`: two-step sign-in, taking a break, deleting the account, your data. */
export const accountRoutes =
  (deps: Deps, account: AccountService): FastifyPluginAsyncZod =>
  async (app) => {
    const signOut = (reply: FastifyReply) =>
      reply.clearCookie(SESSION_COOKIE, { path: "/", domain: deps.config.REALM_COOKIE_DOMAIN });

    app.get(
      "/@me/two-step",
      { preHandler: requireAuth, schema: { response: { 200: TwoStepStatus } } },
      async (req) => account.twoStepStatus(authOf(req).userId),
    );

    app.post(
      "/@me/two-step/setup",
      { preHandler: requireAuth, schema: { response: { 200: TwoStepSetup } } },
      async (req) => account.setupTwoStep(authOf(req).userId),
    );

    app.post(
      "/@me/two-step",
      {
        preHandler: requireAuth,
        schema: { body: TwoStepEnableBody, response: { 200: BackupCodes } },
      },
      async (req) =>
        account.enableTwoStep(authOf(req).userId, req.body.secret, req.body.code, req.client),
    );

    app.post(
      "/@me/two-step/disable",
      { preHandler: requireAuth, schema: { body: ConfirmWithPassword } },
      async (req, reply) => {
        await account.disableTwoStep(authOf(req).userId, req.body, req.client);
        return reply.status(204).send();
      },
    );

    app.post(
      "/@me/two-step/backup-codes",
      {
        preHandler: requireAuth,
        schema: { body: ConfirmWithPassword, response: { 200: BackupCodes } },
      },
      async (req) => account.newBackupCodes(authOf(req).userId, req.body, req.client),
    );

    app.post(
      "/@me/deactivate",
      { preHandler: requireAuth, schema: { body: ConfirmWithPassword } },
      async (req, reply) => {
        await account.deactivate(authOf(req).userId, req.body, req.client);
        signOut(reply);
        return reply.status(204).send();
      },
    );

    app.post(
      "/@me/delete",
      {
        preHandler: requireAuth,
        schema: { body: ConfirmWithPassword, response: { 200: DeletionScheduled } },
      },
      async (req, reply) => {
        const result = await account.requestDeletion(authOf(req).userId, req.body, req.client);
        signOut(reply);
        return result;
      },
    );

    /** Download your information: one JSON file. */
    app.get("/@me/data", { preHandler: requireAuth }, async (req, reply) => {
      const data = await account.exportData(authOf(req).userId);
      const day = new Date().toISOString().slice(0, 10);
      return reply
        .header("content-type", "application/json; charset=utf-8")
        .header("content-disposition", `attachment; filename="realm-data-${day}.json"`)
        .header("cache-control", "no-store")
        .send(JSON.stringify(data, null, 2));
    });
  };
