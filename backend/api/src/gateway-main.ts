import { createServer } from "node:http";
import { loadConfig } from "@realm/server-core";
import { createDeps } from "./deps";
import { attachGateway } from "./gateway/gateway";

/**
 * The realtime gateway as its own process (production, with Redis): sockets on
 * REALM_GATEWAY_PORT, events from the API over the shared bus, tickets and presence in Redis.
 */
const config = loadConfig();
if (!config.REDIS_URL) {
  console.error(
    "The standalone gateway needs REDIS_URL. Without it, the API serves /gateway itself.",
  );
  process.exit(1);
}
const deps = await createDeps(config);
const server = createServer((_req, res) => {
  res
    .writeHead(404, { "content-type": "text/plain" })
    .end("Realm gateway: connect over WebSocket at /gateway");
});
const gateway = attachGateway(server, deps);

let stopping = false;
const shutdown = async (code: number) => {
  if (stopping) return;
  stopping = true;
  const force = setTimeout(() => process.exit(code || 1), 10_000);
  force.unref();
  await gateway.close().catch(() => {});
  server.close();
  await deps.close().catch(() => {});
  process.exit(code);
};
process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
process.on("unhandledRejection", (err) => {
  deps.logger.fatal({ err }, "gateway: unhandled rejection");
  void shutdown(1);
});

const host = config.REALM_API_HOST ?? (config.isProduction ? "0.0.0.0" : "127.0.0.1");
server.listen(config.REALM_GATEWAY_PORT, host, () => {
  deps.logger.info({ port: config.REALM_GATEWAY_PORT }, "gateway listening");
});
