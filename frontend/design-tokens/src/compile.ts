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

/** A colour made see-through: #rrggbb plus an alpha pair. */
const alpha = (hex: string, a: number) =>
  a >= 1 ? hex : `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

const NONE = "0 0 0 0 transparent";

/** The website's font for each catalogue name (next/font sets the --font-* variables). */
const WEB_FONT: Record<string, string> = {
  funnel: "var(--font-funnel)",
  atkinson: "var(--font-atkinson)",
  system: "system-ui",
  bangers: "var(--font-bangers)",
  fredoka: "var(--font-fredoka)",
  pacifico: "var(--font-pacifico)",
  "press-start": "var(--font-press-start)",
  bebas: "var(--font-bebas)",
  righteous: "var(--font-righteous)",
  orbitron: "var(--font-orbitron)",
  "permanent-marker": "var(--font-permanent-marker)",
  comfortaa: "var(--font-comfortaa)",
  lexend: "var(--font-lexend)",
  nunito: "var(--font-nunito)",
};

/** The phone app's loaded font names: [regular or display, bold]. */
export const NATIVE_FONT: Record<string, [string, string]> = {
  funnel: ["FunnelDisplay_800ExtraBold", "FunnelDisplay_700Bold"],
  atkinson: ["AtkinsonHyperlegibleNext_400Regular", "AtkinsonHyperlegibleNext_700Bold"],
  system: ["System", "System"],
  bangers: ["Bangers_400Regular", "Bangers_400Regular"],
  fredoka: ["Fredoka_500Medium", "Fredoka_700Bold"],
  pacifico: ["Pacifico_400Regular", "Pacifico_400Regular"],
  "press-start": ["PressStart2P_400Regular", "PressStart2P_400Regular"],
  bebas: ["BebasNeue_400Regular", "BebasNeue_400Regular"],
  righteous: ["Righteous_400Regular", "Righteous_400Regular"],
  orbitron: ["Orbitron_800ExtraBold", "Orbitron_700Bold"],
  "permanent-marker": ["PermanentMarker_400Regular", "PermanentMarker_400Regular"],
  comfortaa: ["Comfortaa_400Regular", "Comfortaa_700Bold"],
  lexend: ["Lexend_400Regular", "Lexend_700Bold"],
  nunito: ["Nunito_400Regular", "Nunito_700Bold"],
};

/** The `--r-*` values for a theme; the web app applies them to <html>. */
export function cssVars(t: ResolvedTheme): Record<string, string> {
  const c = t.colors;
  const sys = systemColors(c.ground);
  const r = CORNERS[t.style.corners];
  const p = t.panels;
  const b = t.buttons;
  const solid = Math.min(1, p.opacity + 0.15);
  return {
    "--r-bg": c.ground,
    "--r-surface": alpha(c.surface, p.opacity),
    "--r-surface-raised": alpha(c.raised, solid),
    "--r-surface-sunken": alpha(c.raised, solid),
    "--r-panel-blur": p.blur === "strong" ? "22px" : p.blur === "soft" ? "10px" : "0px",
    "--r-panel-ring":
      p.border === "accent"
        ? `inset 0 0 0 1.5px ${c.accent}`
        : p.border === "line"
          ? `inset 0 0 0 1px ${c.line}`
          : NONE,
    "--r-panel-shadow":
      p.shadow === "glow"
        ? `0 0 44px -12px ${c.accent}`
        : p.shadow === "soft"
          ? "0 30px 70px -40px #000000"
          : NONE,
    "--r-btn-radius": b.shape === "square" ? "0.35rem" : b.shape === "rounded" ? "0.8rem" : "999px",
    "--r-btn-bg":
      b.fill === "gradient"
        ? `linear-gradient(135deg, ${c.accent}, ${c.accent2})`
        : b.fill === "outline"
          ? "transparent"
          : c.accent,
    "--r-btn-ink": b.fill === "outline" ? c.accent : c.onAccent,
    "--r-btn-ring": b.fill === "outline" ? `inset 0 0 0 2px ${c.accent}` : NONE,
    "--r-btn-glow": b.glow ? `0 0 24px -4px ${c.accent}` : NONE,
    "--r-heading": c.heading,
    "--r-link": c.link,
    "--r-font-display": WEB_FONT[t.type.display] ?? "var(--font-funnel)",
    "--r-font-body": WEB_FONT[t.type.body] ?? "var(--font-atkinson)",
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
    "data-headers": t.panels.headers,
    "data-glass": t.panels.opacity < 1 ? "on" : "off",
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
      surface: alpha(c.surface, t.panels.opacity),
      surfaceRaised: alpha(c.raised, Math.min(1, t.panels.opacity + 0.15)),
      surfaceSunken: alpha(c.raised, Math.min(1, t.panels.opacity + 0.15)),
      heading: c.heading,
      link: c.link,
      accent2: c.accent2,
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
    fonts: {
      display: (NATIVE_FONT[t.type.display] ?? NATIVE_FONT.funnel)?.[0] as string,
      displayBold: (NATIVE_FONT[t.type.display] ?? NATIVE_FONT.funnel)?.[1] as string,
      body: (NATIVE_FONT[t.type.body] ?? NATIVE_FONT.atkinson)?.[0] as string,
      bold: (NATIVE_FONT[t.type.body] ?? NATIVE_FONT.atkinson)?.[1] as string,
    },
    panels: t.panels,
    buttons: t.buttons,
    style: t.style,
    type: t.type,
    art: t.art,
    appIcon: t.appIcon,
  };
}
export type NativeTheme = ReturnType<typeof nativeTheme>;
