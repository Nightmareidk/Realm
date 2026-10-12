import Link from "next/link";
import type { ReactNode } from "react";
import { textLink } from "@/components/pill";
import { cx } from "@/lib/cx";
import { Wordmark } from "../home/chrome";

/** The top of every account screen: the wordmark home, and the way across on the right. */
export function AuthHeader({ aside }: { aside?: ReactNode }) {
  return (
    <header className="relative z-10 mx-auto flex h-20 w-full max-w-[90rem] items-center justify-between gap-4 px-4 md:px-10">
      <Link href="/" aria-label="Realm home" className="rounded-full text-fg">
        <Wordmark />
      </Link>
      {aside && <p className="text-right text-[0.95rem] text-fg-soft">{aside}</p>}
    </header>
  );
}

/** The way across, e.g. "New here? Create an account". */
export function AuthSwitch({ lead, href, label }: { lead: string; href: string; label: string }) {
  return (
    <>
      {lead}{" "}
      <Link href={href} className={textLink}>
        {label}
      </Link>
    </>
  );
}

/**
 * One panel on the lit ground (sign in, verify, reset): the screen's one title in Funnel Display,
 * a line on what this asks, the form, and the way across under it.
 */
export function AuthCard({
  title,
  lead,
  children,
  footer,
  brand,
  className,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Classes for the wordmark inside the card (shown where no page header carries it). */
  brand?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative w-full max-w-[29rem] rounded-[1.75rem] bg-surface px-6 pt-8 pb-7 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.09),0_60px_120px_-40px_var(--r-shadow)] sm:px-9 sm:pt-10",
        className,
      )}
    >
      {brand && (
        <Link
          href="/"
          aria-label="Realm home"
          className={cx("mb-7 inline-flex rounded-full text-fg", brand)}
        >
          <Wordmark />
        </Link>
      )}
      <h1 className="font-display text-[2.4rem] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-fg sm:text-[2.7rem]">
        {title}
      </h1>
      {lead && <div className="mt-4 text-fg-soft">{lead}</div>}
      <div className="mt-7">{children}</div>
      {footer && (
        <div className="mt-7 border-t border-line pt-6 text-center text-fg-soft">{footer}</div>
      )}
    </div>
  );
}

/** In local development there's no inbox: say where the email went instead of pretending. */
export function DevMailNote({ className }: { className?: string }) {
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <p className={cx("text-[0.92rem] leading-snug text-fg-soft", className)}>
      Development build: no email is sent. The code and link are printed in the API's console.
    </p>
  );
}
