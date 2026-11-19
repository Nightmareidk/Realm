import {
  DEFAULT_PALETTE,
  type MyTheme,
  type ResolvedTheme,
  resolveTheme,
  ThemeFile,
  ThemeFontPair,
  type ThemeLook,
  ThemePalette,
} from "@realm/contracts";
import {
  FONT_PAIR_ORDER,
  FONT_PAIRS,
  INTRO_PALETTES,
  lookTheme,
  type NativeTheme,
  nativeTheme,
  PALETTE_ORDER,
  PALETTES,
  roles,
  THEME_ORDER,
  type ThemeId,
  themes,
} from "@realm/design-tokens";
import { File, Paths } from "expo-file-system";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import { BUILT_IN_FONTS, loadFont } from "./themes/fonts";

export type { NativeTheme, ThemeFontPair, ThemeId, ThemePalette };
/**
 * Realm's look on the phone (DESIGN.md, docs/THEMING.md). Everyone starts on Now Playing in
 * Afterglow, with Gabarito and Rethink Sans. In Settings › Themes they can switch to Wristband or
 * Plain and clear, pick a colour set and a font, or use a theme from their library (made by them
 * or someone else). Screens read the theme through `useStyles`, so a change redraws them without
 * losing your place.
 *
 * `themes` and `THEME_ORDER` are the four colours a chat or a Space can have; `roles` is the
 * classic neutral set, kept for the few screens drawn before the theme is known.
 */
export {
  FONT_PAIR_ORDER,
  FONT_PAIRS,
  INTRO_PALETTES,
  PALETTE_ORDER,
  PALETTES,
  roles,
  THEME_ORDER,
  themes,
};

/**
 * The classic fonts, loaded in app/_layout.tsx. Screens normally read `t.fonts` (the theme's own);
 * these are for the few places drawn before a theme is known.
 */
export const fonts = {
  display: "FunnelDisplay_800ExtraBold",
  displayBold: "FunnelDisplay_700Bold",
  body: "AtkinsonHyperlegibleNext_400Regular",
  bold: "AtkinsonHyperlegibleNext_700Bold",
} as const;

/** UI motion (DESIGN.md Motion): exponential ease-out, nothing over 300ms; the re-light is 800ms. */
export const motion = { fast: 160, base: 220, slow: 300, relight: 800 } as const;

/** What's on: one of Realm's looks in a colour set and font, or a theme file from your library. */
export type ThemeChoice =
  | { kind: "look"; look: ThemeLook; palette: ThemePalette; font: ThemeFontPair }
  | { kind: "theme"; themeId: string; file: ThemeFile };

const START: ThemeChoice = {
  kind: "look",
  look: "now-playing",
  palette: DEFAULT_PALETTE,
  font: "match",
};
const LOOK_IDS: ThemeLook[] = ["now-playing", "wristband", "plain"];
const CACHE = "realm-theme.json";

/** The last theme, kept on the phone so the app opens in it before the server answers. */
function readCache(): ThemeChoice | null {
  try {
    const raw =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(CACHE)
        : (() => {
            const f = new File(Paths.document, CACHE);
            return f.exists ? f.textSync() : null;
          })();
    if (!raw) return null;
    const v = JSON.parse(raw) as ThemeChoice | { kind: "look"; look: ThemeLook; accent: string };
    if (v.kind === "look" && LOOK_IDS.includes(v.look)) {
      // Saved before colour sets came in: Mint was everyone's default, so it moves to Afterglow.
      const old = "accent" in v ? v.accent : undefined;
      const palette =
        ThemePalette.safeParse("palette" in v ? v.palette : old === "mint" ? undefined : old)
          .data ?? DEFAULT_PALETTE;
      const font = ThemeFontPair.safeParse("font" in v ? v.font : undefined).data ?? "match";
      return { kind: "look", look: v.look, palette, font };
    }
    if (v.kind === "theme") {
      const file = ThemeFile.safeParse(v.file);
      if (file.success) return { kind: "theme", themeId: String(v.themeId), file: file.data };
    }
  } catch {
    // A broken cache only means opening in the default for a moment.
  }
  return null;
}

function writeCache(choice: ThemeChoice) {
  try {
    const raw = JSON.stringify(choice);
    if (Platform.OS === "web") globalThis.localStorage?.setItem(CACHE, raw);
    else new File(Paths.document, CACHE).write(raw);
  } catch {
    // Not fatal: the server still knows the theme.
  }
}

export const resolveChoice = (c: ThemeChoice): ResolvedTheme =>
  c.kind === "look" ? resolveTheme(lookTheme(c.look, c.palette, c.font)) : resolveTheme(c.file);

interface ThemeContextValue {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  t: NativeTheme;
  choose: (c: ThemeChoice) => void;
  /** Show a theme everywhere for a moment (trying one on) without saving it; null ends it. */
  preview: (r: ResolvedTheme | null) => void;
  previewing: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(() => readCache() ?? START);
  const [trying, setTrying] = useState<ResolvedTheme | null>(null);
  const resolved = useMemo(() => trying ?? resolveChoice(choice), [choice, trying]);
  // A theme's own fonts load when it's chosen; until then it reads in Realm's fonts.
  const [ready, setReady] = useState<Set<string>>(() => new Set(BUILT_IN_FONTS));
  const { display, body } = resolved.type;
  useEffect(() => {
    let live = true;
    for (const id of [display, body]) {
      if (ready.has(id)) continue;
      loadFont(id).then((ok) => {
        if (ok && live) setReady((r) => new Set(r).add(id));
      });
    }
    return () => {
      live = false;
    };
  }, [display, body, ready]);
  const t = useMemo(() => {
    const n = nativeTheme(resolved);
    const fallback = nativeTheme({
      ...resolved,
      type: { ...resolved.type, display: "funnel", body: "atkinson" },
    });
    return {
      ...n,
      fonts: {
        display: ready.has(display) ? n.fonts.display : fallback.fonts.display,
        displayBold: ready.has(display) ? n.fonts.displayBold : fallback.fonts.displayBold,
        body: ready.has(body) ? n.fonts.body : fallback.fonts.body,
        bold: ready.has(body) ? n.fonts.bold : fallback.fonts.bold,
      },
    };
  }, [resolved, ready, display, body]);
  const choose = useCallback((c: ThemeChoice) => {
    setChoice(c);
    setTrying(null);
    writeCache(c);
  }, []);
  const value = useMemo(
    () => ({ choice, resolved, t, choose, preview: setTrying, previewing: trying !== null }),
    [choice, resolved, t, choose, trying],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The theme as the server keeps it, turned into a choice. */
export function choiceFrom(my: MyTheme): ThemeChoice {
  if (my.active.kind === "theme" && my.file) {
    return { kind: "theme", themeId: my.active.themeId, file: my.file };
  }
  return my.active.kind === "look"
    ? { kind: "look", look: my.active.look, palette: my.active.palette, font: my.active.font }
    : START;
}

/** The current theme: its colours and choices, and ways to change it. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme needs ThemeProvider");
  const { choice, t, choose } = ctx;
  const id: ThemePalette | "custom" =
    choice.kind === "look" && !ctx.previewing ? choice.palette : "custom";
  return {
    ...ctx,
    id,
    /** Your colour set (the default while a library theme is on). */
    paletteId: choice.kind === "look" ? choice.palette : DEFAULT_PALETTE,
    look: t.look,
    accent: t.colors.accent,
    onAccent: t.colors.onAccent,
    lights: t.colors.lights,
    glow: t.style.glow,
    /** Pick a colour set and keep your look and font (the introduction uses this). */
    setTheme: (palette: ThemePalette) =>
      choose({
        kind: "look",
        look: choice.kind === "look" ? choice.look : "now-playing",
        palette,
        font: choice.kind === "look" ? choice.font : "match",
      }),
  };
}

/**
 * A screen's styles, made from the current theme. Pass a function defined outside the component
 * (so it's the same function every render); the styles are remade only when the theme changes.
 */
export function useStyles<T>(make: (t: NativeTheme) => T): T {
  const { t } = useTheme();
  return useMemo(() => make(t), [t, make]);
}

/**
 * The theme's colours where there may be no ThemeProvider yet (the crash screen, which can show
 * when the app's top level itself fails): Realm's default, in the system font, if none is there.
 */
export function useThemeIfAny(): NativeTheme {
  const ctx = useContext(ThemeContext);
  return ctx?.t ?? FALLBACK;
}
const FALLBACK: NativeTheme = nativeTheme(resolveChoice(START));

/** Text size in a theme: themes may make text bigger, never smaller. */
export const fs = (t: NativeTheme, size: number) => Math.round(size * t.textScale);
