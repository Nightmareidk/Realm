import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesView } from "@/features/messages/messages-view";

export const metadata: Metadata = { title: "Messages" };

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <MessagesView id={id} />
    </Suspense>
  );
}
