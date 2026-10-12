import type { Metadata } from "next";
import { SafetyPanel } from "@/features/settings/safety-panel";
import { SettingsPlace } from "@/features/settings/settings-place";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Privacy and safety" };

export default async function PrivacyPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  return (
    <SettingsPlace
      title="Privacy and safety"
      lead="Who reaches you, and what happens when something's wrong."
    >
      <SafetyPanel viewer={viewer} />
    </SettingsPlace>
  );
}
