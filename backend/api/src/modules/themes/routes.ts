import {
  ActiveTheme,
  MyTheme,
  ReportThemeBody,
  ReviewThemeBody,
  SaveThemeBody,
  Snowflake,
  THEME_STORE,
  ThemeCheck,
  ThemeDetail,
  ThemeFile,
  ThemePage,
  ThemePayments,
  ThemeStoreQuery,
  ThemeSummary,
  UpdateThemeBody,
} from "@realm/contracts";
import { Limits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import type { ThemeService } from "./service";

const Params = z.object({ themeId: Snowflake });
const Saved = z.object({ theme: ThemeDetail, problems: z.array(z.string()) });
const List = z.object({ items: z.array(ThemeSummary) });

/** `/themes`: the store, your library, the themes you make, and the one you're using. */
export const themeRoutes =
  (deps: Deps, themes: ThemeService): FastifyPluginAsyncZod =>
  async (app) => {
    // Theme files are small; 64 KB leaves room for JSON around one.
    const small = { bodyLimit: 64 * 1024 };
    const save = (userId: bigint) => enforceLimit(deps, Limits.themeSave, userId.toString());
    const id = (p: { themeId: string }) => BigInt(p.themeId);

    app.get("/payments", { schema: { response: { 200: ThemePayments } } }, async () => ({
      enabled: themes.paymentsEnabled(),
      cutPercent: THEME_STORE.cutPercent,
      priceTiersCents: [...THEME_STORE.priceTiersCents],
    }));

    // The store is open to everyone, signed in or not (signed in, it also says what you own).
    app.get(
      "/",
      { schema: { querystring: ThemeStoreQuery, response: { 200: ThemePage } } },
      async (req) => {
        await enforceLimit(deps, Limits.themeStore, req.auth?.userId.toString() ?? req.ip);
        return themes.store(req.auth?.userId ?? null, req.query);
      },
    );

    app.get(
      "/library",
      { preHandler: requireAuth, schema: { response: { 200: List } } },
      async (req) => ({ items: await themes.library(authOf(req).userId) }),
    );

    app.get(
      "/created",
      { preHandler: requireAuth, schema: { response: { 200: List } } },
      async (req) => ({ items: await themes.created(authOf(req).userId) }),
    );

    app.get(
      "/active",
      { preHandler: requireAuth, schema: { response: { 200: MyTheme } } },
      async (req) => themes.active(authOf(req).userId),
    );

    app.put(
      "/active",
      { preHandler: requireAuth, schema: { body: ActiveTheme, response: { 200: MyTheme } } },
      async (req) => themes.setActive(authOf(req).userId, req.body),
    );

    app.post(
      "/check",
      {
        preHandler: requireAuth,
        ...small,
        schema: { body: z.object({ file: ThemeFile }), response: { 200: ThemeCheck } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await save(userId);
        return themes.checkOnly(userId, req.body.file);
      },
    );

    app.post(
      "/",
      {
        preHandler: requireAuth,
        ...small,
        schema: { body: SaveThemeBody, response: { 201: Saved } },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await save(userId);
        return reply.status(201).send(await themes.create(userId, req.body));
      },
    );

    app.get(
      "/:themeId",
      { schema: { params: Params, response: { 200: ThemeDetail } } },
      async (req) => themes.detail(id(req.params), req.auth?.userId ?? null),
    );

    app.patch(
      "/:themeId",
      {
        preHandler: requireAuth,
        schema: { params: Params, body: UpdateThemeBody, response: { 200: ThemeDetail } },
      },
      async (req) => themes.update(authOf(req).userId, id(req.params), req.body),
    );

    app.delete(
      "/:themeId",
      { preHandler: requireAuth, schema: { params: Params } },
      async (req, reply) => {
        await themes.remove(authOf(req).userId, id(req.params));
        return reply.status(204).send();
      },
    );

    app.post(
      "/:themeId/versions",
      {
        preHandler: requireAuth,
        ...small,
        schema: { params: Params, body: SaveThemeBody, response: { 201: Saved } },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await save(userId);
        return reply.status(201).send(await themes.addVersion(userId, id(req.params), req.body));
      },
    );

    app.post(
      "/:themeId/publish",
      { preHandler: requireAuth, schema: { params: Params, response: { 200: ThemeDetail } } },
      async (req) => {
        const { userId } = authOf(req);
        await save(userId);
        return themes.publish(userId, id(req.params));
      },
    );

    app.post(
      "/:themeId/unpublish",
      { preHandler: requireAuth, schema: { params: Params, response: { 200: ThemeDetail } } },
      async (req) => themes.unpublish(authOf(req).userId, id(req.params)),
    );

    app.get(
      "/:themeId/file",
      {
        preHandler: requireAuth,
        schema: {
          params: Params,
          response: {
            200: z.object({
              file: ThemeFile,
              images: z.array(z.object({ ref: z.string(), url: z.string() })),
            }),
          },
        },
      },
      async (req) => themes.file(id(req.params), authOf(req).userId),
    );

    app.post(
      "/:themeId/get",
      { preHandler: requireAuth, schema: { params: Params, response: { 200: ThemeDetail } } },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.themeGet, userId.toString());
        return themes.get(userId, id(req.params));
      },
    );

    app.delete(
      "/:themeId/library",
      { preHandler: requireAuth, schema: { params: Params } },
      async (req, reply) => {
        await themes.drop(authOf(req).userId, id(req.params));
        return reply.status(204).send();
      },
    );

    app.post(
      "/:themeId/buy",
      {
        preHandler: requireAuth,
        schema: { params: Params, response: { 200: z.object({ checkoutUrl: z.string() }) } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.themeGet, userId.toString());
        return themes.buy(userId, id(req.params));
      },
    );

    app.put(
      "/:themeId/review",
      {
        preHandler: requireAuth,
        schema: { params: Params, body: ReviewThemeBody, response: { 200: ThemeDetail } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.themeReview, userId.toString());
        return themes.review(userId, id(req.params), req.body);
      },
    );

    app.delete(
      "/:themeId/review",
      { preHandler: requireAuth, schema: { params: Params } },
      async (req, reply) => {
        await themes.unreview(authOf(req).userId, id(req.params));
        return reply.status(204).send();
      },
    );

    app.post(
      "/:themeId/report",
      {
        preHandler: requireAuth,
        schema: {
          params: Params,
          body: ReportThemeBody,
          response: { 201: z.object({ hidden: z.boolean() }) },
        },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.report, userId.toString());
        return reply.status(201).send(await themes.report(userId, id(req.params), req.body));
      },
    );
  };
