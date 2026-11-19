import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "Delete your Realm account",
  description:
    "How to delete your Realm account in the app, on the website or by email, what is erased and what stays.",
  alternates: { canonical: "/delete-account" },
};

const CONTACT = "info@tomyrealm.com";

// The page Google Play links to as Realm's "delete account" address: it must work without the
// app installed and without signing in, so it explains every way rather than being a form.
export default function DeleteAccountPage() {
  return (
    <DocPage
      title="Delete your Realm account"
      lead="You can delete your account yourself at any time, in the app or on the website. It takes a minute."
    >
      <h2>In the Realm app</h2>
      <ol className="list-decimal space-y-2 pl-6">
        <li>
          Open Realm, go to the <strong>You</strong> tab and tap Settings (top right).
        </li>
        <li>
          Tap <strong>Take a break or delete your account</strong>, then{" "}
          <strong>Delete account</strong>.
        </li>
        <li>
          Enter your password (and your two-step code, if you use one), type "delete" and tap{" "}
          <strong>Delete my account</strong>.
        </li>
      </ol>

      <h2>On the website</h2>
      <ol className="list-decimal space-y-2 pl-6">
        <li>
          <Link href="/login">Sign in at tomyrealm.com</Link>.
        </li>
        <li>Go to Settings › Account.</li>
        <li>
          Under <strong>Delete your account</strong>, enter your password (and your two-step code,
          if you use one), type "delete" and choose <strong>Delete my account</strong>.
        </li>
      </ol>
      <p>
        Want a copy first? On the same page, <strong>Download your information</strong> gives you
        everything Realm keeps about you as one file.
      </p>

      <h2>Can't sign in?</h2>
      <p>
        Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address on your account, and say
        which account (your @username). We'll check it's you and delete it within 30 days.
      </p>

      <h2>What happens next</h2>
      <ul>
        <li>
          Your account is hidden straight away. For <strong>30 days</strong> you can change your
          mind: signing in again cancels the deletion.
        </li>
        <li>
          After 30 days it's erased for good: your profile, email address, birthday, posts,
          comments, Stories, notes, follows, saves, playlists, the files you uploaded, notification
          tokens and the internet addresses of your sign-ins.
        </li>
        <li>
          Messages you sent to other people stay in their conversations, shown as from "Deleted
          account". Delete them yourself first if you'd like them gone.
        </li>
        <li>
          Reports about serious harm may be kept as long as needed to keep people safe, or when the
          law requires it.
        </li>
      </ul>
      <p>
        If you own a Space, hand it to someone else or delete it first; Realm won't leave a Space
        without an owner. More in the <Link href="/privacy#keeping">privacy policy</Link>.
      </p>
    </DocPage>
  );
}
