import type { DiscoverSpace } from "@realm/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { pill } from "@/components/pill";
import { EmptyState, Place, SoonTag } from "@/features/app/place";
import { NearbyStart } from "@/features/maps/nearby-start";
import { SpaceRows } from "@/features/spaces/space-rows";
import { cx } from "@/lib/cx";
import { serverApi } from "@/lib/server-api";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Explore" };

const SORTS = [
  { id: "active", label: "Active now", why: "Most people around right now" },
  { id: "new", label: "New", why: "Newest first" },
  { id: "members", label: "Most members", why: "Biggest first" },
  { id: "nearby", label: "Nearby", why: "Closest first, within 150 km" },
] as const;
type Sort = (typeof SORTS)[number]["id"];

/**
 * Explore, basic discovery (docs/research/2026-10-phase1-spaces-feed-safety.md §5a): public
 * Spaces as ruled rows, each saying why it's listed, with live counts. Private Spaces never
 * appear. People and topics come later.
 */
export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const params = await searchParams;
  const viewer = await getViewer();
  // Nearby is for adults only (the server refuses it for under-18s too).
  const sorts = SORTS.filter((s) => s.id !== "nearby" || (viewer && !viewer.teen));
  const asked = params.sort;
  const sort: Sort = sorts.some((s) => s.id === asked) ? (asked as Sort) : "active";
  // Nearby searches run in the browser (the point goes in a request body, never a URL).
  const spaces =
    sort === "nearby"
      ? []
      : await serverApi<{ spaces: DiscoverSpace[] }>(`/discover/communities?sort=${sort}&limit=30`)
          .then((r) => r.spaces)
          .catch(() => null);
  const why = SORTS.find((s) => s.id === sort)?.why;

  return (
    <Place title="Explore" lead="Public Spaces you can join. People and topics come later.">
      {(sort === "nearby" || (spaces && spaces.length > 1)) && (
        <nav aria-label="Sort Spaces" className="mb-8 flex flex-wrap items-center gap-2">
          {sorts.map((s) => (
            <Link
              key={s.id}
              href={s.id === "active" ? "/explore" : `/explore?sort=${s.id}`}
              aria-current={s.id === sort ? "page" : undefined}
              className={cx(
                "inline-flex h-10 items-center rounded-full px-4 text-[0.95rem] font-bold transition-colors duration-150 ease-out",
                s.id === sort
                  ? "bg-fg/8 text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
                  : "text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)] hover:text-fg",
              )}
            >
              {s.label}
            </Link>
          ))}
          <span className="ml-1 text-[0.92rem] text-fg-soft">{why}</span>
        </nav>
      )}

      {sort === "nearby" ? (
        <NearbyStart />
      ) : spaces === null ? (
        <EmptyState title="Explore couldn't load">
          <p>Realm didn't answer. Try again in a moment.</p>
        </EmptyState>
      ) : spaces.length === 0 ? (
        <EmptyState
          title="No public Spaces yet"
          action={
            <Link href="/spaces?new=1" className={pill("ghost", "md")}>
              Start a public Space
            </Link>
          }
        >
          <p>
            Public Spaces show up here for anyone to join. Private ones never do. Topics and people
            to follow come later.
          </p>
          <SoonTag>Topics: coming soon</SoonTag>
        </EmptyState>
      ) : (
        <SpaceRows spaces={spaces} />
      )}
    </Place>
  );
}
