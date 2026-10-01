import { inGamut, type Oklch, oklch } from "./color";

/**
 * Realm's visual world: another universe.
 * Night is the eclipse: deep ink-indigo surfaces, violet and electric-blue light, and one molten
 * amber accent that only ever marks something you can act on. Day is the stratosphere: the hero
 * watches the sun rise over a planet from orbit, and the page below is the bright high sky you
 * descend into: ice blue turning pale cyan and, at the very end, a trace of dawn gold; crisp
 * white-blue surfaces, deep navy type, and sunrise orange for actions. Night is the default.
 */

export type Edition = "night" | "day";
export type RegionName = "spaces" | "feed" | "profiles" | "boards";

/** Each region owns one ink hue across both editions. */
export const REGION_HUES: Record<RegionName, number> = {
  spaces: 196, // electric cyan
  feed: 256, // electric blue
  profiles: 300, // nebula violet
  boards: 350, // magenta
};

export interface RegionInks {
  /** Area fill on the map. */
  fill: Oklch;
  /** Contour lines, map lettering, rules drawn in the region's ink. */
  line: Oklch;
  /** Solid swatch for badges, avatars, legend keys. */
  solid: Oklch;
  /** Readable text/ink on the page ground. */
  text: Oklch;
}

export interface EditionTokens {
  /** The page ground at the top of the page. */
  ground: Oklch;
  /** The page's sky part-way down, and at the end: the ground shifts through these as you scroll. */
  groundMid: Oklch;
  groundEnd: Oklch;
  /** Legend panels and raised surfaces. */
  panel: Oklch;
  /** A second, more raised surface (menus, popovers). */
  panelRaised: Oklch;
  /** Unclaimed land on the map. */
  land: Oklch;
  /** Hairlines, grid, dividers. */
  rule: Oklch;
  ruleStrong: Oklch;
  ink: Oklch;
  inkSoft: Oklch;
  inkMuted: Oklch;
  /** The action colour: molten amber by night, sunrise orange by day. Actions only. */
  overprint: Oklch;
  /** Overprint used as a fill behind text (buttons). */
  overprintFill: Oklch;
  overprintFillHover: Oklch;
  onOverprint: Oklch;
  /** Focus ring. */
  focus: Oklch;
  danger: Oklch;
  success: Oklch;
  shadow: Oklch;
  regions: Record<RegionName, RegionInks>;
}

const region = (
  edition: Edition,
  h: number,
  tune: Partial<Record<keyof RegionInks, Partial<Oklch>>> = {},
): RegionInks => {
  const base: RegionInks =
    edition === "night"
      ? {
          fill: oklch(0.33, 0.07, h),
          line: oklch(0.8, 0.12, h),
          solid: oklch(0.72, 0.14, h),
          text: oklch(0.84, 0.11, h),
        }
      : {
          fill: oklch(0.905, 0.065, h),
          line: oklch(0.52, 0.11, h),
          solid: oklch(0.6, 0.14, h),
          text: oklch(0.46, 0.11, h),
        };
  for (const key of Object.keys(tune) as (keyof RegionInks)[]) {
    base[key] = { ...base[key], ...tune[key] };
  }
  return base;
};

/** Reduce chroma until the colour fits sRGB, so every token renders as specified. */
function fitToGamut(color: Oklch): Oklch {
  if (inGamut(color)) return color;
  let lo = 0;
  let hi = color.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ ...color, c: mid })) lo = mid;
    else hi = mid;
  }
  return { ...color, c: Math.floor(lo * 1e4) / 1e4 };
}

function fitEdition(e: EditionTokens): EditionTokens {
  const out = { ...e, regions: { ...e.regions } } as EditionTokens;
  for (const key of Object.keys(e) as (keyof EditionTokens)[]) {
    if (key !== "regions") (out[key] as Oklch) = fitToGamut(e[key] as Oklch);
  }
  for (const name of Object.keys(e.regions) as RegionName[]) {
    const inks = e.regions[name];
    out.regions[name] = {
      fill: fitToGamut(inks.fill),
      line: fitToGamut(inks.line),
      solid: fitToGamut(inks.solid),
      text: fitToGamut(inks.text),
    };
  }
  return out;
}

const rawEditions: Record<Edition, EditionTokens> = {
  night: {
    // Deep ink-indigo, a touch less saturated than a navy, so light has somewhere to glow.
    ground: oklch(0.135, 0.036, 280),
    groundMid: oklch(0.13, 0.042, 268),
    groundEnd: oklch(0.14, 0.05, 296),
    panel: oklch(0.175, 0.04, 282),
    panelRaised: oklch(0.215, 0.045, 284),
    land: oklch(0.19, 0.04, 282),
    rule: oklch(0.29, 0.04, 284),
    ruleStrong: oklch(0.54, 0.045, 286),
    ink: oklch(0.975, 0.008, 285),
    inkSoft: oklch(0.86, 0.022, 285),
    inkMuted: oklch(0.745, 0.03, 285),
    // Molten amber: the core of the storm. Actions, focus and "needs you" only.
    overprint: oklch(0.82, 0.155, 72),
    overprintFill: oklch(0.8, 0.16, 68),
    overprintFillHover: oklch(0.86, 0.14, 76),
    onOverprint: oklch(0.22, 0.06, 50),
    focus: oklch(0.82, 0.155, 72),
    danger: oklch(0.72, 0.17, 22),
    success: oklch(0.84, 0.14, 165),
    shadow: oklch(0.06, 0.03, 280),
    regions: {
      spaces: region("night", REGION_HUES.spaces, { fill: { c: 0.06 } }),
      feed: region("night", REGION_HUES.feed),
      profiles: region("night", REGION_HUES.profiles),
      boards: region("night", REGION_HUES.boards),
    },
  },
  day: {
    // The stratosphere, never plain white: ice blue at the top of the page, pale cyan part-way
    // down, a trace of dawn gold at the very end; white-blue surfaces floating on it with cool
    // navy shadows; deep navy type; and sunrise orange for actions, with navy text on it.
    ground: oklch(0.962, 0.018, 228),
    groundMid: oklch(0.948, 0.026, 205),
    groundEnd: oklch(0.95, 0.03, 85),
    panel: oklch(0.985, 0.009, 228),
    panelRaised: oklch(0.995, 0.004, 228),
    land: oklch(0.935, 0.024, 222),
    rule: oklch(0.885, 0.022, 232),
    ruleStrong: oklch(0.56, 0.06, 252),
    ink: oklch(0.235, 0.068, 262),
    inkSoft: oklch(0.34, 0.06, 258),
    inkMuted: oklch(0.43, 0.052, 255),
    // Sunrise orange buttons with navy text; a deeper burnt orange for links and focus.
    overprint: oklch(0.52, 0.155, 45),
    overprintFill: oklch(0.645, 0.18, 50),
    overprintFillHover: oklch(0.7, 0.17, 56),
    onOverprint: oklch(0.2, 0.06, 262),
    focus: oklch(0.52, 0.155, 45),
    danger: oklch(0.5, 0.2, 18),
    success: oklch(0.46, 0.11, 165),
    shadow: oklch(0.38, 0.075, 255),
    regions: {
      spaces: region("day", REGION_HUES.spaces),
      feed: region("day", REGION_HUES.feed),
      profiles: region("day", REGION_HUES.profiles),
      boards: region("day", REGION_HUES.boards),
    },
  },
};

export const editions: Record<Edition, EditionTokens> = {
  night: fitEdition(rawEditions.night),
  day: fitEdition(rawEditions.day),
};

/** Motion: exponential ease-out for anything the user triggers; nothing over 300ms in UI. */
export const motion = {
  easeOut: "cubic-bezier(0.23, 1, 0.32, 1)",
  easeInOut: "cubic-bezier(0.77, 0, 0.175, 1)",
  easeDrawer: "cubic-bezier(0.32, 0.72, 0, 1)",
  instant: "100ms",
  fast: "160ms",
  base: "220ms",
  slow: "300ms",
  /** The one authored moment: the course drawing across the map. */
  course: "1600ms",
} as const;

/**
 * Corner language: controls 6px, panels 12px, stages 28px (the stage echoes the logo tile).
 * Circles only for things that are circles (pins, avatars, presence).
 */
export const radius = { sm: "4px", md: "6px", lg: "12px", xl: "28px", round: "999px" } as const;

/** 4px spacing grid. */
export const space = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128] as const;

export const font = {
  /** Headlines: Bricolage Grotesque, a modern editorial grotesk (optical sizes, ink traps). */
  display: "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif",
  /** Everything you read: Atkinson Hyperlegible Next, designed for legibility. */
  body: "var(--font-atkinson), ui-sans-serif, system-ui, sans-serif",
} as const;

/** Systemic layers only. */
export const z = { base: 0, raised: 10, sticky: 40, overlay: 60, toast: 80 } as const;
