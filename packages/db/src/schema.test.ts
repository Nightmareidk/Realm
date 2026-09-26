import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "./client";
import { channels, communities, messages, users } from "./schema";
import { createTestDb } from "./testing";

let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

const baseUser = {
  displayName: "Ada",
  passwordHash: "x",
  birthDate: "2000-01-01",
};

describe("schema", () => {
  it("applies all migrations to a fresh database", async () => {
    // Test DB is PGlite, whose results carry `.rows`.
    const result = (await handle.db.execute(
      sql`select count(*)::int as count from information_schema.tables where table_schema = 'public'`,
    )) as unknown as { rows: { count: number }[] };
    expect(result.rows[0]?.count).toBeGreaterThan(20);
  });

  it("enforces case-insensitive unique usernames and emails", async () => {
    await handle.db
      .insert(users)
      .values({ id: 1n, username: "ada", email: "ada@example.com", ...baseUser });
    await expect(
      handle.db
        .insert(users)
        .values({ id: 2n, username: "ADA", email: "other@example.com", ...baseUser }),
    ).rejects.toThrow();
    await expect(
      handle.db
        .insert(users)
        .values({ id: 3n, username: "grace", email: "Ada@Example.com", ...baseUser }),
    ).rejects.toThrow();
  });

  it("round-trips 64-bit snowflakes without precision loss", async () => {
    const big = 9_007_199_254_740_993n; // 2^53 + 1 — unrepresentable as a JS number
    await handle.db.insert(communities).values({ id: big, slug: "big", name: "Big", ownerId: 1n });
    await handle.db.insert(channels).values({ id: big + 1n, type: "text", communityId: big });
    await handle.db.insert(messages).values({
      id: big + 2n,
      channelId: big + 1n,
      authorId: 1n,
      content: "hello",
      mentions: [big],
    });
    const [row] = await handle.db
      .select()
      .from(messages)
      .where(eq(messages.id, big + 2n));
    expect(row?.channelId).toBe(big + 1n);
    expect(row?.mentions).toEqual([big]);
  });
});
