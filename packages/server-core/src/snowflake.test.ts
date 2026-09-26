import { snowflakeTimestamp } from "@realm/contracts";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "./kv";
import { SnowflakeGenerator } from "./snowflake";

describe("SnowflakeGenerator", () => {
  it("produces unique, strictly increasing IDs even past 4096 per millisecond", () => {
    const gen = new SnowflakeGenerator(7, () => 1_800_000_000_000);
    let prev = -1n;
    const seen = new Set<bigint>();
    for (let i = 0; i < 10_000; i++) {
      const id = gen.next();
      expect(id > prev).toBe(true);
      seen.add(id);
      prev = id;
    }
    expect(seen.size).toBe(10_000);
  });

  it("never goes backwards when the clock does", () => {
    let now = 1_800_000_000_000;
    const gen = new SnowflakeGenerator(1, () => now);
    const a = gen.next();
    now -= 5_000;
    const b = gen.next();
    expect(b > a).toBe(true);
  });

  it("encodes the timestamp recoverable from the string form", () => {
    const at = 1_800_000_000_123;
    const id = new SnowflakeGenerator(3, () => at).next();
    expect(snowflakeTimestamp(id.toString())).toBe(at);
  });

  it("rejects out-of-range worker IDs", () => {
    expect(() => new SnowflakeGenerator(1024)).toThrow();
  });
});

describe("MemoryStore", () => {
  it("expires keys and supports single-use take", async () => {
    let now = 0;
    const kv = new MemoryStore(() => now);
    await kv.set("a", "1", 10);
    expect(await kv.take("a")).toBe("1");
    expect(await kv.get("a")).toBeNull();
    await kv.set("b", "2", 10);
    now = 11_000;
    expect(await kv.get("b")).toBeNull();
  });

  it("counts within a window", async () => {
    const kv = new MemoryStore(() => 0);
    await kv.incr("c", 60);
    const { count } = await kv.incr("c", 60);
    expect(count).toBe(2);
  });
});
