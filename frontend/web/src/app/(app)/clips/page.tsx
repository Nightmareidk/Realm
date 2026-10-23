import type { Metadata } from "next";
import { ClipsView } from "@/features/social/clips";

export const metadata: Metadata = { title: "Clips" };

export default function ClipsPage() {
  return <ClipsView />;
}
