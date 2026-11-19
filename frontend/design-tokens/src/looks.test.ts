import { checkTheme, resolveTheme, ThemeFile } from "@realm/contracts";
import { describe, expect, it } from "vitest";
import { cssVars, nativeTheme, themeAttrs } from "./compile";
import { DEFAULT_THEME, FONT_PAIR_ORDER, LOOKS, lookTheme, PALETTE_ORDER } from "./looks";
import { PRESETS } from "./presets";

describe("Realm's own looks", () => {
  it("are valid theme files that pass every readability check, in every colour set and font", () => {
    for (const { id } of LOOKS) {
      for (const palette of PALETTE_ORDER) {
        for (const font of FONT_PAIR_ORDER) {
          const file = ThemeFile.parse(lookTheme(id, palette, font));
          expect(
            checkTheme(resolveTheme(file)).map((p) => p.message),
            `${id} ${palette} ${font}`,
          ).toEqual([]);
        }
      }
    }
  });

  it("makes Now Playing in Afterglow, with Gabarito and Rethink Sans, the default", () => {
    expect(DEFAULT_THEME.look).toBe("now-playing");
    expect(DEFAULT_THEME.colors.accent).toBe("#ff8a3d");
    expect(DEFAULT_THEME.buttons.fill).toBe("gradient");
    expect(DEFAULT_THEME.type).toMatchObject({ display: "gabarito", body: "rethink" });
  });

  it("keeps the older colours in the classic fonts, and lets any font go with any colour", () => {
    const mint = resolveTheme(lookTheme("now-playing", "mint"));
    expect(mint.colors.accent).toBe("#3ee6b0");
    expect(mint.type).toMatchObject({ display: "funnel", body: "atkinson" });
    const mixed = resolveTheme(lookTheme("plain", "cobalt-volt", "classic"));
    expect(mixed.colors.ground).toBe("#0a1033");
    expect(mixed.type).toMatchObject({ display: "funnel", body: "atkinson" });
  });

  it("falls back to the default for a colour set it doesn't know", () => {
    const odd = lookTheme("now-playing", "nope" as never, "nope" as never);
    expect(odd.colors.accent).toBe("#ff8a3d");
    expect(odd.type).toMatchObject({ display: "gabarito", body: "rethink" });
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
      expect(
        checkTheme(t).map((x) => x.message),
        p.id,
      ).toEqual([]);
    }
  });
});
