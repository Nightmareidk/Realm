"use client";

import { Plus } from "@phosphor-icons/react";
import type { SpaceDetail } from "@realm/contracts";
import Link from "next/link";
import type { ReactNode } from "react";
import { openCreateSpace } from "@/features/realtime/store";
import { cx } from "@/lib/cx";
import { SpaceBadge, spaceLight } from "./space-badge";

const frame =
  "group relative flex shrink-0 snap-start flex-col overflow-hidden rounded-[1.25rem] p-3.5 text-left outline-offset-4 transition-[transform,box-shadow] duration-200 ease-out motion-safe:hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8),inset_0_0_0_2px_rgb(255_255_255/0.8)] focus-visible:shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8),inset_0_0_0_2px_rgb(255_255_255/0.8)]";

/**
 * A Space as a poster: its banner (or, until it has one, its own colours as a lit field), a scrim
 * so the words always read, its badge, name and what's happening there. "New" sits on top when
 * something was said since you last looked.
 */
export function SpacePoster({
  space,
  status,
  unread,
  className,
}: {
  space: SpaceDetail;
  /** One short line: what's live, who's here, or "Quiet". */
  status: ReactNode;
  unread: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/spaces/${space.slug}`}
      className={cx(frame, "aspect-[4/5] justify-end", className)}
    >
      {space.bannerUrl ? (
        // biome-ignore lint/performance/noImgElement: an uploaded banner behind an access check, not a static asset.
        <img
          src={space.bannerUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: spaceLight(space.accent) }}
        />
      )}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgb(11_11_14/0.9))]"
      />
      {unread && (
        <span className="absolute top-3 right-3 rounded-full bg-accent px-2.5 py-0.5 text-[0.78rem] font-bold text-on-accent">
          New<span className="sr-only"> messages</span>
        </span>
      )}
      <span className="relative">
        <SpaceBadge name={space.name} accent={space.accent} size={34} />
        <span className="mt-2.5 line-clamp-2 block text-[1rem] leading-tight font-bold text-fg">
          {space.name}
        </span>
        <span className="mt-1 block truncate text-[0.82rem] text-fg-soft">{status}</span>
      </span>
    </Link>
  );
}

/** The last poster in a row: start another Space. */
export function NewSpacePoster({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openCreateSpace()}
      className={cx(
        frame,
        "aspect-[4/5] items-start justify-center gap-3 text-fg-soft shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] hover:text-fg",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-fg/8">
        <Plus aria-hidden="true" size={22} />
      </span>
      <span className="font-bold text-fg">New Space</span>
      <span className="text-[0.85rem] leading-snug">
        For your crew, with rooms and a link to send.
      </span>
    </button>
  );
}
