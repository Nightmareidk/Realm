import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "Help",
  description:
    "Getting started with Realm: what Spaces, Messages and the Feed are for, and what arrives first during early access.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <DocPage
      title="Help"
      lead="The help centre is being written alongside early access. Here are the basics."
    >
      <h2>Where things live</h2>
      <p>
        Spaces hold your group's rooms and boards, Messages holds your direct messages and group
        chats, and the Feed shows posts from people and Spaces you follow.
      </p>
      <p>
        During early access they arrive in stages: Spaces, chat and profiles first. Anything that
        isn't ready yet says "Coming soon" in the app.
      </p>
      <h2>Getting around fast</h2>
      <p>
        Coming with Spaces: press Ctrl K (or ⌘K on a Mac) anywhere in the app to jump to any Space,
        room or person.
      </p>
    </DocPage>
  );
}
