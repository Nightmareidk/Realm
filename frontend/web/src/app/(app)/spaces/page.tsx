import type { Metadata } from "next";
import { Suspense } from "react";
import { SpacesHome } from "@/features/spaces/spaces-home";

export const metadata: Metadata = { title: "Spaces" };

export default function SpacesPage() {
  return (
    <Suspense>
      <SpacesHome />
    </Suspense>
  );
}
