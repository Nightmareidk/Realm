import type { DiscoverSpace } from "@realm/contracts";
import Link from "next/link";
import { pill } from "@/components/pill";
import { JoinOpenButton } from "./join-open";
import { SpaceBadge } from "./space-badge";

/** Public Spaces as ruled rows: name, what it's about, why it's listed, and a way in. */
export function SpaceRows({ spaces }: { spaces: DiscoverSpace[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {spaces.map((sp) => (
        <li key={sp.id} className="flex items-center gap-4 px-1 py-4">
          <SpaceBadge name={sp.name} accent={sp.accent} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em] text-fg">
              {sp.name}
            </p>
            {sp.description && (
              <p className="mt-0.5 line-clamp-2 text-[0.95rem] text-fg-soft">{sp.description}</p>
            )}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.88rem] text-fg-soft">
              Public · {sp.memberCount} {sp.memberCount === 1 ? "member" : "members"}
              {sp.city && (
                <>
                  <span aria-hidden="true">·</span>
                  {sp.city}
                  {sp.distanceKm !== null &&
                    ` (${sp.distanceKm < 1 ? "under 1" : Math.round(sp.distanceKm)} km away)`}
                </>
              )}
              {sp.hereNow > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 rounded-full bg-presence" />
                    {sp.hereNow} here now
                  </span>
                </>
              )}
            </p>
          </div>
          {sp.joined ? (
            <Link href={`/spaces/${sp.slug}`} className={pill("quiet", "sm")}>
              Open<span className="sr-only"> {sp.name}</span>
            </Link>
          ) : (
            <JoinOpenButton slug={sp.slug} name={sp.name} />
          )}
        </li>
      ))}
    </ul>
  );
}
