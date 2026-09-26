import Link from "next/link";
import { ButtonLink } from "./button";
import { MobileMenu } from "./mobile-menu";
import { Wordmark } from "./wordmark";

export const NAV = [
  { href: "/#spaces", label: "Spaces" },
  { href: "/#feed", label: "Feed" },
  { href: "/#profiles", label: "Profiles" },
  { href: "/#boards", label: "Boards" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/download", label: "Download" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[oklch(0.8_0.06_300/0.12)] bg-[color-mix(in_oklch,var(--r-ground)_72%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-8 px-4 md:px-8">
        <Link href="/" aria-label="Realm home" className="rounded-sm">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-sm px-3 py-2 text-sm text-ink-soft transition-colors duration-160 ease-out hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ButtonLink href="/login" variant="quiet" className="max-sm:hidden">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup">Open Realm</ButtonLink>
          <MobileMenu items={NAV} />
        </div>
      </div>
    </header>
  );
}
