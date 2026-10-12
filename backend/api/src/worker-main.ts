import { loadConfig } from "@realm/server-core";
import { createDeps } from "./deps";
import { jobHandlers } from "./jobs";

/**
 * The background worker (production, with Redis): takes jobs the API queued (upload checks,
 * push notifications) so requests never wait on them. Without Redis, the API runs jobs itself.
 */
const config = loadConfig();
if (!config.REDIS_URL) {
  console.error("The worker needs REDIS_URL. Without it, the API runs background jobs itself.");
  process.exit(1);
}
const deps = await createDeps(config);
deps.queue.process(jobHandlers(deps));
deps.logger.info("worker taking jobs");

const shutdown = async (code: number) => {
  const force = setTimeout(() => process.exit(code || 1), 10_000);
  force.unref();
  await deps.close().catch(() => {});
  process.exit(code);
};
process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
