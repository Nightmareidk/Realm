import { z } from "zod";

const bool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

const DEV_SECRET = "dev-only-secret-do-not-use-in-production-0000000000";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REALM_WEB_ORIGIN: z.url().default("http://localhost:3000"),
  REALM_API_PORT: z.coerce.number().int().default(4000),
  REALM_GATEWAY_PORT: z.coerce.number().int().default(4001),
  REALM_WORKER_ID: z.coerce.number().int().min(0).max(1023).default(1),
  /** Pepper for HMAC-hashed short codes and signed values. ≥ 32 chars in production. */
  REALM_SECRET: z.string().min(32).default(DEV_SECRET),
  REALM_TRUST_PROXY: bool.default(false),
  REALM_COOKIE_DOMAIN: z.string().optional(),
  DATABASE_URL: z.string().default("postgres://realm:realm@localhost:5432/realm"),
  /** When unset (dev/test only), in-memory stores are used — single process, not durable. */
  REDIS_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("Realm <no-reply@realm.localhost>"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type Config = z.infer<typeof Env> & {
  isProduction: boolean;
  isTest: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const config = parsed.data;
  const isProduction = config.NODE_ENV === "production";

  if (isProduction) {
    const missing: string[] = [];
    if (config.REALM_SECRET === DEV_SECRET) missing.push("REALM_SECRET");
    if (!config.REDIS_URL) missing.push("REDIS_URL");
    if (!config.SMTP_HOST) missing.push("SMTP_HOST");
    if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  }

  return { ...config, isProduction, isTest: config.NODE_ENV === "test" };
}
