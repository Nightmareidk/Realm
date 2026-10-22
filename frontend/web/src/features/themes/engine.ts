import {
  type MyTheme,
  PATTERN_SHAPES,
  type ResolvedTheme,
  resolveTheme,
  type ThemeArt,
} from "@realm/contracts";
import { cssVars, lookTheme, themeAttrs } from "@realm/design-tokens";

/**
 * Applying a theme on the website (docs/THEMING.md §4.8). The compiler in @realm/design-tokens is
 * the only author of theme CSS: a checked theme in, `--r-*` values and `data-*` words out, set one
 * by one on <html> (never as a pasted stylesheet). The result is kept on this device so the next
 * page opens in it before anything loads. The landing page and sign-in are never themed.
 */

export const THEME_CACHE = "realm:theme:v1";

/** Paths inside the signed-in app (the boot script and the shell only theme these). */
export const APP_PATHS =
  /^\/(home|spaces|messages|feed|explore|settings|themes(?!\/guide)|clips|search|create|u\/)/;

export const DEFAULT_THEME = resolveTheme(lookTheme("now-playing", "mint"));

export function resolveMine(my: MyTheme): ResolvedTheme {
  if (my.active.kind === "theme" && my.file) return resolveTheme(my.file);
  if (my.active.kind === "look") return resolveTheme(lookTheme(my.active.look, my.active.accent));
  return DEFAULT_THEME;
}

const mediaPath = (ref: string | undefined) => {
  const id = ref?.match(/^media:([1-9]\d{0,19})$/)?.[1];
  return id ? `/api/v1/media/${id}/raw` : null;
};

/** A five-point star's corners around (c, c). */
const star = (c: number, outer: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? outer * 0.45 : outer;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

/** The SVG drawing for a built-in pattern tile, in a checked colour. */
function patternTile(shape: string, color: string, size: number): string | null {
  if (!/^#[0-9a-f]{6}$/i.test(color) || !(PATTERN_SHAPES as readonly string[]).includes(shape))
    return null;
  const s = Math.round(36 * size);
  const c = color.toLowerCase();
  const mid = s / 2;
  const r = s * 0.12;
  const shapes: Record<string, string> = {
    dots: `<circle cx="${mid}" cy="${mid}" r="${r}" fill="${c}"/>`,
    grid: `<path d="M0 0H${s}M0 0V${s}" stroke="${c}" stroke-width="1.2" fill="none"/>`,
    stripes: `<path d="M0 ${s}L${s} 0" stroke="${c}" stroke-width="1.2" fill="none"/>`,
    checks: `<rect width="${mid}" height="${mid}" fill="${c}"/>`,
    waves: `<path d="M0 ${mid}Q${s / 4} ${s / 4} ${mid} ${mid}T${s} ${mid}" stroke="${c}" stroke-width="1.2" fill="none"/>`,
    stars: `<polygon points="${star(mid, r * 2)}" fill="${c}"/>`,
    hearts: `<path d="M${mid} ${mid + r * 1.6}C${mid - r * 3} ${mid - r * 0.2} ${mid - r * 1.2} ${mid - r * 2.4} ${mid} ${mid - r * 0.8}C${mid + r * 1.2} ${mid - r * 2.4} ${mid + r * 3} ${mid - r * 0.2} ${mid} ${mid + r * 1.6}Z" fill="${c}"/>`,
    sparkles: `<path d="M${mid} ${mid - r * 2}Q${mid + r * 0.3} ${mid - r * 0.3} ${mid + r * 2} ${mid}Q${mid + r * 0.3} ${mid + r * 0.3} ${mid} ${mid + r * 2}Q${mid - r * 0.3} ${mid + r * 0.3} ${mid - r * 2} ${mid}Q${mid - r * 0.3} ${mid - r * 0.3} ${mid} ${mid - r * 2}Z" fill="${c}"/>`,
    bats: `<path transform="translate(${mid - 12} ${mid - 12})" d="M12 8.2c-.6 0-1 .6-1.2 1.3L9.5 8.7C8.2 9.5 6 9.7 3.5 8.9c.9 1 1.4 2.3 1.4 3.6 1.2-.6 2.7-.6 3.6.2.7-.8 1.9-1 2.7-.3.3-.6.5-.9.8-.9s.5.3.8.9c.8-.7 2-.5 2.7.3.9-.8 2.4-.8 3.6-.2 0-1.3.5-2.6 1.4-3.6-2.5.8-4.7.6-6-.2l-1.3.8c-.2-.7-.6-1.3-1.2-1.3Z" fill="${c}"/>`,
    paws: `<g fill="${c}"><circle cx="${mid}" cy="${mid + r * 0.6}" r="${r}"/><circle cx="${mid - r * 1.2}" cy="${mid - r * 0.8}" r="${r * 0.45}"/><circle cx="${mid}" cy="${mid - r * 1.3}" r="${r * 0.45}"/><circle cx="${mid + r * 1.2}" cy="${mid - r * 0.8}" r="${r * 0.45}"/></g>`,
    flowers: `<g fill="${c}"><circle cx="${mid}" cy="${mid - r}" r="${r * 0.7}"/><circle cx="${mid + r}" cy="${mid}" r="${r * 0.7}"/><circle cx="${mid}" cy="${mid + r}" r="${r * 0.7}"/><circle cx="${mid - r}" cy="${mid}" r="${r * 0.7}"/></g>`,
    bolts: `<path d="M${mid + r * 0.4} ${mid - r * 2}L${mid - r} ${mid + r * 0.2}H${mid}L${mid - r * 0.4} ${mid + r * 2}L${mid + r} ${mid - r * 0.2}H${mid}Z" fill="${c}"/>`,
    notes: `<path d="M${mid + r * 0.8} ${mid - r * 2}V${mid + r}a${r * 0.8} ${r * 0.7} 0 1 1-.6-.7V${mid - r * 1.2}l-${r * 1.6}.5V${mid + r * 1.5}a${r * 0.8} ${r * 0.7} 0 1 1-.6-.7V${mid - r * 1.4}Z" fill="${c}"/>`,
  };
  const body = shapes[shape];
  return body
    ? `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">${body}</svg>`)}")`
    : null;
}

/** The art's values: the wallpaper and the pattern become CSS values the frame draws. */
function artVars(art: ThemeArt): Record<string, string> {
  const out: Record<string, string> = {};
  const wall = mediaPath(art.wallpaper?.image);
  if (wall && art.wallpaper) {
    out["--r-wallpaper"] = `url("${wall}")`;
    out["--r-wallpaper-dim"] = String(art.wallpaper.dim);
    out["--r-wallpaper-blur"] =
      art.wallpaper.blur === "strong" ? "28px" : art.wallpaper.blur === "soft" ? "10px" : "0px";
  }
  const p = art.pattern;
  if (p) {
    const img = p.shape === "image" ? mediaPath(p.image) : null;
    const tile = img ? `url("${img}")` : patternTile(p.shape, p.color, p.size);
    if (tile) {
      out["--r-pattern"] = tile;
      out["--r-pattern-opacity"] = String(p.opacity);
    }
  }
  return out;
}

const ART_KEYS = [
  "--r-wallpaper",
  "--r-wallpaper-dim",
  "--r-wallpaper-blur",
  "--r-pattern",
  "--r-pattern-opacity",
];

interface Cached {
  vars: Record<string, string>;
  attrs: Record<string, string>;
}

/** Wear a theme now, and remember it on this device. */
export function applyTheme(t: ResolvedTheme, remember = true) {
  const el = document.documentElement;
  const vars = { ...cssVars(t), ...artVars(t.art) };
  const attrs = themeAttrs(t);
  for (const k of ART_KEYS) if (!(k in vars)) el.style.removeProperty(k);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.style.colorScheme = attrs["data-scheme"] ?? "dark";
  if (!remember) return;
  try {
    localStorage.setItem(THEME_CACHE, JSON.stringify({ vars, attrs } satisfies Cached));
  } catch {
    // A full or blocked storage only means the next page opens in the default for a moment.
  }
}

/** Back to the site's own colours (leaving the app, or signing out). */
export function clearTheme(forget = false) {
  const el = document.documentElement;
  try {
    const cached = JSON.parse(localStorage.getItem(THEME_CACHE) ?? "null") as Cached | null;
    for (const k of Object.keys(cached?.vars ?? {})) el.style.removeProperty(k);
    for (const k of Object.keys(cached?.attrs ?? {})) el.removeAttribute(k);
    if (forget) localStorage.removeItem(THEME_CACHE);
  } catch {}
}

/**
 * The boot script's part (inlined in app/layout.tsx before first paint): on app pages, set the
 * remembered values. Only `--r-*` names and `data-*` attributes from the fixed list are set, and
 * only values that look like colours, numbers, words or a Realm media path.
 */
export const themeBootScript = `try{if(${APP_PATHS.toString()}.test(location.pathname)){var c=JSON.parse(localStorage.getItem("${THEME_CACHE}")||"null");if(c){var e=document.documentElement,ok=/^(#[0-9a-f]{6}|[0-9.]+(rem|px)?|url\\("(\\/api\\/v1\\/media\\/[0-9]+\\/raw|data:image\\/svg\\+xml,[^"]*)"\\))$/i;for(var k in c.vars)if(/^--r-[a-z0-9-]+$/.test(k)&&ok.test(c.vars[k]))e.style.setProperty(k,c.vars[k]);for(var a in c.attrs)if(/^data-(look|stories|posts|tabbar|bubbles|corners|icons|avatars|grain|scheme)$/.test(a)&&/^[a-z-]+$/.test(c.attrs[a]))e.setAttribute(a,c.attrs[a])}}}catch(x){}`;
