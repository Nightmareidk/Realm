import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "quiet";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold " +
  "transition-[transform,background-color,border-color,color] duration-160 ease-out " +
  "active:scale-[0.97] select-none";

const variants: Record<Variant, string> = {
  // Magenta overprint: the only accent, reserved for the primary action.
  primary: "bg-overprint-fill text-on-overprint hover:bg-overprint-fill-hover",
  secondary: "border border-rule-strong text-ink hover:border-ink-soft hover:bg-panel",
  quiet: "text-ink-soft hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[0.95rem]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(base, variants[variant], sizes[size], className);
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
