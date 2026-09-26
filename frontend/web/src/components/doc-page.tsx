import type { ReactNode } from "react";

/** Long-form page shell (legal, help): a readable column in the Read register. */
export function DocPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-[44rem] px-4 py-20 md:px-8 lg:py-28">
      <h1 className="stretch-semi-expanded text-[clamp(2rem,3.4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
        {title}
      </h1>
      <div className="mt-8 grid gap-5 text-[1.05rem] leading-relaxed text-ink-soft [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink">
        {children}
      </div>
    </article>
  );
}
