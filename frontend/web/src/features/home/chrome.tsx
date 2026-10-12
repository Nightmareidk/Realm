import Link from "next/link";
import { MobileMenu } from "@/components/mobile-menu";
import { MotionToggle } from "@/components/motion-toggle";
import { cx } from "@/lib/cx";

export const HOME_NAV = [
  { href: "/#tour", label: "Spaces" },
  { href: "/#profiles", label: "Profiles" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/download", label: "Download" },
];

/** Realm's mark: a ring with the action colour caught inside it, so it follows the theme. */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className={className}>
      <circle cx="14" cy="14" r="11.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="17.5" cy="11" r="5" fill="var(--acc, var(--r-accent))" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <Mark />
      <span className="font-[family-name:var(--font-funnel)] text-[1.55rem] leading-none font-extrabold tracking-[-0.03em]">
        realm
      </span>
    </span>
  );
}

/** A plain pill in the theme's action colour. */
export const actionClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--acc)] font-bold text-[var(--on-acc)] " +
  "transition-[transform,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.97]";

export const ghostClass =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold text-[var(--home-ink)] " +
  "shadow-[inset_0_0_0_1.5px_rgb(255_255_255_/_0.22)] transition-[transform,background-color] duration-150 ease-out " +
  "hover:bg-[rgb(255_255_255_/_0.06)] active:scale-[0.97]";

/**
 * The front page's bar: always backed (an ink glass with a hairline), so no text ever slides
 * under it unreadably at any width.
 */
export function HomeHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgb(255_255_255_/_0.07)] bg-[rgb(11_11_14_/_0.72)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-8 px-4 md:px-8">
        <Link href="/" aria-label="Realm home" className="rounded-full text-[var(--home-ink)]">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {HOME_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-full px-3.5 py-2 text-[0.95rem] text-[var(--home-ink-2)] transition-colors duration-150 hover:text-[var(--home-ink)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <MotionToggle className="border-[rgb(255_255_255_/_0.15)] text-[var(--home-ink-2)] max-sm:hidden" />
          <Link
            href="/login"
            className="rounded-full px-3.5 py-2 text-[0.95rem] text-[var(--home-ink-2)] hover:text-[var(--home-ink)] max-sm:hidden"
          >
            Sign in
          </Link>
          <Link href="/signup" className={cx(actionClass, "h-10 px-5 text-[0.95rem]")}>
            Open Realm
          </Link>
          <MobileMenu items={HOME_NAV} panelClassName="bg-[#141419]! backdrop-blur-none!">
            <MotionToggle
              label
              className="border-[rgb(255_255_255_/_0.15)] text-[var(--home-ink-2)]"
            />
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}

export function HomeFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-[rgb(255_255_255_/_0.07)] px-4 pt-16 pb-10 md:px-8">
      <div className="mx-auto grid max-w-[90rem] gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-[34ch] text-[var(--home-ink-2)]">
            Chat, clips, profiles and boards for the people you actually hang out with.
          </p>
          <MotionToggle
            label
            className="mt-6 border-[rgb(255_255_255_/_0.15)] text-[var(--home-ink-2)]"
          />
        </div>
        {[
          [
            "Realm",
            [
              ["Spaces", "/#tour"],
              ["Profiles", "/#profiles"],
              ["Download", "/#download"],
            ],
          ],
          [
            "Trust",
            [
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
              ["How we protect you", "/#privacy"],
            ],
          ],
          [
            "Help",
            [
              ["Help centre", "/help"],
              ["Sign in", "/login"],
              ["Create an account", "/signup"],
            ],
          ],
        ].map(([title, links]) => (
          <nav key={title as string} aria-label={title as string}>
            <h2 className="text-sm font-bold text-[var(--home-ink-3)]">{title as string}</h2>
            <ul className="mt-4 space-y-2.5">
              {(links as string[][]).map(([label, href]) => (
                <li key={label}>
                  <Link
                    href={href as string}
                    className="text-[var(--home-ink-2)] hover:text-[var(--home-ink)]"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto mt-16 max-w-[90rem] border-t border-[rgb(255_255_255_/_0.07)] pt-6 text-sm text-[var(--home-ink-2)]">
        © 2026 Realm. Early access. Direct messages aren't end-to-end encrypted yet; they will be
        before public launch.
      </p>
    </footer>
  );
}
