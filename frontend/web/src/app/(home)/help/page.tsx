import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "Help",
  description:
    "Getting started with Realm: what Spaces, Messages and the Feed are for, how to keep your account safe, and what to do if someone got into it.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <DocPage
      title="Help"
      lead="The help centre is being written alongside early access. Here are the basics."
    >
      <h2>Where things live</h2>
      <p>
        Spaces hold your group's rooms and boards, Messages holds your direct messages and group
        chats, and the Feed shows posts from people and Spaces you follow.
      </p>
      <p>
        During early access they arrive in stages: Spaces, chat and profiles first. Anything that
        isn't ready yet says "Coming soon" in the app.
      </p>
      <h2>Getting around fast</h2>
      <p>
        Coming with Spaces: press Ctrl K (or ⌘K on a Mac) anywhere in the app to jump to any Space,
        room or person.
      </p>

      <h2 id="account-safety">Keeping your account safe</h2>
      <p>
        Use a long password you don't use anywhere else: a few unrelated words work well. Confirm
        your email, so you know password resets and warnings will reach you. Realm emails you when
        your account signs in on a new device, and when someone keeps guessing your password (after
        a few wrong tries, sign-in to your account pauses for a while).
      </p>
      <p>
        Someone bothering you? Block them from their profile or from the menu on anything they post:
        they can't see your profile or message you, and they aren't told. Report anything that
        breaks the rules; who reported it stays private.
      </p>

      <h2 id="hacked">If you think someone got into your account</h2>
      <ol>
        <li>
          Change your password (Settings, Account). That signs out every other device straight away.
        </li>
        <li>
          Check where you're signed in (Settings, Devices) and sign out anything you don't
          recognise.
        </li>
        <li>
          If you can't sign in, use "Forgot your password?" on the sign-in screen. Resetting signs
          you out everywhere.
        </li>
        <li>If you used the same password on other sites, change it there too.</li>
      </ol>

      <h2 id="security">Found a security problem?</h2>
      <p>
        Thank you for looking. Please report it privately through{" "}
        <a href="https://github.com/Nightmareidk/Realm/security/advisories/new">
          Realm's private security reports on GitHub
        </a>{" "}
        rather than posting it publicly, so it can be fixed before anyone misuses it. Tell us what
        you found and how to see it happen.
      </p>
    </DocPage>
  );
}
