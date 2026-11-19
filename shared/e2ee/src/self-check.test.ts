import { describe, expect, it } from "vitest";
import { runSelfCheck } from "./self-check";

describe("runSelfCheck", () => {
  it("passes every step with Realm's crypto provider", async () => {
    const steps = await runSelfCheck(() => Date.now(), 5);
    expect(steps.filter((s) => !s.ok)).toEqual([]);
    expect(steps).toHaveLength(7);
  }, 60_000);
});
