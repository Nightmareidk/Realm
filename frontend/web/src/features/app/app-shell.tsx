"use client";

import { UsersThree } from "@phosphor-icons/react";
import type { SelfUser } from "@realm/contracts";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Wordmark } from "@/features/home/chrome";
import { realtime } from "@/features/realtime/client";
import { ReportDialog } from "@/features/safety/report-dialog";
import { CreateSpaceDialog } from "@/features/spaces/create-space";
import { InviteDialog } from "@/features/spaces/invite-dialog";
import { ManageSpaceDialog } from "@/features/spaces/manage";
import { ThemeArt } from "@/features/themes/art";
import { ThemeProvider } from "@/features/themes/theme-context";
import { VoiceDock } from "@/features/voice/voice-dock";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import styles from "./app.module.css";
import { HerePanelContext } from "./here-context";
import { HereNow } from "./here-now";
import { AlertsMenu, CreateMenu, Me } from "./menus";
import { DESTINATIONS, isActive, TABS } from "./nav";
import { NavColumn, useMessagesWaiting } from "./nav-column";
import { Travel } from "./travel";
import { VerifyBanner } from "./verify-banner";

const HERE_KEY = "realm:here-now";

const barButton =
  "inline-flex size-10 items-center justify-center rounded-full text-fg-soft transition-colors duration-150 ease-out hover:bg-surface-raised hover:text-fg aria-expanded:bg-surface-raised aria-expanded:text-fg";

/**
 * The signed-in frame, "Wall" (the owner's pick, 2026-10-05; `.impeccable/mocks/shell2/c-*`): a
 * labelled nav column on the ground (destinations, your Spaces, you) beside one content sheet
 * with a slim bar (Travel, Here now, Create, notifications) over the page. Here now is optional:
 * beside the page from 80rem once you've opened it (remembered on this device), over the page
 * below that. Phones: a slim header and five tabs, both stepping aside inside a room.
 */
export function AppShell({ viewer, children }: { viewer: SelfUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const waiting = useMessagesWaiting();
  const [herePref, setHerePref] = useState<"open" | "closed">("closed");
  const [wide, setWide] = useState(false);
  const [peek, setPeek] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  // The browser's own check that the session still holds (the server's check only peeks, so this
  // is also what keeps an active session's cookie from running out). The account's theme comes
  // with ThemeProvider.
  useEffect(() => {
    api("/users/@me").catch((err) => {
      if (err instanceof ApiError && err.signedOut) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      }
    });
  }, [router]);

  // The live connection: Spaces, messages, typing and who's around.
  useEffect(() => {
    realtime.start();
    return () => realtime.stop();
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(HERE_KEY) === "open") setHerePref("open");
    } catch {}
    const mq = matchMedia("(width >= 80rem)");
    const sync = () => {
      setWide(mq.matches);
      if (mq.matches) setPeek(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const hereOpen = wide ? herePref === "open" : peek;

  const closePeek = useCallback(() => {
    setPeek(false);
    opener.current?.focus();
    opener.current = null;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: an overlay closes when the page changes.
  useEffect(() => {
    setPeek(false);
  }, [pathname]);

  useEffect(() => {
    if (!peek) return;
    document.getElementById("here-now-title")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePeek();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek, closePeek]);

  const toggleHere = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (wide) {
      const next = hereOpen ? "closed" : "open";
      setHerePref(next);
      try {
        localStorage.setItem(HERE_KEY, next);
      } catch {}
      return;
    }
    if (peek) return closePeek();
    opener.current = e.currentTarget;
    setPeek(true);
  };

  const hereButton = (className: string) => (
    <button
      type="button"
      onClick={toggleHere}
      aria-expanded={hereOpen}
      aria-controls="here-now"
      className={className}
    >
      <UsersThree aria-hidden="true" size={21} />
      <span className="sr-only">Here now</span>
    </button>
  );

  // Inside a room or a conversation, chat fills the sheet (and, on phones, the screen); the email
  // reminder waits. Messages' inbox fills the sheet too (its lists scroll on their own).
  const inRoom = /^\/(spaces|messages)\/[^/]+/.test(pathname);
  const onMessages = pathname === "/messages";
  const onHome = pathname === "/home";

  return (
    <ThemeProvider>
      <HerePanelContext.Provider value={{ open: hereOpen, toggle: toggleHere }}>
        <ThemeArt />
        <div
          className={styles.app}
          data-frame="app"
          data-here={herePref}
          data-peek={peek ? "" : undefined}
          data-room={inRoom ? "" : undefined}
        >
          <a
            href="#main"
            className="sr-only z-[80] rounded-full bg-accent px-4 py-2 font-bold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </a>

          {/* Tablet and up: the nav column. */}
          <aside aria-label="Navigation" className={styles.nav}>
            <NavColumn viewer={viewer} />
          </aside>

          {/* Phones: a slim header. */}
          <header className={styles.phoneTop}>
            <Link href="/home" aria-label="Realm home" className="mr-auto rounded-full text-fg">
              <Wordmark />
            </Link>
            {hereButton(
              "inline-flex size-11 items-center justify-center rounded-full text-fg-soft hover:bg-surface-raised hover:text-fg aria-expanded:bg-surface-raised aria-expanded:text-fg",
            )}
            <Travel variant="icon" />
            <AlertsMenu />
          </header>

          {peek && (
            // The scrim: a click outside Here now closes it (Escape does the same).
            <div aria-hidden="true" onClick={closePeek} className={styles.scrim} />
          )}

          <div className={styles.sheet}>
            <header className={styles.bar}>
              <div className="flex min-w-0 flex-1">
                <Travel />
              </div>
              {hereButton(barButton)}
              <CreateMenu />
              <AlertsMenu />
            </header>
            <div className={styles.sheetBody}>
              <main
                id="main"
                tabIndex={-1}
                className={cx(styles.main, inRoom && styles.room, onMessages && styles.fill)}
              >
                {!inRoom && !onHome && !onMessages && <VerifyBanner viewer={viewer} />}
                {children}
              </main>
              <aside id="here-now" aria-labelledby="here-now-title" className={styles.here}>
                <HereNow viewer={viewer} />
              </aside>
            </div>
          </div>

          {/* Phones: the tabs. */}
          <nav aria-label="Realm" className={styles.tabs}>
            {TABS.map((href) => {
              const d = DESTINATIONS.find((x) => x.href === href);
              if (!d) return null;
              const active = isActive(pathname, href);
              const Icon = d.icon;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={styles.tab}
                >
                  <span className={cx(styles.tabGlyph, "relative")}>
                    <Icon aria-hidden="true" size={22} weight={active ? "fill" : "regular"} />
                    {href === "/messages" && waiting > 0 && (
                      <span className="absolute top-0 right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.65rem] font-bold text-on-accent">
                        {waiting}
                        <span className="sr-only"> new</span>
                      </span>
                    )}
                  </span>
                  {d.label}
                </Link>
              );
            })}
            <Link
              href="/settings/account"
              aria-current={isActive(pathname, "/settings") ? "page" : undefined}
              className={styles.tab}
            >
              <span className={styles.tabGlyph}>
                <Me name={viewer.displayName} src={viewer.avatarUrl} size={24} />
              </span>
              You
            </Link>
          </nav>
          {/* Below the nav column's dock, a call stays in view above the tabs or the page's foot. */}
          <VoiceDock className="fixed inset-x-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 md:bottom-3 md:left-auto md:w-[22rem] lg:hidden" />
          <CreateSpaceDialog />
          <InviteDialog />
          <ManageSpaceDialog />
          <ReportDialog />
        </div>
      </HerePanelContext.Provider>
    </ThemeProvider>
  );
}
