import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { RealmLogo } from "@/components/wordmark";
import { cx } from "@/lib/cx";
import { SpacesApp } from "../previews/spaces-preview";

/** Realm's web app window, framed as it would sit on a desktop. Illustrative content. */
export function AppWindow({ className }: { className?: string }) {
  return (
    <div
      inert
      className={cx("overflow-hidden rounded-lg border border-rule-strong/60 bg-panel", className)}
    >
      <div className="flex h-10 items-center gap-3 border-b border-rule bg-ground/70 px-3">
        <RealmLogo size={18} />
        <span className="truncate text-xs text-ink-soft">
          <span className="font-semibold text-ink">Late Night Lobby</span>
          <span className="mx-1.5 text-ink-muted">/</span>#general
        </span>
        <span className="ml-auto flex h-7 w-[min(40%,15rem)] items-center max-sm:hidden gap-2 rounded-md border border-rule bg-panel px-2.5 text-xs text-ink-muted">
          <MagnifyingGlass size={13} />
          <span className="truncate">Travel anywhere</span>
          <kbd className="ml-auto font-sans text-[0.65rem] text-ink-muted">Ctrl K</kbd>
        </span>
      </div>
      <SpacesApp className="h-[19rem] lg:h-[23rem]" />
    </div>
  );
}
