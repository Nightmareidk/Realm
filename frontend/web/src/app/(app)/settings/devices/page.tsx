import type { Metadata } from "next";
import { SessionsList } from "@/features/settings/sessions-list";
import { SettingsPlace } from "@/features/settings/settings-place";

export const metadata: Metadata = { title: "Devices" };

export default function DevicesPage() {
  return (
    <SettingsPlace
      title="Devices"
      lead="Everywhere you're signed in. If you don't recognise a device, sign it out and change your password."
    >
      <SessionsList />
    </SettingsPlace>
  );
}
