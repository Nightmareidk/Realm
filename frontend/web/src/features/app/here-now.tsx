"use client";

import type { SelfUser } from "@realm/contracts";
import { usePathname } from "next/navigation";
import { findSpaceBySlug, useRealm } from "@/features/realtime/store";
import { SpaceHereNow } from "@/features/spaces/space-here-now";
import { Me } from "./menus";
import { SoonTag } from "./place";

/**
 * Here now: the people who are around, with what they're up to. Inside a Space it's that
 * Space's people. Elsewhere it lists you first, so it's never blank, and says what will show
 * once friends arrive. The heading takes focus when the panel opens over the page.
 */
export function HereNow({ viewer }: { viewer: SelfUser }) {
  const pathname = usePathname();
  const slug = pathname.match(/^\/spaces\/([^/]+)/)?.[1];
  const space = useRealm((s) => (slug ? findSpaceBySlug(s, decodeURIComponent(slug)) : undefined));
  if (space) return <SpaceHereNow space={space} />;

  return (
    <div className="flex flex-col gap-4">
      <h2
        id="here-now-title"
        tabIndex={-1}
        className="px-1 font-display text-[1.25rem] font-extrabold tracking-[-0.025em] text-fg outline-none"
      >
        Here now
      </h2>
      <div className="flex items-center gap-3 px-1">
        <Me name={viewer.displayName} src={viewer.avatarUrl} size={40} />
        <div className="min-w-0">
          <p className="truncate font-bold text-fg">{viewer.displayName} (you)</p>
          <p className="text-[0.88rem] text-fg-soft">Around</p>
        </div>
      </div>
      <div className="border-t border-line px-1 pt-4 text-[0.92rem] leading-relaxed text-fg-soft">
        <p className="font-bold text-fg">Your crew shows up here</p>
        <p className="mt-1">
          Open a Space to see who's in it and who's around. Friends, and what they're up to, come
          next.
        </p>
        <div className="mt-3">
          <SoonTag>Friends are coming soon</SoonTag>
        </div>
      </div>
    </div>
  );
}
