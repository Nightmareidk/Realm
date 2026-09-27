import Link from "next/link";
import { MotionToggle } from "./motion-toggle";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

const COLUMNS = [
  {
    title: "Realm",
    links: [
      { href: "/#spaces", label: "Spaces" },
      { href: "/#feed", label: "Feed" },
      { href: "/#profiles", label: "Profiles" },
      { href: "/#boards", label: "Boards" },
      { href: "/download", label: "Download" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy#security", label: "Security" },
      { href: "/help", label: "Help" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto grid max-w-[90rem] gap-10 px-4 py-14 md:grid-cols-12 md:px-8">
        <div className="flex flex-col items-start gap-5 md:col-span-6">
          <Wordmark />
          <p className="max-w-[36ch] text-sm text-ink-muted">
            Early access. Built in the open: we say what works today and what is still on its way.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <MotionToggle label />
          </div>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="md:col-span-3">
            <p className="text-sm font-semibold text-ink">{col.title}</p>
            <ul className="mt-3 grid gap-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink-soft hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto max-w-[90rem] border-t border-rule px-4 py-6 text-xs text-ink-muted md:px-8">
        © 2026 Realm
      </div>
    </footer>
  );
}
