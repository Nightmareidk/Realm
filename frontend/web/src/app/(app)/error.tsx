"use client";

import Link from "next/link";
import { useEffect } from "react";
import { pill } from "@/components/pill";

/**
 * When a signed-in screen fails. It shows inside the app (the navigation stays, so you can go
 * somewhere else), says plainly what happened, and offers another try. The code ties this visit
 * to the server's log when the failure was on the server.
 */
export default function AppError({
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
    <section
      role="alert"
      className="mx-auto flex max-w-[34rem] flex-col items-start gap-4 px-6 py-16 text-fg"
    >
      <h1 className="font-display text-[1.75rem] leading-[1.1] font-bold tracking-[-0.025em]">
        This part of Realm didn't load.
      </h1>
      <p className="text-[1.05rem] leading-relaxed text-fg-soft">
        Something went wrong on our side, not yours. Trying again usually fixes it. Your messages
        and posts are safe.
      </p>
      {error.digest && (
        <p className="text-[0.95rem] text-fg-soft">
          If it keeps happening, tell us this code: <code>{error.digest}</code>
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={pill("action", "md")}>
          Try again
        </button>
        <Link href="/home" className={pill("ghost", "md")}>
          Go to Home
        </Link>
      </div>
    </section>
  );
}
