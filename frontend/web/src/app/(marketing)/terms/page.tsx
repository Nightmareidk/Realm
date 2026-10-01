import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Realm's terms during early access: who can join, the ground rules, and when the full terms of service will be published.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <DocPage title="Terms">
      <p>
        Realm's terms of service will be published before public launch. Early access is for people
        aged 13 and over, and the usual rules apply in the meantime: be decent to each other, don't
        post anything illegal, and don't try to break the service.
      </p>
    </DocPage>
  );
}
