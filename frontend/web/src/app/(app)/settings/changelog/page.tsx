import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { CHANGELOG, changelogAnchor } from "@realm/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { longDate } from "@/features/changelog/dates";
import { SettingsPlace } from "@/features/settings/settings-place";

export const metadata: Metadata = { title: "What's new" };

/** Settings › What's new: each update's highlights, newest first, with the full story a tap away. */
export default function SettingsChangelogPage() {
  return (
    <SettingsPlace
      title="What's new"
      lead="What changed in each update, newest first. The What's new page has all the details."
    >
      <ol className="relative space-y-10 border-l-2 border-line pl-6">
        {CHANGELOG.map((e, i) => (
          <li key={e.version} className="relative">
            <span
              aria-hidden="true"
              className={
                i === 0
                  ? "absolute top-1.5 -left-[calc(1.5rem+7px)] size-3 rounded-full bg-accent"
                  : "absolute top-1.5 -left-[calc(1.5rem+7px)] size-3 rounded-full border-2 border-line-strong bg-base"
              }
            />
            <p className="text-[0.9rem] font-bold text-fg-soft">
              <span className={i === 0 ? "text-accent" : undefined}>Version {e.version}</span> ·{" "}
              <time dateTime={e.date}>{longDate(e.date)}</time>
            </p>
            <h2 className="mt-1.5 font-display text-[1.3rem] leading-tight font-bold tracking-[-0.02em] text-fg">
              {e.title}
            </h2>
            <ul className="mt-3 space-y-2">
              {e.highlights.map((h) => (
                <li key={h} className="flex gap-3 text-fg">
                  <span
                    aria-hidden="true"
                    className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-fg-soft"
                  />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`/changelog#${changelogAnchor(e.version)}`}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded font-bold text-fg underline underline-offset-[0.22em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              All the details
              <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </li>
        ))}
      </ol>
    </SettingsPlace>
  );
}
