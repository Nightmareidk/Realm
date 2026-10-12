import { loadConfig } from "@realm/server-core";
import { buildApp } from "./app";
import { createDeps } from "./deps";
import { attachGateway, type Gateway } from "./gateway/gateway";

const config = loadConfig();
const deps = await createDeps(config);
const app = await buildApp(deps);

// Without Redis there's no way to hear the API from another process, so in single-process
// development the realtime gateway rides on the API's own server at /gateway. With Redis it runs
// on its own (gateway-main.ts), so socket load never slows the API.
const gateway: Gateway | null = config.REDIS_URL ? null : attachGateway(app.server, deps);

/**
 * Stops taking requests, lets the ones in flight finish, closes the database and Redis, then
 * exits. If that hangs, it gives up after ten seconds rather than leaving a half-dead process
 * behind (the process manager starts a fresh one).
 */
let stopping = false;
const shutdown = async (reason: string, code: number) => {
  if (stopping) return;
  stopping = true;
  app.log.info({ reason }, "shutting down");
  const force = setTimeout(() => {
    app.log.error("shutdown timed out; exiting");
    process.exit(code || 1);
  }, 10_000);
  force.unref();
  try {
    await gateway?.close();
    await app.close();
    await deps.close();
  } catch (err) {
    app.log.error({ err }, "error while shutting down");
    code ||= 1;
  }
  process.exit(code);
};
process.on("SIGINT", () => void shutdown("SIGINT", 0));
process.on("SIGTERM", () => void shutdown("SIGTERM", 0));

// Anything that escapes every handler leaves the process in an unknown state: log it, shut down
// cleanly, and let the process manager restart the API.
process.on("unhandledRejection", (err) => {
  app.log.fatal({ err }, "unhandled promise rejection");
  void shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (err) => {
  app.log.fatal({ err }, "uncaught exception");
  void shutdown("uncaughtException", 1);
});

try {
  const host = config.REALM_API_HOST ?? (config.isProduction ? "0.0.0.0" : "127.0.0.1");
  await app.listen({ port: config.REALM_API_PORT, host });
} catch (err) {
  app.log.fatal({ err }, "couldn't start the API");
  await deps.close().catch(() => {});
  process.exit(1);
}
