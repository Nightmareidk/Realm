import type { Metadata } from "next";
import { Suspense } from "react";
import { SpaceView } from "@/features/spaces/space-view";

export const metadata: Metadata = { title: "Space" };

/** A Space without a room named: its first room (the view puts the room in the address). */
export default async function SpacePage({ params }: PageProps<"/spaces/[space]">) {
  const { space } = await params;
  return (
    <Suspense>
      <SpaceView slug={decodeURIComponent(space)} />
    </Suspense>
  );
}
