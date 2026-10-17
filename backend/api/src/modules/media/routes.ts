import { createReadStream, createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { type Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CreateUploadBody, MediaInfo, Snowflake, UploadTicket } from "@realm/contracts";
import { contentDisposition, Limits, LocalStore } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { AppError, notFound } from "../../lib/errors";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import { MediaService } from "./service";

const IdParams = z.object({ id: Snowflake });

/** `/media`: upload tickets, finishing an upload, and reading files (access checked). */
export const mediaRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    const service = new MediaService(deps);

    app.post(
      "/uploads",
      {
        preHandler: requireAuth,
        schema: { body: CreateUploadBody, response: { 201: UploadTicket } },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.upload, userId.toString());
        return reply.status(201).send(await service.createUpload(userId, req.body));
      },
    );

    app.post(
      "/:id/complete",
      { preHandler: requireAuth, schema: { params: IdParams, response: { 200: MediaInfo } } },
      async (req) => service.complete(authOf(req).userId, BigInt(req.params.id)),
    );

    app.get(
      "/:id",
      { preHandler: requireAuth, schema: { params: IdParams, response: { 200: MediaInfo } } },
      async (req) => service.info(BigInt(req.params.id), authOf(req).userId),
    );

    // The file itself: a short-lived link for someone allowed to see it. Profile pictures are
    // public; everything else needs the viewer's session.
    app.get("/:id/raw", { schema: { params: IdParams } }, async (req, reply) => {
      const link = await service.readUrl(BigInt(req.params.id), req.auth?.userId ?? null);
      // In development the link is a web path (/api/v1/…, through the web app's proxy); the
      // phone app talks to the API directly, where the same path has no /api in front.
      const url = req.client.isNative && link.startsWith("/api/v1/") ? link.slice(4) : link;
      return reply
        .header("cache-control", "private, max-age=300")
        .header("referrer-policy", "no-referrer")
        .redirect(url, 302);
    });

    // ── Development only: the local folder stands in for R2 ──────────────────
    const store = deps.storage;
    if (!(store instanceof LocalStore)) return;

    // Uploads arrive as raw bytes of any type: hand the stream straight through.
    app.addContentTypeParser("*", (_req, payload, done) => done(null, payload));

    app.put("/local/*", async (req, reply) => {
      const key = decodeURIComponent((req.params as { "*": string })["*"]);
      const q = req.query as { e?: string; s?: string };
      const type = String(req.headers["content-type"] ?? "");
      const size = Number(req.headers["content-length"] ?? -1);
      if (!store.verify("PUT", key, Number(q.e), q.s ?? "", `${type}\n${size}`)) {
        throw new AppError(403, "FORBIDDEN", "That upload link isn't valid.");
      }
      let seen = 0;
      const cap = new Transform({
        transform(chunk: Buffer, _enc, next) {
          seen += chunk.length;
          next(seen > size ? new Error("too large") : null, chunk);
        },
      });
      await store.ensureDir(key);
      try {
        await pipeline(req.body as Readable, cap, createWriteStream(store.path(key)));
      } catch {
        await rm(store.path(key), { force: true });
        throw new AppError(400, "UPLOAD_INVALID", "The upload didn't match what was announced.");
      }
      return reply.status(200).send();
    });

    app.get("/local/*", async (req, reply) => {
      const key = decodeURIComponent((req.params as { "*": string })["*"]);
      const q = req.query as { e?: string; s?: string; t?: string; d?: string };
      if (!store.verify("GET", key, Number(q.e), q.s ?? "", `${q.t ?? ""}\n${q.d ?? ""}`)) {
        throw notFound("File");
      }
      if (!(await store.head(key))) throw notFound("File");
      reply
        .header("content-type", q.t || "application/octet-stream")
        .header("x-content-type-options", "nosniff")
        .header("content-security-policy", "default-src 'none'; sandbox")
        .header("cache-control", "private, max-age=600");
      if (q.d) reply.header("content-disposition", contentDisposition(q.d));
      return reply.send(createReadStream(store.path(key)));
    });
  };
