import type { Metadata } from "next";
import { FriendsView } from "@/features/social/friends";

export const metadata: Metadata = { title: "Friends" };

export default function FriendsPage() {
  return <FriendsView />;
}
