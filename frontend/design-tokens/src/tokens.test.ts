import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrast, inGamut } from "./color";
import { buildCss } from "./css";
import { type Edition, editions, type RegionName } from "./tokens";

const EDITIONS: Edition[] = ["night", "day"];
const REGIONS: RegionName[] = ["spaces", "feed", "profiles", "boards"];

describe.each(EDITIONS)("%s edition", (name) => {
  const e = editions[name];

  it("keeps body text at WCAG AA or better on every surface", () => {
    for (const surface of [e.ground, e.groundMid, e.groundEnd, e.panel, e.land]) {
      expect(contrast(e.ink, surface)).toBeGreaterThanOrEqual(7);
      expect(contrast(e.inkSoft, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(e.inkMuted, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the overprint accessible as text, button fill, and focus ring", () => {
    for (const sky of [e.ground, e.groundMid, e.groundEnd]) {
      expect(contrast(e.overprint, sky)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(e.overprintFill, sky)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(e.onOverprint, e.overprintFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(e.onOverprint, e.overprintFillHover)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(e.overprintFill, e.ground)).toBeGreaterThanOrEqual(3);
    expect(contrast(e.focus, e.ground)).toBeGreaterThanOrEqual(3);
    expect(contrast(e.ruleStrong, e.ground)).toBeGreaterThanOrEqual(3);
  });

  it.each(REGIONS)("region %s is legible on the ground and on its own fill", (region) => {
    const inks = e.regions[region];
    expect(contrast(inks.text, e.ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(inks.text, inks.fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(e.ink, inks.fill)).toBeGreaterThanOrEqual(7);
  });

  it("stays inside the sRGB gamut", () => {
    const all = [
      ...Object.entries(e)
        .filter(([k]) => k !== "regions")
        .map(([, v]) => v),
      ...REGIONS.flatMap((r) => Object.values(e.regions[r])),
    ];
    for (const color of all) expect(inGamut(color as never)).toBe(true);
  });
});

describe("generated CSS", () => {
  it("is up to date with the token source", () => {
    const file = readFileSync(fileURLToPath(new URL("../tokens.css", import.meta.url)), "utf8");
    expect(file.replace(/\r\n/g, "\n")).toBe(buildCss());
  });
});
