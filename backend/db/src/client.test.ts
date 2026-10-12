import { describe, expect, it } from "vitest";
import { poolerAware } from "./client";

describe("pooled connections (Neon, Supabase)", () => {
  it("turns prepared statements off behind a transaction pooler", () => {
    expect(
      poolerAware("postgres://u:p@aws-0-eu.pooler.supabase.com:6543/postgres?sslmode=require")
        .prepare,
    ).toBe(false);
    expect(
      poolerAware(
        "postgres://u:p@ep-cool-1234-pooler.eu-central-1.aws.neon.tech/db?sslmode=require",
      ).prepare,
    ).toBe(false);
    expect(poolerAware("postgres://u:p@db.example.com:5432/db?sslmode=require").prepare).toBe(true);
  });

  it("takes the pgbouncer flag out of the URL", () => {
    const { url, prepare } = poolerAware("postgres://u:p@h:5432/db?pgbouncer=true&sslmode=require");
    expect(prepare).toBe(false);
    expect(url).toBe("postgres://u:p@h:5432/db?sslmode=require");
    expect(poolerAware("postgres://u:p@h:5432/db?pgbouncer=true").url).toBe(
      "postgres://u:p@h:5432/db",
    );
  });
});
