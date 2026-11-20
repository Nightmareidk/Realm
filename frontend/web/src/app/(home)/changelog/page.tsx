import { CHANGELOG, changelogAnchor } from "@realm/contracts";
import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";
import { longDate } from "@/features/changelog/dates";

export const metadata: Metadata = {
  title: "What's new",
  description:
    "Every Realm update in plain words, newest first: new features, fixes and what changed in the app and on the website.",
  alternates: { canonical: "/changelog" },
};

/**
 * The full changelog. The app shows each update's short version once, then links here (to the
 * version's own part, #v0-1-0). The words live in shared/contracts/src/changelog.ts.
 */
export default function ChangelogPage() {
  return (
    <DocPage
      title="What's new"
      lead="Every Realm update, newest first. The app shows a short version once after each update; this page has the whole story."
    >
      {CHANGELOG.map((e) => {
        const id = changelogAnchor(e.version);
        return (
          <section key={e.version} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28">
            <p className="text-[0.95rem] font-semibold tracking-[0.01em] text-[var(--home-ink-2)]">
              Version {e.version} · <time dateTime={e.date}>{longDate(e.date)}</time>
            </p>
            <h2 id={`${id}-title`} className="!mt-2">
              {e.title}
            </h2>
            {e.sections.map((s) => (
              <div key={s.heading} className="mt-6">
                <h3 className="mb-2 font-[family-name:var(--font-funnel)] text-[1.15rem] font-extrabold tracking-[-0.02em] text-[var(--home-ink)]">
                  {s.heading}
                </h3>
                <ul>
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
      <p className="mt-8 text-[0.95rem]">
        Something not working, or an idea? Email{" "}
        <a href="mailto:info@tomyrealm.com">info@tomyrealm.com</a>.
      </p>
    </DocPage>
  );
}
