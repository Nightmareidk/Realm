"use client";

import { Globe, LockSimple } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { pill } from "@/components/pill";
import { Place } from "@/features/app/place";
import { openCreateSpace, spaceRooms, spaceUnread, useRealm } from "@/features/realtime/store";
import { NewSpacePoster, SpacePoster } from "./space-poster";

/** The Spaces destination: the ones you're in, as posters, and starting a new one. */
export function SpacesHome() {
  const spaces = useRealm((s) => s.spaces);
  const loaded = useRealm((s) => s.spacesLoaded);
  const reads = useRealm((s) => s.reads);
  const voice = useRealm((s) => s.voice);
  const params = useSearchParams();
  const router = useRouter();

  // `/spaces?new=1` (from Home or Travel) opens the sheet straight away.
  useEffect(() => {
    if (params.get("new") === "1") {
      openCreateSpace();
      router.replace("/spaces");
    }
  }, [params, router]);

  return (
    <Place
      title="Spaces"
      lead={
        loaded && spaces.length === 0
          ? "Start one for your crew, with a #general room to talk in, and send them the link."
          : "Your groups. Each Space is one place, with rooms to talk in and who's around."
      }
      wide
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="button" onClick={() => openCreateSpace()} className={pill("action", "md")}>
          Start a Space
        </button>
        <p className="text-[0.95rem] text-fg-soft">
          Got an invite link? Open it and you'll join from there.
        </p>
      </div>

      {!loaded ? (
        <p role="status" className="mt-10 text-fg-soft">
          Loading your Spaces…
        </p>
      ) : spaces.length === 0 ? null : (
        <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(11.75rem,1fr))]">
          {spaces.map((sp) => {
            const Vis = sp.visibility === "public" ? Globe : LockSimple;
            const liveRoom = spaceRooms(sp).find(
              (r) => r.type === "voice" && (voice[r.id]?.length ?? 0) > 0,
            );
            return (
              <li key={sp.id}>
                <SpacePoster
                  space={sp}
                  unread={spaceUnread(reads, sp)}
                  className="w-full"
                  status={
                    liveRoom ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-presence">
                        <span aria-hidden="true" className="size-2 rounded-full bg-presence" />
                        {liveRoom.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Vis aria-hidden="true" size={13} />
                        {sp.visibility === "public" ? "Public" : "Private"} · {sp.memberCount}{" "}
                        {sp.memberCount === 1 ? "member" : "members"}
                      </span>
                    )
                  }
                />
              </li>
            );
          })}
          <li>
            <NewSpacePoster className="w-full" />
          </li>
        </ul>
      )}
    </Place>
  );
}
