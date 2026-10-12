import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const production = {
  NODE_ENV: "production",
  REALM_SECRET: "a-real-secret-that-is-long-enough-for-production-use",
  REDIS_URL: "rediss://default:pw@example.upstash.io:6379",
  RESEND_API_KEY: "re_test",
  S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  S3_BUCKET: "realm-media",
};

describe("config", () => {
  it("accepts a complete production configuration", () => {
    const config = loadConfig({ ...production, DATABASE_URL: "postgres://db/realm" });
    expect(config.isProduction).toBe(true);
  });

  it("takes SMTP instead of Resend", () => {
    const { RESEND_API_KEY: _, ...rest } = production;
    const config = loadConfig({
      ...rest,
      SMTP_HOST: "smtp.example.com",
      DATABASE_URL: "postgres://db/realm",
    });
    expect(config.SMTP_HOST).toBe("smtp.example.com");
  });

  it("refuses the embedded development database in production", () => {
    expect(() => loadConfig({ ...production, DATABASE_URL: "pglite:.data/pglite" })).toThrow(
      /development only/,
    );
  });

  it("refuses production without its secrets and services", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(
      /REALM_SECRET, REDIS_URL, RESEND_API_KEY or SMTP_HOST, S3_ENDPOINT and S3_BUCKET/,
    );
  });
});
