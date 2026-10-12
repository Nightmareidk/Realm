import { type Database, openDb } from "@realm/db";
import {
  type Config,
  createLogger,
  type EventBus,
  FcmPusher,
  type JobQueue,
  type KeyValueStore,
  type LiveKitConfig,
  LocalStore,
  type Logger,
  type Mailer,
  MemoryEventBus,
  MemoryMailer,
  MemoryQueue,
  MemoryStore,
  NoopPusher,
  type ObjectStore,
  type Pusher,
  parseServiceAccount,
  RateLimiter,
  RedisEventBus,
  RedisQueue,
  RedisStore,
  ResendMailer,
  S3Store,
  SmtpMailer,
  SnowflakeGenerator,
} from "@realm/server-core";
import type { ContentScanner } from "./lib/scanner";

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
  /** Uploaded files: R2/S3 in production, a local folder in development. */
  storage: ObjectStore;
  /** Background jobs: a Redis list read by the worker, or inline without Redis. */
  queue: JobQueue;
  /** Push notifications through Firebase Cloud Messaging, when configured. */
  pusher: Pusher;
  /** Voice rooms, video and screen sharing (LiveKit), when configured. */
  livekit: LiveKitConfig | null;
  /** A third-party content check for public Spaces. None connected yet (lib/scanner.ts). */
  scanner?: ContentScanner;
  close: () => Promise<void>;
}

/** Each outside service from its settings, or the local stand-in when it isn't set up. */
export function providers(config: Config, logger: Logger) {
  const storage: ObjectStore =
    config.S3_ENDPOINT && config.S3_BUCKET && config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY
      ? new S3Store({
          endpoint: config.S3_ENDPOINT,
          region: config.S3_REGION,
          bucket: config.S3_BUCKET,
          accessKeyId: config.S3_ACCESS_KEY_ID,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY,
        })
      : new LocalStore(config.REALM_LOCAL_MEDIA_DIR, config.REALM_SECRET);
  const pusher: Pusher = config.FIREBASE_SERVICE_ACCOUNT
    ? new FcmPusher(parseServiceAccount(config.FIREBASE_SERVICE_ACCOUNT), logger)
    : new NoopPusher();
  const livekit: LiveKitConfig | null =
    config.LIVEKIT_URL && config.LIVEKIT_API_KEY && config.LIVEKIT_API_SECRET
      ? {
          url: config.LIVEKIT_URL,
          apiKey: config.LIVEKIT_API_KEY,
          apiSecret: config.LIVEKIT_API_SECRET,
        }
      : null;
  return { storage, pusher, livekit };
}

export async function createDeps(config: Config): Promise<Deps> {
  const logger = createLogger({
    name: "api",
    level: config.LOG_LEVEL,
    pretty: !config.isProduction,
  });
  const { db, close: closeDb } = await openDb(config.DATABASE_URL, { appName: "realm-api" });
  if (config.DATABASE_URL.startsWith("pglite:")) {
    logger.warn("using the embedded database (PGlite) — development only, one process");
  }

  const kv: KeyValueStore = config.REDIS_URL
    ? RedisStore.connect(config.REDIS_URL)
    : new MemoryStore();
  const bus: EventBus = config.REDIS_URL
    ? new RedisEventBus(config.REDIS_URL)
    : new MemoryEventBus();
  if (!config.REDIS_URL) {
    logger.warn("REDIS_URL not set — using in-memory stores (single process, dev only)");
  }

  const mailer: Mailer = config.RESEND_API_KEY
    ? new ResendMailer(config.SMTP_FROM, config.RESEND_API_KEY)
    : config.SMTP_HOST
      ? new SmtpMailer(config.SMTP_FROM, {
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          user: config.SMTP_USER,
          password: config.SMTP_PASSWORD,
        })
      : new MemoryMailer(logger, { echo: config.NODE_ENV === "development" });

  const queue: JobQueue = config.REDIS_URL
    ? new RedisQueue(config.REDIS_URL, logger)
    : new MemoryQueue(logger);
  const { storage, pusher, livekit } = providers(config, logger);
  logger.info(
    {
      storage: storage.kind === "s3" ? "S3/R2" : `local folder (${config.REALM_LOCAL_MEDIA_DIR})`,
      email: config.RESEND_API_KEY ? "Resend" : config.SMTP_HOST ? "SMTP" : "log only",
      push: pusher.enabled ? "FCM" : "off",
      voice: livekit ? "LiveKit" : "off",
    },
    "providers",
  );

  return {
    config,
    logger,
    db,
    kv,
    bus,
    mailer,
    ids: new SnowflakeGenerator(config.REALM_WORKER_ID),
    limiter: new RateLimiter(kv),
    storage,
    queue,
    pusher,
    livekit,
    close: async () => {
      await Promise.allSettled([closeDb(), kv.close(), bus.close(), queue.close()]);
    },
  };
}
