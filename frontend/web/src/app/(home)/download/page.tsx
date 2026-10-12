import type { Metadata } from "next";
import { EditionsSection } from "@/features/landing/sections/editions";
import { getReleases } from "@/lib/releases";

export const metadata: Metadata = {
  title: "Download",
  description: "Use Realm in your browser today. Desktop and phone apps are on the way.",
  alternates: { canonical: "/download" },
};

export default async function DownloadPage() {
  return <EditionsSection releases={await getReleases()} headingLevel="h1" />;
}
