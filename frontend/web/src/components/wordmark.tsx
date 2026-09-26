import { cx } from "@/lib/cx";

/**
 * Realm's mark: four inked regions meeting at one hub (the map, reduced to a glyph),
 * set beside expanded map lettering.
 */
export function RealmMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cx("size-7 shrink-0", className)}>
      <path d="M16 16 L16 2 A14 14 0 0 0 2 16 Z" fill="var(--r-spaces-solid)" />
      <path d="M16 16 L30 16 A14 14 0 0 0 16 2 Z" fill="var(--r-feed-solid)" />
      <path d="M16 16 L16 30 A14 14 0 0 0 30 16 Z" fill="var(--r-profiles-solid)" />
      <path d="M16 16 L2 16 A14 14 0 0 0 16 30 Z" fill="var(--r-boards-solid)" />
      <g stroke="var(--r-ground)" strokeWidth="2">
        <path d="M16 1v30M1 16h30" />
      </g>
      <circle cx="16" cy="16" r="4.2" fill="var(--r-ground)" />
      <circle cx="16" cy="16" r="2.2" fill="var(--r-ink)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <RealmMark />
      <span className="stretch-expanded text-[1.05rem] font-extrabold uppercase tracking-[0.2em] text-ink">
        Realm
      </span>
    </span>
  );
}
