import type { PresenceStatus, UserSummary } from "@realm/contracts";
import { THEME_ORDER, THEMES } from "@/features/home/themes";
import { cx } from "@/lib/cx";

/** A steady colour per person (from their ID) until profile pictures arrive with media. */
function colourFor(id: string) {
  let n = 0;
  for (const ch of id.slice(-6)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  const theme = THEMES[THEME_ORDER[n % THEME_ORDER.length] ?? "mint"];
  return theme;
}

export const presenceLabel: Record<PresenceStatus, string> = {
  online: "Around",
  idle: "Away for a bit",
  dnd: "Do not disturb",
  offline: "Away",
};

/** Someone's initial in their colour, with a presence dot when they're around. */
export function Avatar({
  user,
  size = 36,
  presence,
  ring = "var(--r-surface)",
  className,
}: {
  user: Pick<UserSummary, "id" | "displayName"> & { avatarUrl?: string | null };
  size?: number;
  presence?: PresenceStatus;
  /** The colour behind the dot's ring: the surface the avatar sits on. */
  ring?: string;
  className?: string;
}) {
  const t = colourFor(user.id);
  const dot = presence && presence !== "offline";
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative grid shrink-0 place-items-center rounded-full font-display font-extrabold",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42, background: t.acc, color: t.on }}
    >
      {user.avatarUrl ? (
        // biome-ignore lint/performance/noImgElement: a small uploaded picture behind an access check, not a static asset.
        <img
          src={user.avatarUrl}
          alt=""
          className="size-full rounded-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        user.displayName.trim().slice(0, 1).toUpperCase()
      )}
      {dot && (
        <span
          className={cx(
            "absolute -right-0.5 -bottom-0.5 size-3 rounded-full",
            presence === "online"
              ? "bg-presence"
              : presence === "idle"
                ? "bg-[#f5c451]"
                : "bg-danger-line",
          )}
          style={{ boxShadow: `0 0 0 2.5px ${ring}` }}
        />
      )}
    </span>
  );
}
