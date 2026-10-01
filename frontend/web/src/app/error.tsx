"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/button";
import { Wordmark } from "@/components/wordmark";

/**
 * When a page fails to render. It says so plainly, offers another try (which fetches the page
 * again), and a way home. Server errors reach here without their details (Next.js strips them in
 * production); the digest ties this visit to the server's log.
 */
export default function PageError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[90rem] items-center px-4 md:px-8">
        <Link href="/" aria-label="Realm home" className="rounded-sm">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[32rem]">
          <h1 className="display text-[2.4rem] leading-tight text-ink">Something went wrong</h1>
          <p className="mt-4 text-ink-soft">
            This page ran into a problem and couldn't finish loading. It's not something you did.
            Trying again usually fixes it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => retry()} className={buttonClass("primary", "md")}>
              Try again
            </button>
            <Link href="/" className={buttonClass("secondary", "md")}>
              Go home
            </Link>
          </div>
          {error.digest && (
            <p className="mt-8 text-xs text-ink-muted">
              If it keeps happening, tell us this code: <code>{error.digest}</code>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
