import { redirect } from "next/navigation";

/** The feed lives on Home now. */
export default function FeedPage() {
  redirect("/home");
}
