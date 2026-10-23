import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import { sql } from "@realm/db";
import { MemoryQueue } from "@realm/server-core";
import Fastify, { type FastifyBaseLogger, type FastifyInstance, LogController } from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { Deps } from "./deps";
import { jobHandlers } from "./jobs";
import { adminRoutes, verificationRoutes } from "./modules/admin/routes";
import { authRoutes, gatewayRoutes } from "./modules/auth/routes";
import { conversationRoutes } from "./modules/dms/routes";
import { ConversationsService } from "./modules/dms/service";
import { mediaRoutes } from "./modules/media/routes";
import { musicRoutes, soundRoutes, storyRoutes } from "./modules/music/routes";
import { MusicService } from "./modules/music/service";
import { releaseRoutes } from "./modules/releases/routes";
import { meSafetyRoutes, moderationRoutes, reportRoutes } from "./modules/safety/routes";
import { SafetyService } from "./modules/safety/service";
import { postRoutes, socialUserRoutes } from "./modules/social/routes";
import { SocialService } from "./modules/social/service";
import {
  channelRoutes,
  communityRoutes,
  discoverRoutes,
  inviteRoutes,
  meSpaceRoutes,
  spacesModule,
} from "./modules/spaces/routes";
import { themeRoutes } from "./modules/themes/routes";
import { ThemeService } from "./modules/themes/service";
import { userRoutes } from "./modules/users/routes";
import { registerContext } from "./plugins/context";
import { registerErrorHandling } from "./plugins/errors";
import { registerSecurity } from "./plugins/security";

export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  // Route plugins are typed via FastifyPluginAsyncZod; the root stays on default types.
  const app: FastifyInstance = Fastify({
    loggerInstance: deps.logger as FastifyBaseLogger,
    trustProxy: deps.config.REALM_TRUST_PROXY,
    bodyLimit: 1024 * 1024,
    genReqId: () => deps.ids.next().toString(36),
    logController: new LogController({ disableRequestLogging: deps.config.isTest }),
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  });
  await app.register(cookie);
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "Realm API", version: "1.0.0" },
    },
    transform: jsonSchemaTransform,
  });

  registerErrorHandling(app);
  registerContext(app, deps);
  registerSecurity(app, deps);

  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async (_req, reply) => {
    await deps.db.execute(sql`select 1`);
    return reply.send({ ok: true });
  });

  await app.register(
    async (v1) => {
      await v1.register(authRoutes(deps), { prefix: "/auth" });
      await v1.register(gatewayRoutes(deps), { prefix: "/gateway" });
      await v1.register(userRoutes(deps), { prefix: "/users" });
      await v1.register(verificationRoutes(deps), { prefix: "/users" });
      await v1.register(adminRoutes(deps), { prefix: "/admin" });
      const spaces = spacesModule(deps);
      await v1.register(meSpaceRoutes(deps, spaces), { prefix: "/users" });
      await v1.register(conversationRoutes(deps, new ConversationsService(deps, spaces.messages)), {
        prefix: "/users",
      });
      await v1.register(communityRoutes(deps, spaces), { prefix: "/communities" });
      await v1.register(channelRoutes(deps, spaces), { prefix: "/channels" });
      await v1.register(inviteRoutes(deps, spaces), { prefix: "/invites" });
      await v1.register(discoverRoutes(deps, spaces), { prefix: "/discover" });
      await v1.register(mediaRoutes(deps), { prefix: "/media" });
      const safety = new SafetyService(deps);
      await v1.register(reportRoutes(deps, safety), { prefix: "/reports" });
      await v1.register(moderationRoutes(deps, safety), { prefix: "/communities" });
      await v1.register(meSafetyRoutes(deps, safety), { prefix: "/users" });
      await v1.register(releaseRoutes(deps), { prefix: "/releases" });
      const social = new SocialService(deps);
      await v1.register(postRoutes(deps, social));
      await v1.register(socialUserRoutes(deps, social), { prefix: "/users" });
      await v1.register(themeRoutes(deps, new ThemeService(deps)), { prefix: "/themes" });
      const music = new MusicService(deps);
      await v1.register(soundRoutes(deps, music), { prefix: "/sounds" });
      await v1.register(musicRoutes(deps, music), { prefix: "/music" });
      await v1.register(storyRoutes(deps, music), { prefix: "/stories" });
      // The API's map is for building Realm, not for strangers mapping it out: off in production.
      if (!deps.config.isProduction) {
        v1.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());
      }
    },
    { prefix: "/v1" },
  );

  // Without Redis there's no worker process: background jobs run here, after each request.
  if (deps.queue instanceof MemoryQueue) deps.queue.process(jobHandlers(deps));

  return app;
}
