import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Realm protects today, in plain language: encryption in transit and at rest, when end-to-end encrypted messages arrive, and your controls.",
  alternates: { canonical: "/privacy" },
};

// Plain facts only. The full privacy policy is written with counsel before public launch.
export default function PrivacyPage() {
  return (
    <DocPage title="Privacy">
      <p>
        Realm's full privacy policy will be published before public launch. Until then, here is what
        is true today, in plain language.
      </p>
      <h2>What is protected, and how</h2>
      <p>
        Everything travels over encrypted connections and is encrypted at rest. During early access,
        direct messages are not end-to-end encrypted yet; end-to-end encrypted DMs and group chats
        arrive before public launch, and Realm labels every conversation until then. Public Spaces,
        posts, and profiles are not end-to-end encrypted, because they need to be moderated,
        searched, and shown to people who join later.
      </p>
      <h2 id="security">Security</h2>
      <p>
        Passwords are stored with Argon2id. Session tokens are stored only as hashes. You can see
        every device signed in to your account and sign any of them out from Settings.
      </p>
      <h2>Your controls</h2>
      <p>
        You choose who can message you, whether your profile is private, and whether others see read
        receipts.
      </p>
      <p>
        <Link href="/" className="text-ink underline">
          Back to Realm
        </Link>
      </p>
    </DocPage>
  );
}
