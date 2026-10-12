import type { Metadata } from "next";
import { MotionToggle } from "@/components/motion-toggle";
import { AccentPicker } from "@/features/app/accent-picker";
import { SoonTag } from "@/features/app/place";
import { SettingsPlace, SettingsSection } from "@/features/settings/settings-place";

export const metadata: Metadata = { title: "Appearance" };

export default function AppearancePage() {
  return (
    <SettingsPlace title="Appearance">
      <SettingsSection
        id="colour"
        title="Your colour"
        lead="The light behind every screen and the colour of what you press. Your profile wears it too. Saved to your account, so it follows you to every device."
      >
        <AccentPicker />
      </SettingsSection>
      <SettingsSection
        id="mode"
        title="Night and day"
        lead="Realm is night by default. A day edition is being designed in this look."
      >
        <SoonTag>Day: coming soon</SoonTag>
      </SettingsSection>
      <SettingsSection
        id="motion"
        title="Motion"
        lead="Pause motion stops every animation, here and on Realm's site. If your device asks for reduced motion, Realm already keeps still."
      >
        <MotionToggle label />
      </SettingsSection>
      <SettingsSection
        id="own"
        title="Your own themes"
        lead="Later you'll be able to make Realm look like anything: colours, backgrounds, fonts, and share them with friends."
      >
        <SoonTag>Later</SoonTag>
      </SettingsSection>
    </SettingsPlace>
  );
}
