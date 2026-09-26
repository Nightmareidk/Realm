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
        className="overflow-hidden rounded-md border border-rule bg-panel shadow-[0_18px_40px_-18px_color-mix(in_oklch,var(--r-shadow)_70%,transparent)]"
      >
        {children}
      </div>
      <figcaption className={cx("mt-2.5 text-xs text-ink-muted", !caption && "sr-only")}>
        {label}. Illustrative preview: names and content are examples.
      </figcaption>
    </figure>
  );
}
