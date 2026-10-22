import { describe, expect, it } from "vitest";
import { checkTheme, fixTheme } from "./check";
import { mapThemeImages, resolveTheme, ThemeFile, themeImages } from "./file";

const base = {
  format: "realm-theme",
  version: 1,
  name: "Gotham Night",
  look: "now-playing",
  colors: {
    ground: "#0a0a0c",
    surface: "#141418",
    raised: "#1e1e24",
    line: "#2a2a31",
    text: "#f5f5f0",
    textSoft: "#b4b4bc",
    accent: "#FFD400",
    onAccent: "#141400",
    lights: ["#6b5a00", "#2b2b40", "#3a3a48"],
  },
};

describe("theme files", () => {
  it("reads a good theme and tidies colours", () => {
    const f = ThemeFile.parse(base);
    expect(f.colors.accent).toBe("#ffd400");
  });

  it("refuses anything that isn't plain data: CSS, web addresses, scripts, extra keys", () => {
    const bad = [
      { ...base, css: "body{display:none}" },
      { ...base, colors: { ...base.colors, accent: "red" } },
      { ...base, colors: { ...base.colors, accent: "url(https://evil.example/x)" } },
      { ...base, colors: { ...base.colors, accent: "#fff;background:url(x)" } },
      { ...base, name: "<script>alert(1)</script>" },
      { ...base, name: "a\u0000b" },
      { ...base, look: "custom" },
      { ...base, format: "css" },
      {
        ...base,
        art: { wallpaper: { image: "https://evil.example/track.png", dim: 0.5, blur: "none" } },
      },
      {
        ...base,
        art: { wallpaper: { image: "images/../../etc/passwd", dim: 0.5, blur: "none" } },
      },
      { ...base, art: { wallpaper: { image: "javascript:alert(1)", dim: 0.5, blur: "none" } } },
      { ...base, art: { wallpaper: { image: "images/a.svg", dim: 0.5, blur: "none" } } },
      { ...base, art: { wallpaper: { image: "images/a.png", dim: 0, blur: "none" } } },
      { ...base, style: { glow: 5 } },
      { ...base, type: { size: "tiny" } },
      { ...base, art: { pattern: { shape: "image", color: "#ffffff", opacity: 0.1, size: 1 } } },
      { ...base, art: { effect: { shape: "bats", color: "#ffffff", amount: "millions" } } },
      { ...base, __proto__: { polluted: true }, constructor: { prototype: { x: 1 } } },
    ];
    for (const b of bad) expect(ThemeFile.safeParse(b).success, JSON.stringify(b)).toBe(false);
  });

  it("allows the creative parts: wallpaper, pattern, stickers, effects, app icon", () => {
    const f = ThemeFile.parse({
      ...base,
      style: { icons: "bold", corners: "square" },
      art: {
        wallpaper: { image: "images/city.jpg", dim: 0.6, blur: "soft" },
        pattern: { shape: "bats", color: "#ffd400", opacity: 0.08, size: 1.2 },
        stickers: { header: "images/logo.png", empty: "media:123" },
        effect: { shape: "bats", color: "#ffd400", amount: "few" },
      },
      appIcon: "night",
    });
    expect(themeImages(f)).toEqual(["images/city.jpg", "images/logo.png", "media:123"]);
    const stored = mapThemeImages(f, (ref) => (ref === "images/city.jpg" ? "media:9" : null));
    expect(stored.art?.wallpaper?.image).toBe("media:9");
    expect(stored.art?.stickers?.header).toBeUndefined();
    expect(stored.art?.pattern?.shape).toBe("bats");
  });
});

describe("readability checks", () => {
  it("passes a readable theme", () => {
    expect(checkTheme(resolveTheme(ThemeFile.parse(base)))).toEqual([]);
  });

  it("finds faint text and fixes it without changing the idea", () => {
    const faint = resolveTheme(
      ThemeFile.parse({
        ...base,
        colors: { ...base.colors, text: "#333333", textSoft: "#222222", onAccent: "#ffee88" },
      }),
    );
    const problems = checkTheme(faint);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]?.message).toMatch(/hard to read/);
    const fixed = fixTheme(faint);
    expect(checkTheme(fixed)).toEqual([]);
    expect(fixed.colors.accent).toBe(faint.colors.accent);
  });

  it("turns down a glow that drowns the text", () => {
    const bright = resolveTheme(
      ThemeFile.parse({
        ...base,
        colors: { ...base.colors, lights: ["#ffffff", "#ffffff", "#ffffff"] },
        style: { glow: 1 },
      }),
    );
    expect(checkTheme(bright).some((p) => p.fix === "glow")).toBe(true);
    const fixed = fixTheme(bright);
    expect(checkTheme(fixed)).toEqual([]);
    expect(fixed.style.glow).toBeLessThan(1);
  });

  it("dims a bright wallpaper until text reads over it", () => {
    const t = resolveTheme(
      ThemeFile.parse({
        ...base,
        art: { wallpaper: { image: "media:1", dim: 0.2, blur: "none" } },
      }),
    );
    const bright = { low: 0.02, high: 0.9 };
    expect(checkTheme(t, bright).some((p) => p.fix === "dim")).toBe(true);
    const fixed = fixTheme(t, bright);
    expect(checkTheme(fixed, bright)).toEqual([]);
    expect(fixed.art.wallpaper?.dim).toBeGreaterThan(0.2);
  });

  it("works for light themes too (Hello Kitty pink)", () => {
    const kitty = resolveTheme(
      ThemeFile.parse({
        ...base,
        name: "Pink Bow",
        colors: {
          ground: "#fff0f5",
          surface: "#ffffff",
          raised: "#ffe3ee",
          line: "#f5c6d6",
          text: "#3a1020",
          textSoft: "#7a4a5c",
          accent: "#e0457b",
          onAccent: "#ffffff",
          lights: ["#ff9ec4", "#ffd1e3", "#ffc2d6"],
        },
        style: { glow: 0.3 },
      }),
    );
    expect(checkTheme(fixTheme(kitty))).toEqual([]);
  });

  it("keeps text readable on see-through panels over a bright wallpaper", () => {
    const t = resolveTheme(
      ThemeFile.parse({
        ...base,
        panels: { opacity: 0.4, blur: "soft" },
        art: { wallpaper: { image: "media:1", dim: 0.3, blur: "none", focus: "right" } },
      }),
    );
    const bright = { low: 0.05, high: 0.95 };
    expect(checkTheme(t, bright).some((p) => p.fix === "panels" || p.fix === "dim")).toBe(true);
    const fixed = fixTheme(t, bright);
    expect(checkTheme(fixed, bright)).toEqual([]);
  });

  it("checks gradient buttons, outline buttons, headings and links", () => {
    const t = resolveTheme(
      ThemeFile.parse({
        ...base,
        colors: { ...base.colors, accent2: "#202000", heading: "#222222", link: "#111111" },
        buttons: { fill: "gradient", shape: "square", glow: true },
        type: { display: "bangers", body: "nunito" },
      }),
    );
    const found = checkTheme(t).map((p) => p.fix);
    expect(found).toEqual(expect.arrayContaining(["accent2", "heading", "link"]));
    expect(checkTheme(fixTheme(t))).toEqual([]);
  });
});
