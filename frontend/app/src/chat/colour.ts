import { THEME_ORDER } from "../theme";

/** A conversation's colour when nobody picked one: one of Realm's, from its id, so it stays. */
export function chatAccent(id: string): (typeof THEME_ORDER)[number] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return THEME_ORDER[h % THEME_ORDER.length] ?? "mint";
}
