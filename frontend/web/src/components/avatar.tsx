import Image from "next/image";
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

const px = { xs: 24, sm: 32, md: 40, lg: 64, xl: 96 } as const;

/**
 * A person's avatar: their picture when they have one (Realm avatars are 3D characters), otherwise
 * their initials on their colour. Pictures sit on a soft wash of the same colour.
 */
export function Avatar({
  name,
  ink,
  src,
  size = "sm",
  online,
  className,
}: {
  name: string;
  ink: Ink;
  /** A portrait image; initials are used when there isn't one. */
  src?: string;
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
          "inline-flex items-center justify-center overflow-hidden rounded-full font-bold stretch-semi-expanded",
          inks[ink],
          sizes[size],
          src && "ring-1 ring-rule",
        )}
      >
        {src ? (
          <Image
            src={src}
            alt=""
            width={px[size] * 2}
            height={px[size] * 2}
            className="size-full scale-[1.18] object-cover object-[50%_30%]"
          />
        ) : (
          initials
        )}
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
