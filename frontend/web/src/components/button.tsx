import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "quiet";
type Size = "md" | "lg";

// Pills, with a tactile press. `group/button` lets an icon inside react to hover (e.g. an arrow
// that nudges forward).
const base =
  "group/button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold " +
  "transition-[transform,background-color,border-color,color,box-shadow] duration-160 ease-out " +
  "active:scale-[0.97] select-none";

const variants: Record<Variant, string> = {
  // The action colour: molten amber by night, coral by day. Only for the primary action. A lit
  // top edge and a soft shadow in its own hue give it a little depth; it never glows.
  primary:
    "bg-overprint-fill text-on-overprint hover:bg-overprint-fill-hover " +
    "shadow-[inset_0_1px_0_oklch(1_0_0/0.35),0_10px_24px_-12px_var(--r-overprint-fill)]",
  secondary:
    "border border-rule-strong text-ink hover:border-ink-soft " +
    "bg-[color-mix(in_oklch,var(--r-panel)_55%,transparent)] hover:bg-panel",
  quiet: "text-ink-soft hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-13 px-6 text-base",
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
