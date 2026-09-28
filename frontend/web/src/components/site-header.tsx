import Link from "next/link";
import { ButtonLink } from "./button";
import { HeaderBar } from "./header-bar";
import { MobileMenu } from "./mobile-menu";
import { MotionToggle } from "./motion-toggle";
import { EditionToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

export const NAV = [
  { href: "/#spaces", label: "Spaces" },
  { href: "/#feed", label: "Feed" },
  { href: "/#profiles", label: "Profiles" },
  { href: "/#boards", label: "Boards" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/download", label: "Download" },
];

/**
 * A floating capsule over the page (64px tall in all, like a classic bar, so the hero's offset
 * holds). The thin line along its foot fills as you scroll (globals.css, .scroll-progress).
 */
export function SiteHeader() {
  return (
    <HeaderBar className="sticky top-0 z-40 px-2 pt-2 text-ink md:px-4">
      <div className="site-pill mx-auto flex h-14 max-w-[80rem] items-center gap-6 rounded-full pr-2 pl-4 md:pl-5">
        <Link href="/" aria-label="Realm home" className="rounded-full">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-full px-3.5 py-2 text-[0.95rem] text-ink-soft transition-colors duration-160 ease-out hover:bg-[color-mix(in_oklch,var(--r-ink)_7%,transparent)] hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <EditionToggle />
          <MotionToggle className="max-sm:hidden" />
          <ButtonLink href="/login" variant="quiet" className="max-sm:hidden">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup">Open Realm</ButtonLink>
          <MobileMenu items={NAV} />
        </div>
        <span aria-hidden="true" className="scroll-progress" />
      </div>
    </HeaderBar>
  );
}
