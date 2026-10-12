import type { Metadata } from "next";
import { Suspense } from "react";
import { SpaceView } from "@/features/spaces/space-view";

export const metadata: Metadata = { title: "Space" };

export default async function RoomPage({ params }: PageProps<"/spaces/[space]/[room]">) {
  const { space, room } = await params;
  return (
    <Suspense>
      <SpaceView slug={decodeURIComponent(space)} room={decodeURIComponent(room)} />
    </Suspense>
  );
}
