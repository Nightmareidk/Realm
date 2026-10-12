import { cx } from "@/lib/cx";

/**
 * Pills in DESIGN.md's world, read from the role tokens so they follow the person's theme. The
 * action pill is the one thing to press on a screen (the theme's colour); the ghost pill is
 * everything secondary. Rounded rectangles are for content, never for buttons.
 */
const base =
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap " +
  "transition-[transform,filter,background-color,box-shadow] duration-150 ease-out active:scale-[0.97] " +
  "aria-disabled:cursor-progress aria-disabled:active:scale-100";

const kinds = {
  action: "bg-accent text-on-accent hover:brightness-110",
  ghost: "text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] hover:bg-surface-raised",
  quiet: "text-fg-soft hover:bg-surface-raised hover:text-fg",
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-[0.9rem]",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-14 px-7 text-[1.02rem]",
} as const;

export function pill(
  kind: keyof typeof kinds = "action",
  size: keyof typeof sizes = "lg",
  extra?: string,
) {
  return cx(base, kinds[kind], sizes[size], extra);
}

/** A text link in reading copy: ink, underlined, a heavier underline on hover. */
export const textLink =
  "font-bold text-fg underline decoration-1 underline-offset-[0.22em] hover:decoration-2";
