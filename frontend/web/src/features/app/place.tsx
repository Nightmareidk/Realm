import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** A destination's page inside the app's centre panel: its title, a line on what it's for, content. */
export function Place({
  title,
  lead,
  children,
  wide = false,
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  /** Wider, for grids of posters rather than reading. */
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "mx-auto w-full px-5 pt-6 pb-16 md:px-8 md:pt-2",
        wide ? "max-w-[76rem]" : "max-w-[56rem]",
        className,
      )}
    >
      <h1 className="font-display text-[1.75rem] leading-[1.1] font-bold tracking-[-0.025em] text-balance text-fg md:text-[1.9rem]">
        {title}
      </h1>
      {lead && <p className="mt-2 max-w-[60ch] text-[1rem] leading-relaxed text-fg-soft">{lead}</p>}
      <div className="mt-7">{children}</div>
    </div>
  );
}

/**
 * A teaching empty state (docs/UX-ARCHITECTURE.md): what goes here, honestly when it arrives, and
 * the one thing to do now if there is one. It sits straight on the panel under a hairline, never
 * in a box of its own.
 */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("border-t border-line pt-8", className)}>
      <h2 className="font-display text-[1.3rem] leading-tight font-bold tracking-[-0.02em] text-fg">
        {title}
      </h2>
      <div className="mt-3 max-w-[54ch] space-y-3 text-fg-soft">{children}</div>
      {action && <div className="mt-5 flex flex-wrap items-center gap-3">{action}</div>}
    </section>
  );
}

/** "Coming soon": a quiet tag for what isn't built yet. Never a date we can't keep. */
export function SoonTag({ children = "Coming soon" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-base/60 px-3 text-[0.82rem] font-bold text-fg-soft shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]">
      {children}
    </span>
  );
}
