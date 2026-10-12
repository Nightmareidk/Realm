import type { ReactNode } from "react";
import { SettingsList, SettingsNav } from "./settings-nav";

/**
 * A settings page: the grouped list of settings beside it from 1024px (pills under the title
 * below that), its own name as the title, then the sections.
 */
export function SettingsPlace({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[66rem] px-5 pt-6 pb-16 md:px-8 md:pt-2 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
      <SettingsList />
      <div className="min-w-0">
        <h1 className="font-display text-[1.75rem] leading-[1.1] font-bold tracking-[-0.025em] text-fg md:text-[1.9rem]">
          {title}
        </h1>
        {lead && <p className="mt-2 max-w-[60ch] text-fg-soft">{lead}</p>}
        <div className="mt-5 lg:hidden">
          <SettingsNav />
        </div>
        <div className="mt-8 max-w-[44rem] lg:mt-3">{children}</div>
      </div>
    </div>
  );
}

/** One section of a settings page, under a hairline. */
export function SettingsSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-t border-line pt-8 pb-9 first:border-t-0 first:pt-0"
    >
      <h2 id={id} className="font-display text-[1.25rem] font-bold tracking-[-0.02em] text-fg">
        {title}
      </h2>
      {lead && <p className="mt-2 max-w-[56ch] text-fg-soft">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
