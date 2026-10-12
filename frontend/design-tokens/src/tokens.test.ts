import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrast, contrastL, fieldPeak, luminance } from "./color";
import { buildCss } from "./css";
import { FIELD_PEAK_LUMINANCE, roles, THEME_ORDER, themes } from "./tokens";

const SURFACES = [roles.bg, roles.surface, roles.surfaceRaised, roles.surfaceSunken];
const TEXT = [roles.text, roles.textSoft, roles.textMuted];

describe("neutral roles", () => {
  it("keeps every text role at 4.5:1 or better on every surface", () => {
    for (const s of SURFACES)
      for (const t of TEXT) expect(contrast(t, s)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps every text role at 4.5:1 on the light field's brightest allowed point", () => {
    for (const t of [...TEXT, roles.danger]) {
      expect(contrastL(luminance(t), FIELD_PEAK_LUMINANCE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives controls and error edges a 3:1 boundary against the ground and surfaces", () => {
    for (const s of SURFACES) {
      expect(contrast(roles.borderStrong, s)).toBeGreaterThanOrEqual(3);
      expect(contrast(roles.dangerLine, s)).toBeGreaterThanOrEqual(3);
      expect(contrast(roles.presence, s)).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps danger and success readable as text", () => {
    for (const s of SURFACES) {
      expect(contrast(roles.danger, s)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(roles.success, s)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe.each(THEME_ORDER)("%s theme", (id) => {
  const t = themes[id];

  it("keeps its light field at or under the allowed peak", () => {
    expect(fieldPeak(t.lights, t.glow)).toBeLessThanOrEqual(FIELD_PEAK_LUMINANCE + 0.002);
  });

  it("keeps the action colour readable as text and as a fill", () => {
    for (const s of SURFACES) expect(contrast(t.accent, s)).toBeGreaterThanOrEqual(4.5);
    expect(contrastL(luminance(t.accent), FIELD_PEAK_LUMINANCE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("stays apart from the danger colour, so an error never reads as an action", () => {
    expect(t.accent.toLowerCase()).not.toBe(roles.danger.toLowerCase());
  });
});

describe("generated CSS", () => {
  it("is up to date with the token source", () => {
    const file = readFileSync(fileURLToPath(new URL("../tokens.css", import.meta.url)), "utf8");
    expect(file.replace(/\r\n/g, "\n")).toBe(buildCss());
  });
});
