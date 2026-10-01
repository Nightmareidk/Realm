import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/button";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/** Any address that isn't a page. Next.js serves it with a 404 status. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[90rem] items-center px-4 md:px-8">
        <Link href="/" aria-label="Realm home" className="rounded-sm">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[32rem]">
          <p className="text-sm font-semibold text-ink-muted">404</p>
          <h1 className="display mt-2 text-[2.4rem] leading-tight text-ink">
            This page drifted off
          </h1>
          <p className="mt-4 text-ink-soft">
            There's nothing at this address. It may have moved, or the link may have a typo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={buttonClass("primary", "md")}>
              Go home
            </Link>
            <Link href="/help" className={buttonClass("secondary", "md")}>
              Get help
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
