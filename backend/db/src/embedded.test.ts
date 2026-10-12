import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { openDb } from "./client";
import { users } from "./schema";

const dir = mkdtempSync(join(tmpdir(), "realm-pglite-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("embedded development database (pglite:)", () => {
  it("opens migrated, and keeps its data in its folder across restarts", async () => {
    const first = await openDb(`pglite:${dir}`);
    await first.db.insert(users).values({
      id: 1n,
      username: "keeper",
      displayName: "Keeper",
      email: "keeper@example.com",
      passwordHash: "x",
      birthDate: "2000-01-01",
    });
    await first.close();

    const second = await openDb(`pglite:${dir}`);
    const rows = (await second.db.execute(
      sql`select username from users where id = 1`,
    )) as unknown as { rows: { username: string }[] };
    expect(rows.rows[0]?.username).toBe("keeper");
    await second.close();
  });

  it("can live in memory only", async () => {
    const handle = await openDb("pglite:memory");
    const result = (await handle.db.execute(sql`select 1 as one`)) as unknown as {
      rows: { one: number }[];
    };
    expect(result.rows[0]?.one).toBe(1);
    await handle.close();
  });
});
