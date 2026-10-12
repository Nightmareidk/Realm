import {
  AuditEntry,
  Ban,
  BanBody,
  CreateReportBody,
  HandleReportBody,
  Member,
  MuteBody,
  MuteTarget,
  RegisterPushToken,
  ReportedItem,
  ReportReceipt,
  SafetyLists,
  Snowflake,
  UpdateMemberBody,
} from "@realm/contracts";
import { and, eq, schema } from "@realm/db";
import { Limits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { notFound } from "../../lib/errors";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import type { SafetyService } from "./service";

const SpaceParams = z.object({ space: z.string().min(1).max(40) });
const SpaceUser = SpaceParams.extend({ userId: Snowflake });

/** `/reports`: anyone can report what they can see. */
export const reportRoutes =
  (deps: Deps, safety: SafetyService): FastifyPluginAsyncZod =>
  async (app) => {
    app.post(
      "/",
      {
        preHandler: requireAuth,
        schema: { body: CreateReportBody, response: { 201: ReportReceipt } },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.report, userId.toString());
        return reply.status(201).send(await safety.report(userId, req.body));
      },
    );
  };

/** `/communities/:space/...`: what a Space's moderators can do, each step in the activity log. */
export const moderationRoutes =
  (deps: Deps, safety: SafetyService): FastifyPluginAsyncZod =>
  async (app) => {
    const limit = async (userId: bigint) => enforceLimit(deps, Limits.modAction, userId.toString());

    app.get(
      "/:space/reports",
      {
        preHandler: requireAuth,
        schema: {
          params: SpaceParams,
          response: { 200: z.object({ items: z.array(ReportedItem) }) },
        },
      },
      async (req) => ({ items: await safety.queue(req.params.space, authOf(req).userId) }),
    );

    app.post(
      "/:space/reports/:targetId",
      {
        preHandler: requireAuth,
        schema: { params: SpaceParams.extend({ targetId: Snowflake }), body: HandleReportBody },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limit(userId);
        await safety.resolve(
          req.params.space,
          userId,
          BigInt(req.params.targetId),
          req.body.action,
        );
        return reply.status(204).send();
      },
    );

    app.patch(
      "/:space/members/:userId",
      {
        preHandler: requireAuth,
        schema: { params: SpaceUser, body: UpdateMemberBody, response: { 200: Member } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await limit(userId);
        const member = await safety.updateMember(
          req.params.space,
          userId,
          BigInt(req.params.userId),
          req.body,
        );
        if (!member) throw notFound("Member");
        return member;
      },
    );

    app.delete(
      "/:space/members/:userId",
      {
        preHandler: requireAuth,
        schema: {
          params: SpaceUser,
          querystring: z.object({ reason: z.string().max(500).optional() }),
        },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limit(userId);
        await safety.kick(req.params.space, userId, BigInt(req.params.userId), req.query.reason);
        return reply.status(204).send();
      },
    );

    app.get(
      "/:space/bans",
      {
        preHandler: requireAuth,
        schema: { params: SpaceParams, response: { 200: z.object({ bans: z.array(Ban) }) } },
      },
      async (req) => ({ bans: await safety.bans(req.params.space, authOf(req).userId) }),
    );

    app.put(
      "/:space/bans/:userId",
      { preHandler: requireAuth, schema: { params: SpaceUser, body: BanBody } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limit(userId);
        await safety.ban(req.params.space, userId, BigInt(req.params.userId), req.body);
        return reply.status(204).send();
      },
    );

    app.delete(
      "/:space/bans/:userId",
      { preHandler: requireAuth, schema: { params: SpaceUser } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limit(userId);
        await safety.unban(req.params.space, userId, BigInt(req.params.userId));
        return reply.status(204).send();
      },
    );

    app.get(
      "/:space/audit-log",
      {
        preHandler: requireAuth,
        schema: {
          params: SpaceParams,
          response: { 200: z.object({ entries: z.array(AuditEntry) }) },
        },
      },
      async (req) => ({ entries: await safety.auditLog(req.params.space, authOf(req).userId) }),
    );

    app.get(
      "/:space/assignable-roles",
      {
        preHandler: requireAuth,
        schema: {
          params: SpaceParams,
          response: { 200: z.object({ roleIds: z.array(Snowflake) }) },
        },
      },
      async (req) => ({
        roleIds: await safety.assignableRoles(req.params.space, authOf(req).userId),
      }),
    );
  };

/** `/users/@me/...`: blocks, mutes and this device's push token. */
export const meSafetyRoutes =
  (deps: Deps, safety: SafetyService): FastifyPluginAsyncZod =>
  async (app) => {
    const TargetParams = z.object({ type: MuteTarget, id: Snowflake });

    app.get(
      "/@me/safety",
      { preHandler: requireAuth, schema: { response: { 200: SafetyLists } } },
      async (req) => safety.lists(authOf(req).userId),
    );

    app.put(
      "/@me/blocks/:userId",
      { preHandler: requireAuth, schema: { params: z.object({ userId: Snowflake }) } },
      async (req, reply) => {
        await safety.block(authOf(req).userId, BigInt(req.params.userId));
        return reply.status(204).send();
      },
    );

    app.delete(
      "/@me/blocks/:userId",
      { preHandler: requireAuth, schema: { params: z.object({ userId: Snowflake }) } },
      async (req, reply) => {
        await safety.unblock(authOf(req).userId, BigInt(req.params.userId));
        return reply.status(204).send();
      },
    );

    app.put(
      "/@me/mutes/:type/:id",
      { preHandler: requireAuth, schema: { params: TargetParams, body: MuteBody } },
      async (req, reply) => {
        await safety.mute(
          authOf(req).userId,
          req.params.type,
          BigInt(req.params.id),
          req.body.until ? new Date(req.body.until) : null,
        );
        return reply.status(204).send();
      },
    );

    app.delete(
      "/@me/mutes/:type/:id",
      { preHandler: requireAuth, schema: { params: TargetParams } },
      async (req, reply) => {
        await safety.unmute(authOf(req).userId, req.params.type, BigInt(req.params.id));
        return reply.status(204).send();
      },
    );

    // Push notifications on this device (a Firebase Cloud Messaging token).
    app.put(
      "/@me/push-tokens",
      { preHandler: requireAuth, schema: { body: RegisterPushToken } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.pushToken, userId.toString());
        await deps.db
          .insert(schema.pushTokens)
          .values({ token: req.body.token, userId, platform: req.body.platform })
          .onConflictDoUpdate({
            target: schema.pushTokens.token,
            set: { userId, platform: req.body.platform, lastSeenAt: new Date() },
          });
        return reply.status(204).send();
      },
    );

    app.delete(
      "/@me/push-tokens",
      {
        preHandler: requireAuth,
        schema: { body: z.object({ token: z.string().min(20).max(4096) }) },
      },
      async (req, reply) => {
        await deps.db
          .delete(schema.pushTokens)
          .where(
            and(
              eq(schema.pushTokens.token, req.body.token),
              eq(schema.pushTokens.userId, authOf(req).userId),
            ),
          );
        return reply.status(204).send();
      },
    );
  };
