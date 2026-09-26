import { loadConfig } from "@realm/server-core";
import { buildApp } from "./app";
import { createDeps } from "./deps";

const config = loadConfig();
const deps = createDeps(config);
const app = await buildApp(deps);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await deps.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: config.REALM_API_PORT, host: "0.0.0.0" });
