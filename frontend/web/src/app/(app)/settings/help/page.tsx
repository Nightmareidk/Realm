import type { Metadata } from "next";
import { HelpChat } from "@/features/settings/help-chat";
import { SettingsPlace } from "@/features/settings/settings-place";

export const metadata: Metadata = { title: "Ask Realm" };

/** Temporary (course project): the help chat. See features/settings/help-chat.tsx. */
export default function HelpPage() {
  return (
    <SettingsPlace
      title="Ask Realm"
      lead="Quick answers about using Realm. For anything else, write to info@tomyrealm.com."
    >
      <HelpChat />
    </SettingsPlace>
  );
}
