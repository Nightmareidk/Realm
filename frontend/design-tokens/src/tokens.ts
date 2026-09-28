import { inGamut, type Oklch, oklch } from "./color";

/**
 * Realm's visual world: another universe.
 * Night is a cosmic storm: deep indigo surfaces, violet and electric-blue light, and one molten
 * amber accent that only ever marks something you can act on. Day is golden hour: warm cream
 * surfaces and a sunset-orange accent. Night is the default edition.
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
  /** Sea / page ground. */
  ground: Oklch;
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
  /** The action colour: molten amber by night, crimson coral by day. Actions only. */
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
    ground: oklch(0.15, 0.045, 278),
    panel: oklch(0.19, 0.05, 280),
    panelRaised: oklch(0.232, 0.055, 282),
    land: oklch(0.21, 0.05, 280),
    rule: oklch(0.32, 0.05, 282),
    ruleStrong: oklch(0.55, 0.05, 285),
    ink: oklch(0.97, 0.012, 285),
    inkSoft: oklch(0.85, 0.028, 285),
    inkMuted: oklch(0.73, 0.038, 285),
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
    // Sunset light: an apricot ground (never plain white), lighter warm cards floating on it,
    // deep maroon ink, and a crimson-coral action colour taken from the day sky's dusk.
    ground: oklch(0.91, 0.05, 50),
    panel: oklch(0.955, 0.028, 58),
    panelRaised: oklch(0.978, 0.016, 62),
    land: oklch(0.875, 0.058, 46),
    rule: oklch(0.82, 0.05, 42),
    ruleStrong: oklch(0.55, 0.07, 30),
    ink: oklch(0.24, 0.06, 18),
    inkSoft: oklch(0.35, 0.06, 22),
    inkMuted: oklch(0.43, 0.06, 26),
    // Crimson-coral buttons with white text; the same hue, deeper, for links and focus.
    overprint: oklch(0.48, 0.18, 28),
    overprintFill: oklch(0.56, 0.2, 30),
    overprintFillHover: oklch(0.5, 0.19, 27),
    onOverprint: oklch(0.99, 0.008, 60),
    focus: oklch(0.48, 0.18, 28),
    danger: oklch(0.5, 0.2, 12),
    success: oklch(0.46, 0.12, 160),
    shadow: oklch(0.36, 0.08, 30),
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
  /** Archivo superfamily; widths carry the cartographic label hierarchy. */
  family: "var(--font-archivo), ui-sans-serif, system-ui, sans-serif",
  width: { condensed: 78, normal: 100, semiExpanded: 112, expanded: 125 },
} as const;

/** Systemic layers only. */
export const z = { base: 0, raised: 10, sticky: 40, overlay: 60, toast: 80 } as const;
