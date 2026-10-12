import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesView } from "@/features/messages/messages-view";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesView />
    </Suspense>
  );
}
