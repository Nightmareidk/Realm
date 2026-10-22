import type { ResolvedTheme } from "@realm/contracts";
import { strongLine, systemColors } from "./looks";

/**
 * The only place theme CSS comes from (docs/THEMING.md §3.4): a checked theme in, CSS custom
 * properties and data attributes out. Nothing a theme file says is pasted into CSS as text; every
 * value is a colour, a number or one word from a fixed list.
 */

const CORNERS = {
  square: { card: "0.3rem", input: "0.35rem", box: "0.45rem", frame: "0.7rem", media: "0.4rem" },
  soft: { card: "0.9rem", input: "0.9rem", box: "1.2rem", frame: "1.8rem", media: "1.1rem" },
  round: { card: "1.25rem", input: "1.4rem", box: "1.6rem", frame: "2.2rem", media: "1.75rem" },
} as const;

const TEXT_SCALE = { normal: 1, large: 1.1, larger: 1.2 } as const;

/** The `--r-*` values for a theme; the web app applies them to <html>. */
export function cssVars(t: ResolvedTheme): Record<string, string> {
  const c = t.colors;
  const sys = systemColors(c.ground);
  const r = CORNERS[t.style.corners];
  return {
    "--r-bg": c.ground,
    "--r-surface": c.surface,
    "--r-surface-raised": c.raised,
    "--r-surface-sunken": c.raised,
    "--r-border": c.line,
    "--r-border-strong": strongLine(t),
    "--r-text": c.text,
    "--r-text-soft": c.textSoft,
    "--r-text-muted": c.textSoft,
    "--r-accent": c.accent,
    "--r-on-accent": c.onAccent,
    "--r-light-1": c.lights[0],
    "--r-light-2": c.lights[1],
    "--r-light-3": c.lights[2],
    "--r-glow": String(t.style.glow),
    "--r-danger": sys.danger,
    "--r-danger-line": sys.dangerLine,
    "--r-success": sys.success,
    "--r-presence": sys.presence,
    "--r-radius-card": r.card,
    "--r-radius-input": r.input,
    "--r-radius-box": r.box,
    "--r-radius-frame": r.frame,
    "--r-radius-media": r.media,
    "--r-text-scale": String(TEXT_SCALE[t.type.size]),
  };
}

/** The choices that change layout, as `data-*` attributes the components style themselves by. */
export function themeAttrs(t: ResolvedTheme): Record<string, string> {
  return {
    "data-look": t.look,
    "data-stories": t.style.stories,
    "data-posts": t.style.posts,
    "data-tabbar": t.style.tabBar,
    "data-bubbles": t.style.bubbles,
    "data-corners": t.style.corners,
    "data-icons": t.style.icons,
    "data-avatars": t.style.avatars,
    "data-grain": t.style.grain ? "on" : "off",
    "data-scheme": luminanceScheme(t),
  };
}

const luminanceScheme = (t: ResolvedTheme) => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(t.colors.ground.slice(i, i + 2), 16));
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number) > 140
    ? "light"
    : "dark";
};

/** The same theme for the phone app (React Native styles take plain numbers and colours). */
export function nativeTheme(t: ResolvedTheme) {
  const c = t.colors;
  const sys = systemColors(c.ground);
  const rem = (v: string) => Math.round(Number.parseFloat(v) * 16);
  const r = CORNERS[t.style.corners];
  return {
    look: t.look,
    scheme: luminanceScheme(t),
    colors: {
      bg: c.ground,
      surface: c.surface,
      surfaceRaised: c.raised,
      surfaceSunken: c.raised,
      border: c.line,
      borderStrong: strongLine(t),
      text: c.text,
      textSoft: c.textSoft,
      textMuted: c.textSoft,
      accent: c.accent,
      onAccent: c.onAccent,
      lights: c.lights,
      ...sys,
      shadow: "#000000",
    },
    radius: {
      card: rem(r.card),
      input: rem(r.input),
      box: rem(r.box),
      frame: rem(r.frame),
      media: rem(r.media),
    },
    textScale: TEXT_SCALE[t.type.size],
    style: t.style,
    type: t.type,
    art: t.art,
    appIcon: t.appIcon,
  };
}
export type NativeTheme = ReturnType<typeof nativeTheme>;
