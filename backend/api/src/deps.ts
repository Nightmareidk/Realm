import { createDb, type Database } from "@realm/db";
import {
  type Config,
  createLogger,
  type EventBus,
  type KeyValueStore,
  type Logger,
  type Mailer,
  MemoryEventBus,
  MemoryMailer,
  MemoryStore,
  RateLimiter,
  RedisEventBus,
  RedisStore,
  SmtpMailer,
  SnowflakeGenerator,
} from "@realm/server-core";

/** Everything a route or service needs. Constructed once per process; faked in tests. */
export interface Deps {
  config: Config;
  logger: Logger;
  db: Database;
  kv: KeyValueStore;
  bus: EventBus;
  mailer: Mailer;
  ids: SnowflakeGenerator;
  limiter: RateLimiter;
  close: () => Promise<void>;
}

export function createDeps(config: Config): Deps {
  const logger = createLogger({
    name: "api",
    level: config.LOG_LEVEL,
    pretty: !config.isProduction,
  });
  const { db, close: closeDb } = createDb(config.DATABASE_URL, { appName: "realm-api" });

  const kv: KeyValueStore = config.REDIS_URL
    ? RedisStore.connect(config.REDIS_URL)
    : new MemoryStore();
  const bus: EventBus = config.REDIS_URL
    ? new RedisEventBus(config.REDIS_URL)
    : new MemoryEventBus();
  if (!config.REDIS_URL) {
    logger.warn("REDIS_URL not set — using in-memory stores (single process, dev only)");
  }

  const mailer: Mailer = config.SMTP_HOST
    ? new SmtpMailer(config.SMTP_FROM, {
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        user: config.SMTP_USER,
        password: config.SMTP_PASSWORD,
      })
    : new MemoryMailer(logger);

  return {
    config,
    logger,
    db,
    kv,
    bus,
    mailer,
    ids: new SnowflakeGenerator(config.REALM_WORKER_ID),
    limiter: new RateLimiter(kv),
    close: async () => {
      await Promise.allSettled([closeDb(), kv.close(), bus.close()]);
    },
  };
}
