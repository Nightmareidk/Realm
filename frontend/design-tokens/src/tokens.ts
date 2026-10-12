/**
 * Realm's visual world (DESIGN.md): "Your group and your profile, in motion". An ink ground lit by
 * soft colour fields in the person's theme, quiet neutral surfaces, Funnel Display for statements
 * and Atkinson Hyperlegible Next for reading, and one theme colour that marks what you can press.
 *
 * Tokens use the public role names from docs/THEMING.md §4.2.1 (`text`, `surface`, `accent`, …):
 * themes write roles, components read roles. Night is the only edition until a day edition is
 * designed in this world.
 */

/** A colour as sRGB hex; contrast is checked in tokens.test.ts. */
export type Hex = `#${string}`;

export type ThemeId = "mint" | "orchid" | "aqua" | "ember";

export interface ThemeTokens {
  name: string;
  /** The action colour: one pressed thing per screen, focus rings, "needs you" counts. */
  accent: Hex;
  /** Text and icons on an accent fill. */
  onAccent: Hex;
  /** The three lights of the field behind the page. */
  lights: [Hex, Hex, Hex];
  /**
   * How strongly the light field glows: solved per theme so its brightest point stays at a
   * relative luminance of 0.075, where every grey text role keeps 4.5:1.
   */
  glow: number;
}

/** The person's theme: Mint by default; Orchid, Aqua and Ember to choose from. */
export const themes: Record<ThemeId, ThemeTokens> = {
  mint: {
    name: "Mint",
    accent: "#3ee6b0",
    onAccent: "#04150f",
    lights: ["#1fbf8f", "#2b47ff", "#0f766e"],
    glow: 0.6,
  },
  orchid: {
    name: "Orchid",
    accent: "#cdb4ff",
    onAccent: "#160a2e",
    lights: ["#8b6bff", "#ff5f9a", "#3a2a8a"],
    glow: 0.78,
  },
  aqua: {
    name: "Aqua",
    accent: "#5fd8ef",
    onAccent: "#03161b",
    lights: ["#14b8d6", "#2b47ff", "#1fbf8f"],
    glow: 0.55,
  },
  ember: {
    name: "Ember",
    accent: "#ffaf8a",
    onAccent: "#1d0904",
    lights: ["#ff6a3d", "#ffb547", "#c2185b"],
    glow: 0.6,
  },
};

export const THEME_ORDER: ThemeId[] = ["mint", "orchid", "aqua", "ember"];

/** The brightest the light field may get anywhere (relative luminance); see `glow`. */
export const FIELD_PEAK_LUMINANCE = 0.075;

/** The neutral roles, the same in every theme. */
export const roles = {
  /** The ink ground the light falls on. */
  bg: "#0b0b0e",
  /** Panels, frames, the app's columns. */
  surface: "#141419",
  /** Menus, selected rows, raised controls. */
  surfaceRaised: "#1d1d24",
  /** Inside a surface: message bubbles, boxes. */
  surfaceSunken: "#1b1b22",
  /** Hairlines and dividers (decorative). */
  border: "#2a2a33",
  /** Edges that identify a control (inputs): 3:1 against the ground. */
  borderStrong: "#6f6c7b",
  text: "#f5f4f2",
  textSoft: "#c8c6cf",
  textMuted: "#c0bec8",
  /** Errors and destructive actions, as text and icons (always with words, never colour alone). */
  danger: "#ffa8b2",
  /** The edge of a field in error. */
  dangerLine: "#ff5c6c",
  success: "#6ee7a8",
  /** Someone is here now. */
  presence: "#4ee08a",
  shadow: "#000000",
} satisfies Record<string, Hex>;

/** Motion: exponential ease-out for anything the user triggers; nothing over 300ms in UI. */
export const motion = {
  easeOut: "cubic-bezier(0.23, 1, 0.32, 1)",
  easeInOut: "cubic-bezier(0.77, 0, 0.175, 1)",
  easeDrawer: "cubic-bezier(0.32, 0.72, 0, 1)",
  instant: "100ms",
  fast: "160ms",
  base: "220ms",
  slow: "300ms",
  /** The theme cross-fade (the colour and the light follow a new pick). */
  theme: "800ms",
} as const;

/**
 * Corner language (DESIGN.md Shapes): everything you press or read as a status is a pill; content
 * holders are rounded rectangles, nested (frame 1.8rem › box 1.2rem › card 0.9rem); inputs 0.9rem.
 */
export const radius = {
  card: "0.9rem",
  input: "0.9rem",
  box: "1.2rem",
  frame: "1.8rem",
  round: "999px",
} as const;

export const font = {
  /** Statements: Funnel Display 800, set tight. */
  display: "var(--font-funnel), ui-sans-serif, system-ui, sans-serif",
  /** Everything you read: Atkinson Hyperlegible Next. */
  body: "var(--font-atkinson), ui-sans-serif, system-ui, sans-serif",
} as const;

/** Systemic layers only. */
export const z = { base: 0, raised: 10, sticky: 40, overlay: 60, toast: 80 } as const;
