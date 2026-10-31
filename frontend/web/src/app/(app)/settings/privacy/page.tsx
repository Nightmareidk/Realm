import type { Metadata } from "next";
import { CirclePanel } from "@/features/settings/circle-panel";
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
      <div className="mt-9 max-w-[44rem] space-y-9">
        <CirclePanel />
      </div>
    </SettingsPlace>
  );
}
