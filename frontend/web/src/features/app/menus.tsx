"use client";

import {
  ChatCircleDots,
  CirclesThree,
  FilmStrip,
  GearSix,
  ImageSquare,
  Plus,
  PlusSquare,
  Question,
  SignOut,
  SquaresFour,
  UsersThree,
} from "@phosphor-icons/react";
import type { SelfUser } from "@realm/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { MotionToggle } from "@/components/motion-toggle";
import { openCreateSpace, openInvite, useRealm } from "@/features/realtime/store";
import { openComposer } from "@/features/social/composer";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { AccentPicker } from "./accent-picker";
import { SoonTag } from "./place";

/** Signs out of this device, then goes to the sign-in screen. */
export function useSignOut() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const signOut = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (err) {
      // Already signed out is as good as signing out.
      if (!(err instanceof ApiError && err.signedOut)) {
        setPending(false);
        setError(err instanceof ApiError ? err.message : "Couldn't sign out. Try again.");
        return;
      }
    }
    // A full load, so nothing from the signed-in app stays cached in this tab.
    window.location.replace("/login");
  };
  return { signOut, pending, error };
}

/**
 * A button that opens a panel (a disclosure, not an ARIA menu: these panels hold switches and
 * swatches). Tab moves through it; Escape or a click outside closes it and focus goes back.
 */
export function Popover({
  label,
  button,
  buttonClass,
  panelClass,
  placement = "below",
  className,
  children,
}: {
  label: string;
  button: ReactNode;
  buttonClass: string;
  panelClass?: string;
  /** Classes for the wrapper (e.g. full width, for a row at the foot of the nav). */
  className?: string;
  /** Opens below the button (top bar) or above it (the composer at the foot of a chat). */
  placement?: "below" | "above";
  /** Content, or a function given `close` for buttons inside that act and then shut it. */
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: close when the page changes.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a,button,input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className={cx("relative", className)}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={buttonClass}
      >
        {button}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          className={cx(
            "absolute z-50 rounded-box bg-surface-raised p-2 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1),0_30px_70px_-20px_var(--r-shadow)]",
            placement === "below"
              ? "top-[calc(100%+0.6rem)] right-0"
              : "bottom-[calc(100%+0.6rem)] left-0",
            panelClass,
          )}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export const row =
  "flex h-11 w-full items-center gap-3 rounded-[0.8rem] px-3 text-left text-fg-soft transition-colors duration-150 ease-out hover:bg-fg/8 hover:text-fg";

export const iconButton =
  "relative inline-flex size-10 items-center justify-center rounded-full text-fg-soft transition-colors duration-150 ease-out hover:bg-surface-raised hover:text-fg aria-expanded:bg-surface-raised aria-expanded:text-fg";

/** The person's own initial, in their colour. */
export function Me({
  name,
  src,
  size = 36,
}: {
  name: string;
  /** Your profile picture, if you've set one (kept live after you change it). */
  src?: string | null;
  size?: number;
}) {
  const live = useRealm((s) => s.me);
  const picture = live ? live.avatarUrl : src;
  const shown = live?.displayName ?? name;
  return (
    <span
      aria-hidden="true"
      className="relative grid shrink-0 place-items-center rounded-full bg-accent font-display font-extrabold text-on-accent"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {picture ? (
        // biome-ignore lint/performance/noImgElement: a small uploaded picture behind an access check, not a static asset.
        <img
          src={picture}
          alt=""
          className="size-full rounded-full object-cover"
          decoding="async"
        />
      ) : (
        shown.trim().slice(0, 1).toUpperCase()
      )}
      <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-presence ring-[2.5px] ring-[var(--r-bg)]" />
    </span>
  );
}

/**
 * You: who you are, your colour, motion, settings, help and sign out. As an avatar, or as a row
 * (your picture, name and handle) at the foot of the nav column, opening upward.
 */
export function YouMenu({
  viewer,
  variant = "avatar",
}: {
  viewer: SelfUser;
  variant?: "avatar" | "row";
}) {
  const { signOut, pending, error } = useSignOut();
  const live = useRealm((s) => s.me);
  const name = live?.displayName ?? viewer.displayName;
  return (
    <Popover
      label={`You: ${name}`}
      className={variant === "row" ? "w-full" : undefined}
      placement={variant === "row" ? "above" : "below"}
      buttonClass={
        variant === "row"
          ? "flex h-14 w-full items-center gap-3 rounded-[0.9rem] px-2.5 text-left transition-colors duration-150 ease-out hover:bg-fg/6 aria-expanded:bg-fg/8"
          : "rounded-full"
      }
      panelClass="w-[19rem]"
      button={
        variant === "row" ? (
          <>
            <Me name={viewer.displayName} src={viewer.avatarUrl} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-fg">{name}</span>
              <span className="block truncate text-[0.82rem] text-fg-soft">
                @{live?.username ?? viewer.username}
              </span>
            </span>
          </>
        ) : (
          <Me name={viewer.displayName} src={viewer.avatarUrl} />
        )
      }
    >
      <Link
        href={`/u/${live?.username ?? viewer.username}`}
        className="mb-2 flex items-center gap-3 rounded-[0.8rem] px-2.5 pt-2 pb-2.5 hover:bg-fg/6"
      >
        <Me name={viewer.displayName} src={viewer.avatarUrl} size={44} />
        <div className="min-w-0">
          <p className="truncate font-bold text-fg">{name}</p>
          <p className="truncate text-[0.92rem] text-fg-soft">See your profile</p>
        </div>
      </Link>
      <div className="border-t border-line px-2.5 pt-3 pb-3">
        <p className="mb-2.5 text-[0.85rem] font-bold text-fg-soft">Your colour</p>
        <AccentPicker size="sm" />
      </div>
      <div className="border-t border-line px-1 pt-2 pb-1">
        <MotionToggle label className="w-full justify-start border-transparent px-2" />
      </div>
      <div className="border-t border-line pt-1.5">
        <Link href="/settings/account" className={row}>
          <GearSix aria-hidden="true" size={20} />
          Settings
        </Link>
        <Link href="/help" className={row}>
          <Question aria-hidden="true" size={20} />
          Help
        </Link>
        <button
          type="button"
          onClick={signOut}
          aria-disabled={pending || undefined}
          className={cx(row, "aria-disabled:cursor-progress")}
        >
          <SignOut aria-hidden="true" size={20} />
          {pending ? "Signing out" : "Sign out"}
        </button>
        {error && (
          <p role="alert" className="px-3 pt-1 pb-2 text-[0.92rem] text-danger">
            {error}
          </p>
        )}
      </div>
    </Popover>
  );
}

/**
 * Create: start a Space, or invite people to the one you're in (or your first). Group chats are
 * said honestly while they're being built.
 */
export function CreateMenu({ variant = "icon" }: { variant?: "icon" | "pill" | "row" }) {
  const pathname = usePathname();
  const spaces = useRealm((st) => st.spaces);
  const slug = pathname.match(/^\/spaces\/([^/]+)/)?.[1];
  const target = (slug && spaces.find((sp) => sp.slug === decodeURIComponent(slug))) || spaces[0];
  return (
    <Popover
      label="Create"
      className={variant === "row" ? "w-full" : undefined}
      buttonClass={
        variant === "pill"
          ? "inline-flex h-11 items-center gap-2 rounded-full bg-fg px-[18px] font-bold text-base transition-transform duration-150 ease-out hover:brightness-95 active:scale-[0.97]"
          : variant === "row"
            ? "flex h-[46px] w-full items-center gap-3.5 rounded-xl px-3 text-left text-[1rem] font-bold text-fg-soft transition-colors duration-150 ease-out hover:bg-fg/6 hover:text-fg aria-expanded:bg-fg/8 aria-expanded:text-fg"
            : iconButton
      }
      panelClass="w-[17rem]"
      placement="below"
      button={
        variant === "icon" ? (
          <Plus aria-hidden="true" size={20} />
        ) : variant === "pill" ? (
          <>
            <Plus aria-hidden="true" size={18} weight="bold" />
            Create
          </>
        ) : (
          <>
            <PlusSquare aria-hidden="true" size={24} />
            <span className="flex-1">Create</span>
          </>
        )
      }
    >
      {(close) => (
        <div>
          <p className="px-3 pt-2 pb-1.5 text-[0.85rem] font-bold text-fg-soft">Create</p>
          <button
            type="button"
            className={row}
            onClick={() => {
              close();
              openComposer({ mode: "post" });
            }}
          >
            <ImageSquare aria-hidden="true" size={20} />
            New post
          </button>
          <button
            type="button"
            className={row}
            onClick={() => {
              close();
              openComposer({ mode: "story" });
            }}
          >
            <CirclesThree aria-hidden="true" size={20} />
            New Story
          </button>
          <button
            type="button"
            className={row}
            onClick={() => {
              close();
              openComposer({ mode: "clip" });
            }}
          >
            <FilmStrip aria-hidden="true" size={20} />
            New Clip
          </button>
          <button
            type="button"
            className={row}
            onClick={() => {
              close();
              openCreateSpace();
            }}
          >
            <SquaresFour aria-hidden="true" size={20} />
            New Space
          </button>
          {target ? (
            <button
              type="button"
              className={row}
              onClick={() => {
                close();
                openInvite(target.id);
              }}
            >
              <UsersThree aria-hidden="true" size={20} />
              <span className="min-w-0 flex-1 truncate">Invite to {target.name}</span>
            </button>
          ) : (
            <p className="flex h-11 items-center gap-3 px-3 text-fg-soft">
              <UsersThree aria-hidden="true" size={20} />
              <span className="flex-1">Invite friends</span>
              <span className="text-[0.82rem]">Start a Space first</span>
            </p>
          )}
          <p className="flex h-11 items-center gap-3 px-3 text-fg-soft">
            <ChatCircleDots aria-hidden="true" size={20} />
            <span className="flex-1">New group chat</span>
            <SoonTag />
          </p>
        </div>
      )}
    </Popover>
  );
}
