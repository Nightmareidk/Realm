import type { ThemeAccent } from "@realm/contracts";
import { THEMES } from "@/features/home/themes";
import { cx } from "@/lib/cx";

/** "Late Night Lobby" → "LN"; one word → its first two letters. */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const two =
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`
      : (words[0] ?? "").slice(0, 2);
  return two.toUpperCase();
}

/**
 * A Space's badge: its initials on its own colour (one of the four themes, paired with that
 * theme's ink so the letters keep 4.5:1). It's the Space's identity, like an avatar, not the
 * viewer's action colour. Decorative; the name always sits beside it.
 */
export function SpaceBadge({
  name,
  accent,
  size = 28,
  className,
}: {
  name: string;
  accent: ThemeAccent;
  size?: number;
  className?: string;
}) {
  const t = THEMES[accent];
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid shrink-0 place-items-center font-display font-extrabold tracking-[-0.02em]",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        fontSize: Math.round(size * 0.4),
        background: t.acc,
        color: t.on,
      }}
    >
      {initials(name)}
    </span>
  );
}

/** The wide light behind a Space's name on its invite card: the badge's colours, stretched. */
export function spaceLight(accent: ThemeAccent) {
  const t = THEMES[accent];
  return `radial-gradient(120% 140% at 0% 0%, ${t.light[0]}, transparent 58%), radial-gradient(100% 120% at 100% 10%, ${t.light[1]}, transparent 55%), radial-gradient(120% 120% at 50% 100%, ${t.light[2]}, var(--r-surface) 78%)`;
}
