import type { ActiveTheme, MyTheme, ThemeFile } from "@realm/contracts";
import { useCallback } from "react";
import { Alert } from "react-native";
import { ApiError, api } from "../server";
import { choiceFrom, type ThemeChoice, useTheme } from "../theme";

/**
 * Switching themes: the phone changes at once, then the account remembers it (so the website and
 * your other devices follow). If the server says no, the phone goes back to what it had.
 */
export function useApplyTheme() {
  const { choose, choice } = useTheme();
  return useCallback(
    async (next: ThemeChoice) => {
      const before = choice;
      choose(next);
      const body: ActiveTheme =
        next.kind === "look"
          ? { kind: "look", look: next.look, accent: next.accent }
          : { kind: "theme", themeId: next.themeId };
      try {
        const mine = await api<MyTheme>("/themes/active", { method: "PUT", body });
        choose(choiceFrom(mine));
      } catch (err) {
        choose(before);
        Alert.alert("Theme not changed", err instanceof ApiError ? err.message : "Try again.");
      }
    },
    [choose, choice],
  );
}

/** Use a theme from your library: fetch its newest file, then switch. */
export async function themeChoice(themeId: string): Promise<ThemeChoice> {
  const { file } = await api<{ file: ThemeFile }>(`/themes/${themeId}/file`);
  return { kind: "theme", themeId, file };
}

export const price = (cents: number) => (cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`);
