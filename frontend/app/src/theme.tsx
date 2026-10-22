import {
  type MyTheme,
  type ResolvedTheme,
  resolveTheme,
  ThemeFile,
  type ThemeLook,
} from "@realm/contracts";
import {
  lookTheme,
  type NativeTheme,
  nativeTheme,
  roles,
  THEME_ORDER,
  type ThemeId,
  themes,
} from "@realm/design-tokens";
import { File, Paths } from "expo-file-system";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Platform } from "react-native";

export type { NativeTheme, ThemeId };
/**
 * Realm's look on the phone (DESIGN.md, docs/THEMING.md). Everyone starts on Now Playing in Mint.
 * In Settings › Themes they can switch to Wristband or Plain and clear, pick their colour, or use
 * a theme from their library (made by them or someone else). Screens read the theme through
 * `useStyles`, so a change redraws them without losing your place.
 *
 * `roles` is Now Playing's own set, kept for the few screens shown before sign-in.
 */
export { roles, THEME_ORDER, themes };

/** Font families as loaded in app/_layout.tsx. Funnel for statements and names, Atkinson for reading. */
export const fonts = {
  display: "FunnelDisplay_800ExtraBold",
  displayBold: "FunnelDisplay_700Bold",
  body: "AtkinsonHyperlegibleNext_400Regular",
  bold: "AtkinsonHyperlegibleNext_700Bold",
} as const;

/** UI motion (DESIGN.md Motion): exponential ease-out, nothing over 300ms; the re-light is 800ms. */
export const motion = { fast: 160, base: 220, slow: 300, relight: 800 } as const;

/** What's on: one of Realm's looks with your colour, or a theme file from your library. */
export type ThemeChoice =
  | { kind: "look"; look: ThemeLook; accent: ThemeId }
  | { kind: "theme"; themeId: string; file: ThemeFile };

const START: ThemeChoice = { kind: "look", look: "now-playing", accent: "mint" };
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
    const v = JSON.parse(raw) as ThemeChoice;
    if (v.kind === "look" && THEME_ORDER.includes(v.accent)) return v;
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
  c.kind === "look" ? resolveTheme(lookTheme(c.look, c.accent)) : resolveTheme(c.file);

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
  const t = useMemo(() => nativeTheme(resolved), [resolved]);
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
    ? { kind: "look", look: my.active.look, accent: my.active.accent }
    : START;
}

/** The current theme: its colours and choices, and ways to change it. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme needs ThemeProvider");
  const { choice, t, choose } = ctx;
  const id: ThemeId | "custom" =
    choice.kind === "look" && !ctx.previewing ? choice.accent : "custom";
  return {
    ...ctx,
    id,
    /** Your colour among Realm's four (Mint while a library theme is on). */
    accentId: (choice.kind === "look" ? choice.accent : "mint") as ThemeId,
    look: t.look,
    accent: t.colors.accent,
    onAccent: t.colors.onAccent,
    lights: t.colors.lights,
    glow: t.style.glow,
    /** Pick your colour and keep your look (the introduction and sign-up use this). */
    setTheme: (accent: ThemeId) =>
      choose({ kind: "look", look: choice.kind === "look" ? choice.look : "now-playing", accent }),
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

/** Text size in a theme: themes may make text bigger, never smaller. */
export const fs = (t: NativeTheme, size: number) => Math.round(size * t.textScale);
