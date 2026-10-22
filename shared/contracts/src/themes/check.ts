import { contrast, contrastL, hexToRgb, luminance, luminanceRgb, type Rgb } from "./color";
import type { ResolvedColors, ResolvedTheme } from "./file";

/**
 * The readability checks every theme passes before anyone else can use it (docs/THEMING.md
 * §4.2.4), run the same way by the studio (as you edit) and the server (which decides).
 */

export const TEXT_CONTRAST = 4.5;
export const UI_CONTRAST = 3;

/** How bright a wallpaper gets, after Realm measured it: its darkest and brightest parts (0–1). */
export interface WallpaperLight {
  low: number;
  high: number;
}

export interface ThemeProblem {
  /** What's wrong, in plain words. */
  message: string;
  ratio: number;
  need: number;
  /** What to change to fix it. */
  fix: keyof ResolvedColors | "glow" | "dim" | "panels";
}

const NAMES: Record<keyof Omit<ResolvedColors, "lights">, string> = {
  ground: "the background",
  surface: "the panels",
  raised: "menus and bubbles",
  line: "the lines",
  text: "The main text",
  textSoft: "The second text",
  accent: "Your colour",
  onAccent: "Text on your colour",
  accent2: "The end of your button gradient",
  heading: "The section titles",
  link: "The links",
};

const round = (n: number) => Math.round(n * 10) / 10;

function pair(
  out: ThemeProblem[],
  fg: keyof ResolvedColors,
  bg: keyof ResolvedColors,
  colors: ResolvedColors,
  need: number,
) {
  const ratio = contrast(colors[fg] as string, colors[bg] as string);
  if (ratio < need) {
    const what = need === UI_CONTRAST ? "hard to see" : "hard to read";
    out.push({
      message: `${NAMES[fg as keyof typeof NAMES]} is ${what} on ${NAMES[bg as keyof typeof NAMES]} (${round(ratio)} to 1, needs ${need} to 1).`,
      ratio,
      need,
      fix: fg,
    });
  }
}

/**
 * The three soft lights as the app and the website draw them, held still (light-field.tsx and
 * globals.css `body::before`): where each sits, how wide it is, and how strong it is from its
 * middle out.
 */
const FIELDS = [
  {
    cx: 0.18,
    cy: 1,
    rx: 0.62,
    ry: 0.8,
    stops: [
      [0, 0.55],
      [0.4, 0.19],
      [0.72, 0],
    ],
  },
  {
    cx: 0.86,
    cy: 0.06,
    rx: 0.5,
    ry: 0.7,
    stops: [
      [0, 0.42],
      [0.42, 0.15],
      [0.72, 0],
    ],
  },
  {
    cx: 0.6,
    cy: 0.62,
    rx: 0.42,
    ry: 0.6,
    stops: [
      [0, 0.28],
      [0.7, 0],
    ],
  },
] as const;

function strength(stops: readonly (readonly [number, number])[], d: number): number {
  for (let i = 1; i < stops.length; i++) {
    const [d0, a0] = stops[i - 1] as readonly [number, number];
    const [d1, a1] = stops[i] as readonly [number, number];
    if (d <= d1) return a0 + ((a1 - a0) * (d - d0)) / (d1 - d0);
  }
  return 0;
}

/** The brightest the soft lights make the background, as a luminance. */
export function litPeak(t: ResolvedTheme): number {
  const ground = hexToRgb(t.colors.ground);
  if (t.style.glow <= 0) return luminanceRgb(ground);
  const lights = t.colors.lights.map(hexToRgb);
  let peak = 0;
  for (let y = 0; y <= 1.0001; y += 1 / 32) {
    for (let x = 0; x <= 1.0001; x += 1 / 32) {
      const px: Rgb = [...ground];
      FIELDS.forEach((f, i) => {
        const a =
          t.style.glow * strength(f.stops, Math.hypot((x - f.cx) / f.rx, (y - f.cy) / f.ry));
        const c = lights[i] as Rgb;
        for (let k = 0; k < 3; k++)
          px[k] = (px[k] as number) + ((c[k] as number) - (px[k] as number)) * a;
      });
      peak = Math.max(peak, luminanceRgb(px));
    }
  }
  return peak;
}

/**
 * Where a wallpaper's darkest and brightest parts end up: the picture's brightness setting, then
 * the layer over it (its colour, or the lighter and darker ends of its gradient) at `dim` strength.
 */
export function dimmedWallpaper(t: ResolvedTheme, w: WallpaperLight): WallpaperLight {
  const wp = t.art.wallpaper;
  const dim = wp?.dim ?? 1;
  const bright = wp?.brightness ?? 1;
  const ends = [wp?.overlay ?? t.colors.ground, wp?.overlay2 ?? wp?.overlay ?? t.colors.ground].map(
    luminance,
  );
  const lo = Math.min(...ends);
  const hi = Math.max(...ends);
  return {
    low: dim * lo + (1 - dim) * Math.min(1, w.low * bright),
    high: dim * hi + (1 - dim) * Math.min(1, w.high * bright),
  };
}

export function checkTheme(t: ResolvedTheme, wallpaper?: WallpaperLight): ThemeProblem[] {
  const out: ThemeProblem[] = [];
  const c = t.colors;
  for (const bg of ["ground", "surface", "raised"] as const) {
    pair(out, "text", bg, c, TEXT_CONTRAST);
    pair(out, "textSoft", bg, c, TEXT_CONTRAST);
  }
  for (const bg of ["ground", "surface"] as const) {
    pair(out, "heading", bg, c, TEXT_CONTRAST);
    pair(out, "link", bg, c, TEXT_CONTRAST);
  }
  pair(out, "onAccent", "accent", c, TEXT_CONTRAST);
  if (t.buttons.fill === "gradient") {
    const before = out.length;
    pair(out, "onAccent", "accent2", c, TEXT_CONTRAST);
    const last = out[before];
    if (last) last.fix = "accent2";
  }
  // Outline buttons write their words in your colour, on the panels.
  pair(out, "accent", "ground", c, t.buttons.fill === "outline" ? TEXT_CONTRAST : UI_CONTRAST);
  pair(out, "accent", "surface", c, t.buttons.fill === "outline" ? TEXT_CONTRAST : UI_CONTRAST);

  const peak = litPeak(t);
  for (const fg of ["text", "textSoft"] as const) {
    const ratio = contrastL(luminance(c[fg]), peak);
    if (ratio < TEXT_CONTRAST) {
      out.push({
        message: `${NAMES[fg]} is hard to read where the lights glow brightest (${round(ratio)} to 1). Turn the glow down or pick darker lights.`,
        ratio,
        need: TEXT_CONTRAST,
        fix: "glow",
      });
    }
  }

  // See-through panels: text on a panel also sits over whatever shows through it.
  if (t.panels.opacity < 1) {
    const behind =
      t.art.wallpaper && wallpaper
        ? dimmedWallpaper(t, wallpaper)
        : { low: luminance(c.ground), high: peak };
    const o = t.panels.opacity;
    const panel = luminance(c.surface);
    const lows = o * panel + (1 - o) * behind.low;
    const highs = o * panel + (1 - o) * behind.high;
    for (const fg of ["text", "textSoft"] as const) {
      const l = luminance(c[fg]);
      const ratio = Math.min(contrastL(l, lows), contrastL(l, highs));
      if (ratio < TEXT_CONTRAST) {
        out.push({
          message: `${NAMES[fg]} is hard to read on the see-through panels (${round(ratio)} to 1). Make the panels more solid.`,
          ratio,
          need: TEXT_CONTRAST,
          fix: "panels",
        });
      }
    }
  }

  if (t.art.wallpaper && wallpaper) {
    const w = dimmedWallpaper(t, wallpaper);
    for (const fg of ["text", "textSoft"] as const) {
      const l = luminance(c[fg]);
      const ratio = Math.min(contrastL(l, w.low), contrastL(l, w.high));
      if (ratio < TEXT_CONTRAST) {
        out.push({
          message: `${NAMES[fg]} is hard to read over the wallpaper (${round(ratio)} to 1). Dim the wallpaper more.`,
          ratio,
          need: TEXT_CONTRAST,
          fix: "dim",
        });
      }
    }
  }
  return out;
}

const toHex = (rgb: number[]) =>
  `#${rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}` as `#${string}`;

/** Mix two colours: 0 is `a`, 1 is `b`. */
export function mixHex(a: string, b: string, amount: number): `#${string}` {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex(x.map((v, i) => v + ((y[i] as number) - v) * amount));
}

const isDark = (hex: string) => luminance(hex) < 0.2;

/**
 * Nudge a theme until it passes: text moves towards white on dark backgrounds (or black on light
 * ones), the glow goes down, the wallpaper gets dimmer. Hues stay; only lightness moves.
 */
export function fixTheme(t: ResolvedTheme, wallpaper?: WallpaperLight): ResolvedTheme {
  let next: ResolvedTheme = {
    ...t,
    colors: { ...t.colors, lights: [...t.colors.lights] },
    style: { ...t.style },
    panels: { ...t.panels },
    buttons: { ...t.buttons },
    type: { ...t.type },
    art: { ...t.art },
  };
  const away = isDark(next.colors.ground) ? "#ffffff" : "#000000";

  for (let step = 0; step < 120; step++) {
    const problems = checkTheme(next, wallpaper);
    if (!problems.length) break;
    const p = problems[0] as ThemeProblem;
    const c = next.colors;
    if (p.fix === "glow") {
      next = { ...next, style: { ...next.style, glow: Math.max(0, round(next.style.glow - 0.1)) } };
      if (next.style.glow === 0 && checkTheme(next, wallpaper)[0]?.fix === "glow") {
        c.text = mixHex(c.text, away, 0.2);
        c.textSoft = mixHex(c.textSoft, away, 0.2);
      }
    } else if (p.fix === "dim" && next.art.wallpaper) {
      const dim = Math.min(0.95, round(next.art.wallpaper.dim + 0.05));
      next.art = { ...next.art, wallpaper: { ...next.art.wallpaper, dim } };
      if (dim === 0.95) {
        c.text = mixHex(c.text, away, 0.2);
        c.textSoft = mixHex(c.textSoft, away, 0.2);
      }
    } else if (p.fix === "onAccent") {
      const black = contrast("#0a0a0a", c.accent);
      const white = contrast("#ffffff", c.accent);
      const best = black >= white ? "#0a0a0a" : "#ffffff";
      if (c.onAccent === best || Math.max(black, white) < TEXT_CONTRAST) {
        c.accent = mixHex(c.accent, best === "#0a0a0a" ? "#ffffff" : "#000000", 0.1);
      }
      c.onAccent = best;
    } else if (p.fix === "panels") {
      next.panels = { ...next.panels, opacity: Math.min(1, round(next.panels.opacity + 0.05)) };
      if (next.panels.opacity >= 1) {
        c.text = mixHex(c.text, away, 0.2);
        c.textSoft = mixHex(c.textSoft, away, 0.2);
      }
    } else if (p.fix === "accent2") {
      c.accent2 = mixHex(c.accent2, c.onAccent === "#ffffff" ? "#000000" : "#ffffff", 0.1);
    } else if (p.fix === "accent") {
      c.accent = mixHex(c.accent, away, 0.1);
    } else if (p.fix === "text" || p.fix === "textSoft" || p.fix === "heading" || p.fix === "link") {
      c[p.fix] = mixHex(c[p.fix], away, 0.15);
    }
  }
  return next;
}
