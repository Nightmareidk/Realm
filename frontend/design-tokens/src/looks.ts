import {
  contrast,
  luminance,
  mixHex,
  type ResolvedTheme,
  resolveTheme,
  type ThemeFile,
  type ThemeLook,
} from "@realm/contracts";
import { type ThemeId, themes } from "./tokens";

/**
 * Realm's three looks as theme files (DESIGN.md): Now Playing is the default, Wristband and Plain
 * and clear are the alternatives in Settings › Themes. With a look, you also pick your colour
 * (Mint, Orchid, Aqua or Ember). They pass the same checks as anyone's theme.
 */

const NEUTRALS: Record<ThemeLook, Omit<ThemeFile["colors"], "accent" | "onAccent" | "lights">> = {
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

export function lookTheme(look: ThemeLook, accent: ThemeId = "mint"): ThemeFile {
  const a = themes[accent];
  const meta = LOOKS.find((l) => l.id === look);
  return {
    format: "realm-theme",
    version: 1,
    name: `${meta?.name ?? look} · ${a.name}`,
    look,
    colors: { ...NEUTRALS[look], accent: a.accent, onAccent: a.onAccent, lights: a.lights },
  };
}

/** Realm's default: Now Playing in Mint. */
export const DEFAULT_THEME: ResolvedTheme = resolveTheme(lookTheme("now-playing", "mint"));

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
