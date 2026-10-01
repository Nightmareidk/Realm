import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "Help",
  description:
    "Getting started with Realm: what Spaces, Messages and the Feed are for, and how to jump anywhere in the app with Ctrl K.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <DocPage title="Help">
      <p>
        The help center is being written alongside early access. The basics: Spaces hold your
        group's rooms and boards, Messages holds your DMs and group chats, and the Feed shows posts
        from people and Spaces you follow.
      </p>
      <h2>Getting around fast</h2>
      <p>
        Press Ctrl K (or ⌘K on a Mac) anywhere in the app to jump to any Space, room, or person.
      </p>
    </DocPage>
  );
}
