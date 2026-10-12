"use client";

import Link from "next/link";
import { useEffect } from "react";
import { actionClass, ghostClass } from "@/features/home/chrome";
import { StatusPage } from "@/features/home/status-page";
import { cx } from "@/lib/cx";

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
    <StatusPage
      title="Something went wrong."
      actions={
        <>
          <button type="button" onClick={() => retry()} className={cx(actionClass, "h-12 px-6")}>
            Try again
          </button>
          <Link href="/" className={cx(ghostClass, "h-12 px-6")}>
            Go home
          </Link>
        </>
      }
    >
      <p>
        This page ran into a problem and couldn't finish loading. It's not something you did, and
        trying again usually fixes it.
      </p>
      {error.digest && (
        <p className="mt-4 text-base">
          If it keeps happening, tell us this code: <code>{error.digest}</code>
        </p>
      )}
    </StatusPage>
  );
}
