"use client";

import { GearSix } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, SETTINGS } from "@/features/app/nav";

const item =
  "flex h-10 items-center rounded-[0.8rem] px-3 text-[0.95rem] font-semibold text-fg-soft transition-colors duration-150 ease-out hover:bg-fg/6 hover:text-fg aria-[current=page]:bg-fg/8 aria-[current=page]:text-fg";

/** Settings' pages in their groups: a column beside the page from 1024px. */
export function SettingsList() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="sticky top-2 hidden self-start lg:block">
      <p className="flex items-center gap-2 px-3 pb-3 font-display text-[1.1rem] font-bold tracking-[-0.02em] text-fg">
        <GearSix aria-hidden="true" size={19} />
        Settings
      </p>
      <div className="space-y-4">
        {SETTINGS.map((g) => (
          <div key={g.group}>
            <p className="px-3 pb-1 text-[0.8rem] font-bold text-fg-soft">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items
                .filter((i) => !i.soon)
                .map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={isActive(pathname, i.href) ? "page" : undefined}
                      className={item}
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

/** The same pages as pills, under the title on narrower screens. */
export function SettingsNav() {
  const pathname = usePathname();
  const pages = SETTINGS.flatMap((g) => g.items).filter((i) => !i.soon);
  return (
    <nav aria-label="Settings pages" className="lg:hidden">
      <ul className="flex flex-wrap gap-2">
        {pages.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              aria-current={isActive(pathname, p.href) ? "page" : undefined}
              className="inline-flex h-10 items-center rounded-full px-4 text-[0.95rem] font-semibold text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)] transition-colors duration-150 ease-out hover:text-fg aria-[current=page]:bg-fg/8 aria-[current=page]:text-fg aria-[current=page]:shadow-none"
            >
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
