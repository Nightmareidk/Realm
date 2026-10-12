/**
 * The front page's themes: the same four a profile can wear. The page starts in Mint; scrolling
 * through the profile canvas swaps the theme, and the page's light and action colour follow it.
 *
 * `acc` is the action colour (buttons, live marks), `on` the text on it, and `light` the three
 * colour fields the light field blends behind the page. All `acc`/`on` pairs pass 4.5:1.
 */
export type ThemeId = "mint" | "orchid" | "aqua" | "ember";

export type Theme = {
  id: ThemeId;
  name: string;
  acc: string;
  on: string;
  light: [string, string, string];
  /**
   * How strongly the light field glows in this theme. Solved per theme so its brightest point,
   * anywhere on the page, stays at a luminance of 0.075: grey text keeps 4.5:1 over it.
   */
  glow: number;
};

export const THEMES: Record<ThemeId, Theme> = {
  mint: {
    id: "mint",
    name: "Mint",
    acc: "#3ee6b0",
    on: "#04150f",
    light: ["#1fbf8f", "#2b47ff", "#0f766e"],
    glow: 0.6,
  },
  orchid: {
    id: "orchid",
    name: "Orchid",
    acc: "#cdb4ff",
    on: "#160a2e",
    light: ["#8b6bff", "#ff5f9a", "#3a2a8a"],
    glow: 0.78,
  },
  aqua: {
    id: "aqua",
    name: "Aqua",
    acc: "#5fd8ef",
    on: "#03161b",
    light: ["#14b8d6", "#2b47ff", "#1fbf8f"],
    glow: 0.55,
  },
  ember: {
    id: "ember",
    name: "Ember",
    acc: "#ffaf8a",
    on: "#1d0904",
    light: ["#ff6a3d", "#ffb547", "#c2185b"],
    glow: 0.6,
  },
};

export const THEME_ORDER: ThemeId[] = ["mint", "orchid", "aqua", "ember"];

/** Fired on window when the page's theme changes (the light field and the profile listen). */
export const THEME_EVENT = "realm:home-theme";

export function applyTheme(root: HTMLElement, id: ThemeId) {
  const t = THEMES[id];
  if (root.dataset.homeTheme === id) return;
  root.dataset.homeTheme = id;
  root.style.setProperty("--acc", t.acc);
  root.style.setProperty("--on-acc", t.on);
  for (const [i, c] of t.light.entries()) root.style.setProperty(`--l${i + 1}`, c);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: id }));
}
