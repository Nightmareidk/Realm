import {
  contrast,
  DEFAULT_PALETTE,
  luminance,
  mixHex,
  type ResolvedTheme,
  resolveTheme,
  type ThemeFile,
  type ThemeFontPair,
  type ThemeLook,
  type ThemePalette,
  type ThemeType,
} from "@realm/contracts";
import { type ThemeId, themes } from "./tokens";

/**
 * Realm's three looks as theme files (DESIGN.md): Now Playing is the default, Wristband and Plain
 * and clear are the alternatives in Settings › Themes. With a look, you also pick a colour set
 * (Afterglow by default) and a font pair. They pass the same checks as anyone's theme.
 */

type Neutrals = Pick<
  ThemeFile["colors"],
  "ground" | "surface" | "raised" | "line" | "text" | "textSoft"
>;

const NEUTRALS: Record<ThemeLook, Neutrals> = {
  "now-playing": {
    ground: "#09090c",
    surface: "#121116",
    raised: "#1b1a20",
    line: "#26252c",
    text: "#f7f5f2",
    textSoft: "#a9a6b0",
  },
  wristband: {
    ground: "#0b0a0e",
    surface: "#141218",
    raised: "#1d1a22",
    line: "#3b3745",
    text: "#f6f3ee",
    textSoft: "#a39dab",
  },
  plain: {
    ground: "#0c0c0e",
    surface: "#141416",
    raised: "#1d1d20",
    line: "#2a2a2e",
    text: "#f5f5f6",
    textSoft: "#96969d",
  },
};

export const LOOKS: { id: ThemeLook; name: string; blurb: string }[] = [
  {
    id: "now-playing",
    name: "Now Playing",
    blurb: "Photos and songs light the screen with their own colours.",
  },
  {
    id: "wristband",
    name: "Wristband",
    blurb: "Stories as coloured bands, posts as ticket stubs with their song.",
  },
  {
    id: "plain",
    name: "Plain and clear",
    blurb: "Calm black and white, colour only where it counts.",
  },
];

/** The font pairs for Realm's looks (a colour set brings its own; people can pick another). */
export const FONT_PAIRS: Record<
  Exclude<ThemeFontPair, "match">,
  { name: string; blurb: string; display: ThemeType["display"]; body: ThemeType["body"] }
> = {
  gabarito: {
    name: "Gabarito",
    blurb: "Chunky and friendly titles, with Rethink Sans for reading.",
    display: "gabarito",
    body: "rethink",
  },
  figtree: {
    name: "Figtree",
    blurb: "One clean, round, modern font for everything.",
    display: "figtree",
    body: "figtree",
  },
  unbounded: {
    name: "Unbounded",
    blurb: "Wide, bold titles, with Onest for reading.",
    display: "unbounded",
    body: "onest",
  },
  classic: {
    name: "Classic",
    blurb: "Funnel Display with Atkinson Hyperlegible, made to be the easiest to read.",
    display: "funnel",
    body: "atkinson",
  },
};
export const FONT_PAIR_ORDER: ThemeFontPair[] = [
  "match",
  "gabarito",
  "figtree",
  "unbounded",
  "classic",
];

export interface Palette {
  name: string;
  blurb: string;
  /** Its own background and panels; without them, the look's own. */
  neutrals?: Neutrals;
  accent: string;
  onAccent: string;
  /** Where buttons, your messages and the + fade to; set means buttons are a gradient. */
  accent2?: string;
  lights: [string, string, string];
  link?: string;
  like?: string;
  /** Its own fonts, used while the font pair is "match". */
  fonts: Exclude<ThemeFontPair, "match">;
  /** For the picker: the colours that say what this set is. */
  swatch: [string, string, string];
}

const legacy = (id: ThemeId): Palette => ({
  name: themes[id].name,
  blurb:
    id === "mint"
      ? "How Realm looked before: near-black, grey panels and pale mint."
      : `The older look in ${themes[id].name}.`,
  accent: themes[id].accent,
  onAccent: themes[id].onAccent,
  lights: themes[id].lights,
  fonts: "classic",
  swatch: [themes[id].lights[0], themes[id].accent, themes[id].lights[1]],
});

/**
 * Realm's colour sets (picked by the owner on 2026-11-19 from rendered options). Afterglow is the
 * default: today's black with a tangerine-to-pink sunset and mint coming back for links.
 */
export const PALETTES: Record<ThemePalette, Palette> = {
  afterglow: {
    name: "Afterglow",
    blurb: "Black, with buttons and your messages fading tangerine to pink, and mint for links.",
    accent: "#ff8a3d",
    onAccent: "#1d0802",
    accent2: "#ff3d8a",
    lights: ["#e2582a", "#16a37a", "#b8185a"],
    link: "#3ee6b0",
    like: "#ff3d8a",
    fonts: "gabarito",
    swatch: ["#ff9a3d", "#ff3d8a", "#3ee6b0"],
  },
  "club-night": {
    name: "Club Night",
    blurb: "Pure black, crisp white and hot pink, with electric blue beside it.",
    neutrals: {
      ground: "#000000",
      surface: "#121214",
      raised: "#1e1e22",
      line: "#2a2a30",
      text: "#ffffff",
      textSoft: "#a7a7b1",
    },
    accent: "#ff3d7f",
    onAccent: "#1a0410",
    lights: ["#c8175a", "#2860e8", "#d9581f"],
    link: "#5aa2ff",
    like: "#ff3d7f",
    fonts: "figtree",
    swatch: ["#3d8bff", "#ff3d7f", "#ff8a3d"],
  },
  "cobalt-volt": {
    name: "Cobalt Volt",
    blurb: "Deep cobalt blue with acid lime, and pink for likes. The loudest one.",
    neutrals: {
      ground: "#0a1033",
      surface: "#121b48",
      raised: "#1c275c",
      line: "#2a3672",
      text: "#f5f7ff",
      textSoft: "#aeb8e6",
    },
    accent: "#c6ff3d",
    onAccent: "#0a1033",
    lights: ["#2f55f0", "#1597c2", "#5b2fd6"],
    link: "#8fd3ff",
    like: "#ff5c9a",
    fonts: "unbounded",
    swatch: ["#2ad1ff", "#c6ff3d", "#ff5c9a"],
  },
  "sunset-pop": {
    name: "Sunset Pop",
    blurb: "Warm plum-black, tangerine fading into hot pink, and sunny yellow highlights.",
    neutrals: {
      ground: "#140a10",
      surface: "#22121c",
      raised: "#2f1a27",
      line: "#43283a",
      text: "#fff5f0",
      textSoft: "#d4b2bf",
    },
    accent: "#ff8a3d",
    onAccent: "#1d0802",
    accent2: "#ff3d8a",
    lights: ["#e2582a", "#c41c62", "#c98a12"],
    link: "#ffc56b",
    like: "#ff3d8a",
    fonts: "gabarito",
    swatch: ["#ffd23f", "#ff7a3d", "#ff3d8a"],
  },
  mint: legacy("mint"),
  orchid: legacy("orchid"),
  aqua: legacy("aqua"),
  ember: legacy("ember"),
};

/** The order the colour sets are offered in. */
export const PALETTE_ORDER: ThemePalette[] = [
  "afterglow",
  "club-night",
  "cobalt-volt",
  "sunset-pop",
  "mint",
  "orchid",
  "aqua",
  "ember",
];

/** The colour sets sign-up offers (and the app's introduction swipes through), Afterglow first. */
export const INTRO_PALETTES: ThemePalette[] = [
  "afterglow",
  "club-night",
  "cobalt-volt",
  "sunset-pop",
];

const known = (p: string): p is ThemePalette => Object.hasOwn(PALETTES, p);

/** The font pair a choice comes to ("match" follows the colour set). */
export function fontPairOf(palette: ThemePalette, font: ThemeFontPair = "match") {
  const own = PALETTES[known(palette) ? palette : DEFAULT_PALETTE].fonts;
  return FONT_PAIRS[font === "match" || !Object.hasOwn(FONT_PAIRS, font) ? own : font];
}

/**
 * One of Realm's looks in a colour set and a font pair, as a theme file. The four older colours
 * (Mint, Orchid, Aqua, Ember) are colour sets too.
 */
export function lookTheme(
  look: ThemeLook,
  palette: ThemePalette = DEFAULT_PALETTE,
  font: ThemeFontPair = "match",
): ThemeFile {
  const id = known(palette) ? palette : DEFAULT_PALETTE;
  const p = PALETTES[id];
  const meta = LOOKS.find((l) => l.id === look);
  const pair = fontPairOf(id, font);
  return {
    format: "realm-theme",
    version: 1,
    name: `${meta?.name ?? look} · ${p.name}`,
    look,
    colors: {
      ...(p.neutrals ?? NEUTRALS[look]),
      accent: p.accent,
      onAccent: p.onAccent,
      lights: p.lights,
      ...(p.accent2 ? { accent2: p.accent2 } : {}),
      ...(p.link ? { link: p.link } : {}),
      ...(p.like ? { like: p.like } : {}),
    },
    ...(p.accent2 ? { buttons: { fill: "gradient" as const } } : {}),
    type: { display: pair.display, body: pair.body },
  };
}

/** Realm's default: Now Playing in Afterglow, with Gabarito and Rethink Sans. */
export const DEFAULT_THEME: ResolvedTheme = resolveTheme(lookTheme("now-playing"));

/** Colours that stay meaning the same thing in every theme, tuned for a dark or a light ground. */
export function systemColors(ground: string) {
  const light = luminance(ground) > 0.4;
  return light
    ? { danger: "#b3261e", dangerLine: "#b3261e", success: "#17713f", presence: "#13803f" }
    : { danger: "#ffa8b2", dangerLine: "#ff5c6c", success: "#6ee7a8", presence: "#4ee08a" };
}

/** An input's edge: visible against the ground (3:1), quieter than text. */
export function strongLine(t: ResolvedTheme): string {
  for (const amount of [0.45, 0.6, 0.75]) {
    const c = mixHex(t.colors.ground, t.colors.textSoft, amount);
    if (contrast(c, t.colors.ground) >= 3 && contrast(c, t.colors.surface) >= 3) return c;
  }
  return t.colors.textSoft;
}
