import type { Metadata } from "next";
import { Place } from "@/features/app/place";
import { StoreView } from "@/features/themes/views";

export const metadata: Metadata = { title: "More themes" };

export default function ThemeStorePage() {
  return (
    <Place
      wide
      title="More themes"
      lead="Themes people made, free and paid. Try any theme on before you get it."
    >
      <StoreView />
    </Place>
  );
}
