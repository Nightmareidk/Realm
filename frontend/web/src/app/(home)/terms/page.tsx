import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Realm's terms in plain language: who can join, what isn't allowed, how reports and moderation work, and what happens if the rules are broken.",
  alternates: { canonical: "/terms" },
};

const CONTACT = "info@tomyrealm.com";

export default function TermsPage() {
  return (
    <DocPage
      title="Terms"
      lead="The deal between you and Realm, in plain language. By creating an account you agree to these terms and the privacy policy. Last updated 19 November 2026."
    >
      <h2>Who can use Realm</h2>
      <p>
        You must be 13 or older. One person, one personal account, with a real birthday. Keep your
        password to yourself; you're responsible for what's done with your account.
      </p>

      <h2>Realm is in beta</h2>
      <p>
        Realm is still being tested. Things may break, change or go away, and we may need to pause
        the service or reset test features. We'll try to warn you first. Realm is free during the
        beta.
      </p>

      <h2>What isn't allowed</h2>
      <p>Anywhere in Realm (posts, Stories, comments, messages, Spaces, profiles, calls):</p>
      <ul>
        <li>
          <strong>Anything sexual involving someone under 18</strong>, ever. We remove it, close the
          account and report it to the authorities (our{" "}
          <Link href="/child-safety">child safety standards</Link>).
        </li>
        <li>Nudity or sexual content in public places, and sending it to people who didn't ask.</li>
        <li>
          Threats, harassment, bullying, stalking, or encouraging anyone to hurt themselves or
          others.
        </li>
        <li>
          Hate: attacking people for their race, ethnicity, religion, disability, sex, gender,
          sexual orientation or similar.
        </li>
        <li>Violent extremism, terrorism, or showing real violence to shock or celebrate it.</li>
        <li>
          Sharing someone's private information (address, phone number, private photos) without
          their permission.
        </li>
        <li>
          Pretending to be someone else, scams, fraud, spam, fake engagement, and selling or
          promoting illegal goods, drugs or weapons.
        </li>
        <li>
          Posting things you don't have the right to share, like other people's music, films or
          photos.
        </li>
        <li>
          Breaking Realm or other people's accounts: malware, hacking, scraping, or getting around
          blocks, bans and limits.
        </li>
        <li>Anything else that's illegal where you or the people you share with live.</li>
      </ul>

      <h2>Reports, blocking and moderation</h2>
      <p>
        Every post, comment, message, profile and Space can be reported, and you can block or mute
        anyone. A Space's moderators handle reports in their Space; serious reports, and anything
        involving someone under 18, go to the people running Realm. We may remove content, limit
        features, or suspend or close accounts that break these rules. Reports of serious harm come
        first. If you think we got it wrong, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>

      <h2>Your content</h2>
      <p>
        What you post stays yours. To show it to the people you choose, you let Realm store, copy
        and display it, only as far as running Realm needs. That stops when you delete it or your
        account (see the <Link href="/privacy#keeping">privacy policy</Link> for what stays).
      </p>

      <h2>Spaces</h2>
      <p>
        A Space's owner and moderators can set extra rules for their Space and remove people from
        it. They can't overrule these terms.
      </p>

      <h2>Leaving</h2>
      <p>
        You can take a break or delete your account at any time:{" "}
        <Link href="/delete-account">here's how</Link>.
      </p>

      <h2>The legal part</h2>
      <p>
        Realm is provided as it is, especially during the beta. As far as the law allows, we aren't
        responsible for what other people post or for losses from the service being unavailable.
        Nothing here takes away rights you have by law where you live. If these terms change in a
        way that matters, we'll tell you in Realm before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </DocPage>
  );
}
