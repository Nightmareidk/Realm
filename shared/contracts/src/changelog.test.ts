import { describe, expect, it } from "vitest";
import { CHANGELOG, changelogAnchor, changesSince, compareVersions } from "./changelog";

describe("the changelog", () => {
  it("goes newest first, one entry per version, with real dates", () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      const newer = CHANGELOG[i - 1];
      const older = CHANGELOG[i];
      if (!newer || !older) continue;
      expect(compareVersions(newer.version, older.version)).toBeGreaterThan(0);
      expect(newer.date >= older.date).toBe(true);
    }
    for (const e of CHANGELOG) {
      expect(e.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(e.date))).toBe(false);
    }
  });

  it("keeps highlights short enough for a phone card", () => {
    for (const e of CHANGELOG) {
      expect(e.highlights.length).toBeGreaterThanOrEqual(1);
      expect(e.highlights.length).toBeLessThanOrEqual(5);
      for (const h of e.highlights) expect(h.length).toBeLessThanOrEqual(110);
      expect(e.sections.length).toBeGreaterThan(0);
    }
  });

  it("compares versions number by number", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0")).toBe(0);
    expect(compareVersions("0.1.0", "0.2.0")).toBeLessThan(0);
    expect(changelogAnchor("0.12.3")).toBe("v0-12-3");
  });

  it("finds only what came after the version someone last saw", () => {
    const newest = CHANGELOG[0]?.version ?? "0.0.0";
    expect(changesSince(newest, newest)).toEqual([]);
    expect(changesSince("0.0.0", newest).map((e) => e.version)).toContain(newest);
    expect(changesSince("0.0.0", "0.0.1")).toEqual([]);
  });
});
