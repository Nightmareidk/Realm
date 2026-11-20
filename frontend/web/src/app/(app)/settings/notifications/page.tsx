import type { Metadata } from "next";
import { NotificationsPanel } from "@/features/settings/notifications-panel";
import { SettingsPlace } from "@/features/settings/settings-place";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <SettingsPlace
      title="Notifications"
      lead="Hear about messages, comments, mentions and new followers while you're away from Realm."
    >
      <NotificationsPanel />
    </SettingsPlace>
  );
}
