import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { RealmLogo } from "@/components/wordmark";
import { cx } from "@/lib/cx";
import { SpacesApp } from "../previews/spaces-preview";

/** Realm's web app window, framed as it would sit on a desktop. Illustrative content. */
export function AppWindow({ className }: { className?: string }) {
  return (
    <div
      inert
      className={cx(
        "overflow-hidden rounded-[1.25rem] border border-rule bg-panel shadow-[inset_0_1px_0_var(--surface-edge)]",
        className,
      )}
    >
      <div className="flex h-11 items-center gap-3 border-b border-rule bg-[color-mix(in_oklch,var(--r-ground)_55%,var(--r-panel))] px-4">
        <RealmLogo size={18} />
        <span className="truncate text-xs text-ink-soft">
          <span className="font-semibold text-ink">Late Night Lobby</span>
          <span className="mx-1.5 text-ink-muted">/</span>#general
        </span>
        <span className="ml-auto flex h-7 w-[min(40%,15rem)] items-center gap-2 rounded-full border border-rule bg-panel px-3 text-xs text-ink-muted max-sm:hidden">
          <MagnifyingGlass size={13} />
          <span className="truncate">Travel anywhere</span>
          <kbd className="ml-auto font-sans text-[0.65rem] text-ink-muted">Ctrl K</kbd>
        </span>
      </div>
      <SpacesApp className="h-[21rem] md:h-[26rem] lg:h-[31rem]" />
    </div>
  );
}
