import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./chrome";
import { LightField } from "./light-field";

/**
 * A one-message page in the front page's world (not found, something went wrong): the lit ground,
 * the wordmark home, a plain statement and what to do next.
 */
export function StatusPage({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div data-world="canvas" className="relative isolate flex min-h-dvh flex-col">
      <LightField />
      <header className="mx-auto flex h-16 w-full max-w-[90rem] items-center px-4 md:px-8">
        <Link href="/" aria-label="Realm home" className="rounded-full text-[var(--home-ink)]">
          <Wordmark />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-center px-4 py-16 md:px-8">
        <div className="mx-auto w-full max-w-[90rem]">
          <div className="max-w-[40rem]">
            <h1 className="font-[family-name:var(--font-funnel)] text-[clamp(2.8rem,7vw,5.4rem)] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-[var(--home-ink)]">
              {title}
            </h1>
            <div className="mt-6 text-[1.125rem] leading-relaxed text-[var(--home-ink-2)]">
              {children}
            </div>
            <div className="mt-9 flex flex-wrap gap-3">{actions}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
