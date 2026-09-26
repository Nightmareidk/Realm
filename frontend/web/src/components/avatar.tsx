import { cx } from "@/lib/cx";

export type Ink = "spaces" | "feed" | "profiles" | "boards";

const inks: Record<Ink, string> = {
  spaces: "bg-spaces-fill text-spaces-text",
  feed: "bg-feed-fill text-feed-text",
  profiles: "bg-profiles-fill text-profiles-text",
  boards: "bg-boards-fill text-boards-text",
};

const sizes = {
  xs: "size-6 text-[0.6rem]",
  sm: "size-8 text-[0.7rem]",
  md: "size-10 text-xs",
  lg: "size-16 text-lg",
  xl: "size-24 text-2xl",
} as const;

export function Avatar({
  name,
  ink,
  size = "sm",
  online,
  className,
}: {
  name: string;
  ink: Ink;
  size?: keyof typeof sizes;
  online?: boolean;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className={cx("relative inline-flex shrink-0", className)}>
      <span
        aria-hidden="true"
        className={cx(
          "inline-flex items-center justify-center rounded-full font-bold stretch-semi-expanded",
          inks[ink],
          sizes[size],
        )}
      >
        {initials}
      </span>
      {online !== undefined && (
        <span
          role="img"
          aria-label={online ? "online" : "offline"}
          className={cx(
            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-panel",
            online ? "bg-success" : "bg-rule-strong",
          )}
        />
      )}
    </span>
  );
}
