import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileView } from "@/features/social/profile";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
}

/** Someone's profile (you, when it's yours): posts, Clips, Highlights, followers. */
export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  return (
    <Suspense>
      <ProfileView key={username} username={decodeURIComponent(username)} />
    </Suspense>
  );
}
