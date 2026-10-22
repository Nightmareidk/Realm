import { checkTheme, resolveTheme, ThemeFile } from "@realm/contracts";
import { describe, expect, it } from "vitest";
import { cssVars, nativeTheme, themeAttrs } from "./compile";
import { DEFAULT_THEME, LOOKS, lookTheme } from "./looks";
import { PRESETS } from "./presets";
import { THEME_ORDER } from "./tokens";

describe("Realm's own looks", () => {
  it("are valid theme files that pass every readability check, in every colour", () => {
    for (const { id } of LOOKS) {
      for (const accent of THEME_ORDER) {
        const file = ThemeFile.parse(lookTheme(id, accent));
        expect(checkTheme(resolveTheme(file)), `${id} ${accent}`).toEqual([]);
      }
    }
  });

  it("makes Now Playing in Mint the default", () => {
    expect(DEFAULT_THEME.look).toBe("now-playing");
    expect(DEFAULT_THEME.colors.accent).toBe("#3ee6b0");
  });

  it("compiles to plain values only: colours, numbers and fixed words", () => {
    const vars = cssVars(DEFAULT_THEME);
    for (const [k, v] of Object.entries(vars)) {
      expect(k).toMatch(/^--r-[a-z0-9-]+$/);
      // Only colours, numbers and words: no quotes, semicolons or braces to break out of a value.
      expect(v).toMatch(/^[#a-z0-9 .,()%-]+$/);
    }
    for (const v of Object.values(themeAttrs(DEFAULT_THEME))) expect(v).toMatch(/^[a-z-]+$/);
    expect(nativeTheme(DEFAULT_THEME).radius.card).toBeGreaterThan(0);
  });
});

describe("the theme maker's starting points", () => {
  it("are valid and readable as they are", () => {
    for (const p of PRESETS) {
      const t = resolveTheme(ThemeFile.parse(p.file));
      expect(checkTheme(t).map((x) => x.message), p.id).toEqual([]);
    }
  });
});
