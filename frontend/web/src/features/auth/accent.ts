import type { ThemeId } from "../home/themes";

/** Where a picked colour waits until the account has it (and for the boot script after). */
export const ACCENT_KEY = "realm:accent";

/** The theme colour currently on the page (Mint when none is set). */
export function currentAccent(): ThemeId {
  const a = document.documentElement.dataset.accent;
  return a === "orchid" || a === "aqua" || a === "ember" ? a : "mint";
}

/**
 * Puts a theme colour on the whole page: the light, the action colour and the focus ring follow
 * it with the 0.8s cross-fade (globals.css registers the properties). Remembered on this device.
 */
export function applyAccent(id: ThemeId) {
  const root = document.documentElement;
  if (id === "mint") delete root.dataset.accent;
  else root.dataset.accent = id;
  try {
    localStorage.setItem(ACCENT_KEY, id);
  } catch {
    // No storage (private mode): it still applies for this page.
  }
}
