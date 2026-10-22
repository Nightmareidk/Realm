"use client";

import {
  type ActiveTheme,
  type MyTheme,
  type ResolvedTheme,
  resolveTheme,
  type ThemeFile,
} from "@realm/contracts";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError, api } from "@/lib/api";
import { applyTheme, clearTheme, DEFAULT_THEME, resolveMine } from "./engine";

interface ThemeState {
  /** What the account has on (null until it's loaded). */
  mine: MyTheme | null;
  /** What's drawn: a theme being tried on, or yours. */
  shown: ResolvedTheme;
  previewing: boolean;
  /** Switch theme: drawn at once, then saved to the account (and undone if that fails). */
  choose: (next: ActiveTheme, file?: ThemeFile) => Promise<void>;
  /** Try a theme on everywhere without saving it; null stops. */
  preview: (t: ResolvedTheme | null) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/** The signed-in app's theme: loaded from the account, worn on <html>, switched from Themes. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mine, setMine] = useState<MyTheme | null>(null);
  const [trying, setTrying] = useState<ResolvedTheme | null>(null);

  useEffect(() => {
    api<MyTheme>("/themes/active")
      .then(setMine)
      .catch(() => {});
    // Leaving the app (to the front page or sign-in) takes the theme off again.
    return () => clearTheme();
  }, []);

  const shown = useMemo(() => trying ?? (mine ? resolveMine(mine) : DEFAULT_THEME), [trying, mine]);
  useEffect(() => {
    if (mine || trying) applyTheme(shown, !trying);
  }, [shown, mine, trying]);

  const choose = useCallback(
    async (next: ActiveTheme, file?: ThemeFile) => {
      const before = mine;
      setTrying(null);
      setMine({ active: next, file: file ?? null });
      try {
        setMine(await api<MyTheme>("/themes/active", { method: "PUT", body: next }));
      } catch (err) {
        setMine(before);
        throw err instanceof ApiError ? err : new Error("The theme didn't change. Try again.");
      }
    },
    [mine],
  );

  const value = useMemo(
    () => ({ mine, shown, previewing: trying !== null, choose, preview: setTrying }),
    [mine, shown, trying, choose],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemes() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemes needs ThemeProvider");
  return ctx;
}

export const resolved = resolveTheme;
