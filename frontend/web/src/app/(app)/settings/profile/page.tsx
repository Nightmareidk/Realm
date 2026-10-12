import type { Metadata } from "next";
import { ProfileForm } from "@/features/settings/profile-form";
import { SettingsPlace } from "@/features/settings/settings-place";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  return (
    <SettingsPlace title="Profile" lead="What people see beside your messages and in Here now.">
      <ProfileForm viewer={viewer} />
    </SettingsPlace>
  );
}
