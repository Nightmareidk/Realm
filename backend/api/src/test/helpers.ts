import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestDb } from "@realm/db/testing";
import {
  createLogger,
  LocalStore,
  loadConfig,
  MemoryEventBus,
  MemoryMailer,
  MemoryQueue,
  MemoryStore,
  NoopPusher,
  RateLimiter,
  SnowflakeGenerator,
} from "@realm/server-core";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { buildApp } from "../app";
import type { Deps } from "../deps";

export const WEB_ORIGIN = "http://localhost:3000";

export interface TestContext {
  app: FastifyInstance;
  deps: Deps;
  mailer: MemoryMailer;
  bus: MemoryEventBus;
  queue: MemoryQueue;
  pusher: NoopPusher;
  close: () => Promise<void>;
}

/** A full API instance over an in-memory Postgres, KV, bus and mailbox. */
export async function createTestApp(): Promise<TestContext> {
  const config = loadConfig({ NODE_ENV: "test", REALM_WEB_ORIGIN: WEB_ORIGIN, LOG_LEVEL: "fatal" });
  const { db, close: closeDb } = await createTestDb();
  const kv = new MemoryStore();
  const mailer = new MemoryMailer();
  const bus = new MemoryEventBus();
  const queue = new MemoryQueue();
  const pusher = new NoopPusher();
  const deps: Deps = {
    config,
    logger: createLogger({ name: "test", level: "fatal" }),
    db,
    kv,
    bus,
    mailer,
    ids: new SnowflakeGenerator(1),
    limiter: new RateLimiter(kv),
    storage: new LocalStore(mkdtempSync(join(tmpdir(), "realm-test-media-")), config.REALM_SECRET),
    queue,
    pusher,
    livekit: { url: "wss://test.livekit.cloud", apiKey: "APItest", apiSecret: "secret-for-tests" },
    close: async () => {
      await queue.drain();
      await closeDb();
    },
  };
  const app = await buildApp(deps);
  return {
    app,
    deps,
    mailer,
    bus,
    queue,
    pusher,
    close: async () => {
      await app.close();
      await deps.close();
    },
  };
}

/** Pull the `realm_session` cookie out of a response. */
export function sessionCookie(res: LightMyRequestResponse): string | undefined {
  return res.cookies.find((c) => c.name === "realm_session")?.value;
}

/** Headers a browser on the web origin would send with a cookie. */
export function browser(cookie?: string) {
  return {
    origin: WEB_ORIGIN,
    ...(cookie ? { cookie: `realm_session=${cookie}` } : {}),
  };
}

let counter = 0;
export function newAccount(overrides: Partial<Record<string, string>> = {}) {
  counter += 1;
  return {
    email: `player${counter}@example.com`,
    username: `player_${counter}`,
    displayName: `Player ${counter}`,
    password: "correct horse battery staple",
    birthDate: "2001-04-12",
    ...overrides,
  };
}
