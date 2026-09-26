import { type Release, ReleasePlatform, ReleasesResponse } from "@realm/contracts";
import { eq, schema } from "@realm/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Deps } from "../../deps";

const { releases } = schema;

/** Download-portal feed. Also what desktop auto-updaters will read later. */
export const releaseRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    app.get("/", { schema: { response: { 200: ReleasesResponse } } }, async (_req, reply) => {
      const rows = await deps.db.select().from(releases).where(eq(releases.channel, "stable"));
      const byPlatform = new Map(rows.map((r) => [r.platform, r]));

      // Every platform is always listed; missing rows read as "coming soon".
      const list: Release[] = ReleasePlatform.options.map((platform) => {
        const r = byPlatform.get(platform);
        return {
          platform,
          status: r?.status ?? "coming_soon",
          channel: "stable",
          version: r?.version ?? null,
          url: r?.status === "available" ? (r.url ?? null) : null,
          sha256: r?.sha256 ?? null,
          sizeBytes: r?.sizeBytes ?? null,
          minOs: r?.minOs ?? null,
          publishedAt: r?.publishedAt?.toISOString() ?? null,
        };
      });

      reply.header("Cache-Control", "public, max-age=300");
      return { releases: list };
    });
  };
