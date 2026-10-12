import type { ReactNode } from "react";

/**
 * Long-form page shell (help, privacy, terms) in the front page's world: a readable column on the
 * lit ground, a Funnel Display title and Atkinson body at a comfortable measure.
 */
export function DocPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-[46rem] px-4 pt-[calc(4rem+clamp(4rem,9vw,7rem))] pb-24 md:px-8">
      <h1 className="font-[family-name:var(--font-funnel)] text-[clamp(2.8rem,6vw,4.6rem)] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-[var(--home-ink)]">
        {title}
      </h1>
      {lead && (
        <p className="mt-6 text-[clamp(1.1rem,1rem+0.4vw,1.3rem)] leading-relaxed text-[var(--home-ink-2)]">
          {lead}
        </p>
      )}
      <div className="mt-10 grid gap-5 border-t border-[rgb(255_255_255_/_0.1)] pt-10 text-[1.0625rem] leading-[1.7] text-[var(--home-ink-2)] [&_a]:text-[var(--home-ink)] [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:font-[family-name:var(--font-funnel)] [&_h2]:text-[1.6rem] [&_h2]:leading-tight [&_h2]:font-extrabold [&_h2]:tracking-[-0.03em] [&_h2]:text-[var(--home-ink)] [&_h2:first-child]:mt-0 [&_li]:pl-1 [&_strong]:text-[var(--home-ink)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}
