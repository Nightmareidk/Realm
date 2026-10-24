import type { Metadata } from "next";
import { SettingsPlace } from "@/features/settings/settings-place";
import { VerificationForm } from "@/features/settings/verification-form";

export const metadata: Metadata = { title: "Verification" };

export default function VerificationPage() {
  return (
    <SettingsPlace
      title="Verification"
      lead="The badge beside your name says you're the real you: for well-known people, businesses and brands."
    >
      <VerificationForm />
    </SettingsPlace>
  );
}
