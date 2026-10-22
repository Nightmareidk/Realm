import type { Metadata } from "next";
import { SettingsPlace } from "@/features/settings/settings-place";
import { ThemesHome } from "@/features/themes/views";

export const metadata: Metadata = { title: "Themes" };

export default function ThemesSettingsPage() {
  return (
    <SettingsPlace
      title="Themes"
      lead="Realm's looks, your colour, themes people made, and your own. Whatever the theme, buttons, messages and safety labels work the same."
    >
      <ThemesHome />
    </SettingsPlace>
  );
}
