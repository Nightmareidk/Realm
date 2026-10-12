import type { Metadata } from "next";
import { EmptyState, Place, SoonTag } from "@/features/app/place";

export const metadata: Metadata = { title: "Feed" };

export default function FeedPage() {
  return (
    <Place title="Feed" lead="Posts and clips from the people and Spaces you follow.">
      <EmptyState title="The feed is being built" action={<SoonTag />}>
        <p>
          Three tabs: For you, where every pick says why it's there; Following, newest first; and
          your Spaces. It stops when you're caught up. Clips come after.
        </p>
      </EmptyState>
    </Place>
  );
}
