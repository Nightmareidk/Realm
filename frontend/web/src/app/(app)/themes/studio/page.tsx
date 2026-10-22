import type { Metadata } from "next";
import { Suspense } from "react";
import { Place } from "@/features/app/place";
import { StudioView } from "@/features/themes/studio";

export const metadata: Metadata = { title: "Make a theme" };

export default function StudioPage() {
  return (
    <Place
      wide
      title="Make a theme"
      lead="Change everything about how Realm looks. The previews follow each change, and Realm keeps text readable."
    >
      <Suspense>
        <StudioView />
      </Suspense>
    </Place>
  );
}
