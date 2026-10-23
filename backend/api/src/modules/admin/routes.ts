import {
  AdminOverview,
  AdminReportList,
  AdminUser,
  AdminUserList,
  AdminUserQuery,
  AdminUserUpdate,
  MyVerification,
  ReportDecision,
  ReserveBody,
  ReservedList,
  Snowflake,
  StaffLog,
  type StaffRole,
  VerificationDecision,
  VerificationList,
  VerificationRequestBody,
} from "@realm/contracts";
import { Limits } from "@realm/server-core";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { notFound } from "../../lib/errors";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import { AdminService } from "./service";

const Id = z.object({ id: Snowflake });
const Reason = z.object({ reason: z.string().trim().min(3, "Say why, for the record").max(300) });

/** `/users/@me/verification`: ask to be verified, and see how it went. */
export const verificationRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    const admin = new AdminService(deps);
    app.get(
      "/@me/verification",
      { preHandler: requireAuth, schema: { response: { 200: MyVerification } } },
      async (req) => admin.myVerification(authOf(req).userId),
    );
    app.post(
      "/@me/verification",
      {
        preHandler: requireAuth,
        schema: { body: VerificationRequestBody, response: { 200: MyVerification } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.verifyRequest, userId.toString());
        return admin.requestVerification(userId, req.body);
      },
    );
  };

/**
 * `/admin`: Realm's staff tools. Anyone who isn't staff gets "not found", so the pages don't
 * even admit to being there. Roles are read fresh from the database on every request.
 */
export const adminRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    const admin = new AdminService(deps);
    const roles = new WeakMap<FastifyRequest, StaffRole>();
    const staff = (min: StaffRole) => async (req: FastifyRequest) => {
      await requireAuth(req);
      const role = await admin.roleOf(authOf(req).userId);
      if (!role || (min === "admin" && role !== "admin")) throw notFound("Page");
      roles.set(req, role);
    };
    const roleOf = (req: FastifyRequest) => roles.get(req) ?? "moderator";
    const limited = async (req: FastifyRequest) => {
      await enforceLimit(deps, Limits.staffAction, authOf(req).userId.toString());
    };

    app.get(
      "/overview",
      { preHandler: staff("moderator"), schema: { response: { 200: AdminOverview } } },
      async () => admin.overview(),
    );
    app.get(
      "/me",
      {
        preHandler: staff("moderator"),
        schema: { response: { 200: z.object({ role: z.enum(["moderator", "admin"]) }) } },
      },
      async (req) => ({ role: roleOf(req) }),
    );

    // Accounts
    app.get(
      "/users",
      {
        preHandler: staff("moderator"),
        schema: { querystring: AdminUserQuery, response: { 200: AdminUserList } },
      },
      async (req) => ({ items: await admin.users(roleOf(req), req.query.q, req.query.filter) }),
    );
    app.patch(
      "/users/:id",
      {
        preHandler: staff("moderator"),
        schema: { params: Id, body: AdminUserUpdate, response: { 200: AdminUser } },
      },
      async (req) => {
        await limited(req);
        return admin.updateUser(authOf(req).userId, roleOf(req), BigInt(req.params.id), req.body);
      },
    );
    app.post(
      "/users/:id/sign-out",
      { preHandler: staff("admin"), schema: { params: Id, body: Reason } },
      async (req, reply) => {
        await limited(req);
        await admin.signOutEverywhere(authOf(req).userId, BigInt(req.params.id), req.body.reason);
        return reply.status(204).send();
      },
    );

    // Verification
    app.get(
      "/verification",
      {
        preHandler: staff("admin"),
        schema: {
          querystring: z.object({
            status: z.enum(["pending", "approved", "rejected"]).default("pending"),
          }),
          response: { 200: VerificationList },
        },
      },
      async (req) => ({ items: await admin.verificationQueue(req.query.status) }),
    );
    app.post(
      "/verification/:id",
      { preHandler: staff("admin"), schema: { params: Id, body: VerificationDecision } },
      async (req, reply) => {
        await limited(req);
        await admin.decideVerification(
          authOf(req).userId,
          BigInt(req.params.id),
          req.body.approve,
          req.body.reason,
        );
        return reply.status(204).send();
      },
    );

    // Kept-back names
    app.get(
      "/reserved",
      {
        preHandler: staff("admin"),
        schema: {
          querystring: z.object({ q: z.string().trim().max(60).optional() }),
          response: { 200: ReservedList },
        },
      },
      async (req) => admin.reserved(req.query.q),
    );
    app.post(
      "/reserved",
      { preHandler: staff("admin"), schema: { body: ReserveBody } },
      async (req, reply) => {
        await limited(req);
        await admin.reserve(authOf(req).userId, req.body.handle, req.body.label);
        return reply.status(204).send();
      },
    );
    app.delete(
      "/reserved/:handle",
      {
        preHandler: staff("admin"),
        schema: { params: z.object({ handle: z.string().min(1).max(60) }) },
      },
      async (req, reply) => {
        await limited(req);
        await admin.unreserve(authOf(req).userId, req.params.handle);
        return reply.status(204).send();
      },
    );

    // Reports
    app.get(
      "/reports",
      {
        preHandler: staff("moderator"),
        schema: {
          querystring: z.object({
            status: z.enum(["open", "actioned", "dismissed"]).default("open"),
          }),
          response: { 200: AdminReportList },
        },
      },
      async (req) => ({ items: await admin.reports(req.query.status) }),
    );
    app.post(
      "/reports/:id",
      { preHandler: staff("moderator"), schema: { params: Id, body: ReportDecision } },
      async (req, reply) => {
        await limited(req);
        await admin.decideReport(
          authOf(req).userId,
          BigInt(req.params.id),
          req.body.action,
          req.body.reason,
        );
        return reply.status(204).send();
      },
    );

    // The record
    app.get(
      "/log",
      { preHandler: staff("admin"), schema: { response: { 200: StaffLog } } },
      async () => ({ items: await admin.staffLog() }),
    );
  };
