import { z } from "zod";

const bool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

const DEV_SECRET = "dev-only-secret-do-not-use-in-production-0000000000";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REALM_WEB_ORIGIN: z.url().default("http://localhost:3000"),
  REALM_API_PORT: z.coerce.number().int().default(4000),
  /** Interface to listen on. Defaults to every interface in production, this machine only otherwise. */
  REALM_API_HOST: z.string().optional(),
  /**
   * Development only: also trust Realm pages opened from this home network (a phone on the same
   * Wi-Fi, at http://192.168.x.x:3000). Ignored in production.
   */
  REALM_DEV_LAN: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  REALM_GATEWAY_PORT: z.coerce.number().int().default(4001),
  REALM_WORKER_ID: z.coerce.number().int().min(0).max(1023).default(1),
  /** Pepper for HMAC-hashed short codes and signed values. ≥ 32 chars in production. */
  REALM_SECRET: z.string().min(32).default(DEV_SECRET),
  REALM_TRUST_PROXY: bool.default(false),
  REALM_COOKIE_DOMAIN: z.string().optional(),
  /**
   * Also screen new passwords against Have I Been Pwned's Pwned Passwords (k-anonymity: only a
   * five-character hash prefix leaves the server). The local common-password screen always runs.
   */
  REALM_PWNED_PASSWORDS: bool.default(false),
  /** A Postgres URL, or in development `pglite:<folder>` for the embedded database. */
  DATABASE_URL: z.string().default("postgres://realm:realm@localhost:5432/realm"),
  /** When unset (dev/test only), in-memory stores are used — single process, not durable. */
  REDIS_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("Realm <no-reply@realm.localhost>"),
  /** Resend's HTTP API (https://resend.com). Takes over from SMTP when set. */
  RESEND_API_KEY: z.string().optional(),
  /**
   * Object storage for uploads, any S3-compatible service. Cloudflare R2:
   * S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com, S3_REGION=auto. Unset in
   * development: files go to REALM_LOCAL_MEDIA_DIR on this machine instead.
   */
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  REALM_LOCAL_MEDIA_DIR: z.string().default(".data/media"),
  /** LiveKit (https://livekit.io) for voice rooms, video and screen sharing. */
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  /** Where reports that need Realm itself (sexual content involving a minor) are emailed. */
  REALM_SAFETY_EMAIL: z.email().optional(),
  /**
   * The owner's inbox for warnings: storage filling up, many failed sign-ins at once. Falls back
   * to REALM_SAFETY_EMAIL; with neither, warnings only go to the log.
   */
  REALM_ALERT_EMAIL: z.email().optional(),
  /**
   * Stop taking new photos and videos once this many GB are stored (Cloudflare R2 is free up to
   * 10 GB), so storage never costs money by surprise. Emails go out at 90%, 93% and 97% of it, and
   * when it's full. 0 turns the limit off.
   */
  REALM_STORAGE_LIMIT_GB: z.coerce.number().min(0).default(10),
  /** Firebase Cloud Messaging: the service account's JSON, raw or base64. */
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
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
    if (!config.SMTP_HOST && !config.RESEND_API_KEY) missing.push("RESEND_API_KEY or SMTP_HOST");
    if (!config.S3_ENDPOINT || !config.S3_BUCKET) missing.push("S3_ENDPOINT and S3_BUCKET");
    if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
    if (config.DATABASE_URL.startsWith("pglite:")) {
      throw new Error("DATABASE_URL: the embedded database (pglite:) is for development only");
    }
  }

  return { ...config, isProduction, isTest: config.NODE_ENV === "test" };
}
