import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Wraps an illustrative product preview. The inner UI is `inert` (not focusable, not in the
 * accessibility tree); the caption describes it and says plainly that the content is an example.
 */
export function PreviewFrame({
  label,
  caption = true,
  className,
  children,
}: {
  label: string;
  caption?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={cx("m-0", className)}>
      <div
        inert
        className="overflow-hidden rounded-[1.25rem] border border-rule bg-panel shadow-[inset_0_1px_0_var(--surface-edge),0_1px_2px_color-mix(in_oklch,var(--r-shadow)_20%,transparent),0_36px_70px_-34px_color-mix(in_oklch,var(--r-shadow)_85%,transparent)]"
      >
        {children}
      </div>
      <figcaption className={cx("mt-2.5 text-xs text-ink-muted", !caption && "sr-only")}>
        {label}. Illustrative preview: names and content are examples.
      </figcaption>
    </figure>
  );
}
