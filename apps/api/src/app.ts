import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import { sql } from "@realm/db";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { Deps } from "./deps";
import { authRoutes, gatewayRoutes } from "./modules/auth/routes";
import { releaseRoutes } from "./modules/releases/routes";
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
    disableRequestLogging: deps.config.isTest,
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
      await v1.register(releaseRoutes(deps), { prefix: "/releases" });
      v1.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());
    },
    { prefix: "/v1" },
  );

  return app;
}
