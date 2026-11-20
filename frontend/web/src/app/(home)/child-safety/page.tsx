import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "Child safety",
  description:
    "Realm's standards against child sexual abuse and exploitation: what's banned, what we do about it, how to report it, and who to contact.",
  alternates: { canonical: "/child-safety" },
};

const CONTACT = "info@tomyrealm.com";

/** Realm's published standards against child sexual abuse and exploitation (CSAE). */
export default function ChildSafetyPage() {
  return (
    <DocPage
      title="Child safety"
      lead="Realm's standards against child sexual abuse and exploitation. They apply everywhere in Realm: the Android app and tomyrealm.com. Last updated 21 November 2026."
    >
      <h2>Zero tolerance</h2>
      <p>
        Realm never allows child sexual abuse material (CSAM) or any sexual exploitation of
        children. That covers posts, Stories, comments, messages, Spaces, profiles and calls. It
        includes:
      </p>
      <ul>
        <li>
          Sexual images, videos or text involving anyone under 18, real or made to look real (drawn,
          edited or made with AI).
        </li>
        <li>Grooming: an adult building contact with a young person for sexual reasons.</li>
        <li>
          Sextortion: threatening to share someone's images to get more images, money or anything
          else.
        </li>
        <li>Asking someone under 18 for sexual images, or sending them sexual content.</li>
        <li>Sharing, trading or selling such material, or links to it.</li>
      </ul>

      <h2>What we do</h2>
      <ul>
        <li>We remove the content and close the account straight away.</li>
        <li>
          We keep what investigators need and report it to the authorities: the police or national
          child-protection hotline where it happened, or NCMEC's CyberTipline.
        </li>
        <li>We work with law enforcement on requests made through proper legal channels.</li>
      </ul>

      <h2>How to report</h2>
      <ul>
        <li>
          <strong>In Realm:</strong> use Report on the post, comment, message or profile and pick
          "Sexual content involving someone under 18". These reports go straight to the people
          running Realm, not to a Space's moderators.
        </li>
        <li>
          <strong>By email:</strong> write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with
          "Child safety" in the subject. Say where it is (a link or a username). Please don't attach
          or forward the material itself.
        </li>
        <li>
          <strong>Outside Realm:</strong> you can also report to{" "}
          <a href="https://report.cybertip.org" rel="noopener noreferrer" target="_blank">
            NCMEC's CyberTipline
          </a>{" "}
          or the{" "}
          <a href="https://report.iwf.org.uk" rel="noopener noreferrer" target="_blank">
            Internet Watch Foundation
          </a>
          .
        </li>
      </ul>
      <p>
        <strong>If a child is in danger right now, call your local emergency number first.</strong>
      </p>

      <h2>Protection for teens</h2>
      <p>
        Realm is for people 13 and older, and sign-ups under 13 are refused. Accounts under 18 start
        private, can only get messages from friends, and only get friend requests from friends of
        friends.
      </p>

      <h2>Contact</h2>
      <p>
        Realm's contact for child safety, including questions from authorities about how we prevent
        CSAM: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also our{" "}
        <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.
      </p>
    </DocPage>
  );
}
