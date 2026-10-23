import type { Metadata } from "next";
import { PostPageView } from "@/features/social/post-page";

export const metadata: Metadata = { title: "Post" };

/** One post on its own page: what a shared link opens. */
export default async function PostPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  return <PostPageView key={id} id={decodeURIComponent(id)} />;
}
