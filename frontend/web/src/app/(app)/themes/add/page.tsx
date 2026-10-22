import type { Metadata } from "next";
import { Place } from "@/features/app/place";
import { AddView } from "@/features/themes/views";

export const metadata: Metadata = { title: "Add your own theme" };

export default function AddThemePage() {
  return (
    <Place title="Add your own theme">
      <AddView />
    </Place>
  );
}
