import { roles, THEME_ORDER, type ThemeId, themes } from "@realm/design-tokens";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

export type { ThemeId };
/**
 * The same world as the web app (DESIGN.md): the ink ground, the neutral roles, and the person's
 * theme (Mint until they pick one). The introduction changes it as you swipe, sign-up starts the
 * account in it, and signing in sets it from the account.
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

const ThemeContext = createContext<{ id: ThemeId; set: (id: ThemeId) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, set] = useState<ThemeId>("mint");
  const value = useMemo(() => ({ id, set }), [id]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The current theme: its id, its colours, and a way to change it. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme needs ThemeProvider");
  return { ...themes[ctx.id], id: ctx.id, setTheme: ctx.set };
}
