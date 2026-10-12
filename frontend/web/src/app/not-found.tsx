import type { Metadata } from "next";
import Link from "next/link";
import { actionClass, ghostClass } from "@/features/home/chrome";
import { StatusPage } from "@/features/home/status-page";
import { cx } from "@/lib/cx";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/** Any address that isn't a page. Next.js serves it with a 404 status. */
export default function NotFound() {
  return (
    <StatusPage
      title="There's nothing here."
      actions={
        <>
          <Link href="/" className={cx(actionClass, "h-12 px-6")}>
            Go home
          </Link>
          <Link href="/help" className={cx(ghostClass, "h-12 px-6")}>
            Get help
          </Link>
        </>
      }
    >
      <p>
        This address doesn't lead to a page (error 404). It may have moved, or the link may have a
        typo.
      </p>
    </StatusPage>
  );
}
