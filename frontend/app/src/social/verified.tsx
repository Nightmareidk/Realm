import type { VerifiedKind } from "@realm/contracts";
import { Icon } from "../icon";

/** The verified badge's blue, the colour people read as "checked" (Instagram, X, TikTok). */
const BLUE = "#3b9cff";

/**
 * The badge beside a verified name: blue for notable people and businesses, Realm's own colour
 * for Realm's account. Screen readers hear "verified".
 */
export function Verified({ kind, size = 16 }: { kind?: VerifiedKind | null; size?: number }) {
  if (!kind) return null;
  return (
    <Icon
      name="SealCheckFill"
      size={size}
      color={kind === "official" ? "#7ef2c4" : BLUE}
      label={kind === "official" ? "Realm's official account" : "Verified"}
    />
  );
}
