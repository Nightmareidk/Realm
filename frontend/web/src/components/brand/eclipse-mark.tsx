import { cx } from "@/lib/cx";

/**
 * Realm's mark, "Eclipse": a dark world edged by light, with a small star. The moment just
 * before you arrive somewhere new.
 *
 * The mark follows the edition through CSS variables (set in globals.css): by night the rim
 * burns molten amber into violet and electric blue, like the storm around the black hole; by
 * day the disc glows like the sun and the rim turns gold, orange and rose. `AURORA` stays for
 * code that needs fixed colours.
 */
export const AURORA = {
  midnight: "#08081e",
  lime: "#ffb23d",
  amber: "#ffb23d",
  teal: "#29d7d9",
  blue: "#4998fe",
  violet: "#a76ef8",
  pink: "#fb55b1",
  star: "#f3f4ff",
} as const;

export function EclipseMark({
  variant = "plain",
  size,
  className,
  title,
}: {
  /** plain: the mark alone. tile: on the app-icon tile. */
  variant?: "plain" | "tile";
  size?: number;
  className?: string;
  title?: string;
}) {
  const id = `eclipse-${variant}`;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: the <title> is rendered when `title` is set; otherwise the mark is aria-hidden.
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cx("shrink-0 overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}-rim`} x1="0.1" y1="0.9" x2="0.9" y2="0.1">
          <stop offset="0" style={{ stopColor: "var(--mark-a)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--mark-b)" }} />
          <stop offset="1" style={{ stopColor: "var(--mark-c)" }} />
        </linearGradient>
        <radialGradient id={`${id}-disc`} cx="0.4" cy="0.38" r="0.7">
          <stop offset="0" style={{ stopColor: "var(--mark-disc-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--mark-disc-b)" }} />
        </radialGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        {variant === "tile" && (
          <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--mark-tile-a)" }} />
            <stop offset="1" style={{ stopColor: "var(--mark-tile-b)" }} />
          </linearGradient>
        )}
      </defs>
      {variant === "tile" && <rect width="64" height="64" rx="15" fill={`url(#${id}-tile)`} />}
      <g
        transform={
          variant === "tile" ? "translate(32 33) scale(0.74) translate(-32 -32)" : undefined
        }
      >
        <circle
          cx="31"
          cy="33"
          r="23"
          fill="none"
          stroke={`url(#${id}-rim)`}
          strokeWidth="6"
          filter={`url(#${id}-glow)`}
          opacity="0.85"
        />
        <circle cx="31" cy="33" r="23" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="4.5" />
        <circle cx="34.5" cy="29.5" r="22.4" fill={`url(#${id}-disc)`} />
        <path
          d="M51,8.5C51.6,11.6 52.4,12.4 55.5,13C52.4,13.6 51.6,14.4 51,17.5C50.4,14.4 49.6,13.6 46.5,13C49.6,12.4 50.4,11.6 51,8.5Z"
          style={{ fill: "var(--mark-star)" }}
        />
      </g>
    </svg>
  );
}
