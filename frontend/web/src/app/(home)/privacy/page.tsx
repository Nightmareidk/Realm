import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Realm protects today, in plain language: encryption, the services Realm runs on, location, calls, safety tools and your controls.",
  alternates: { canonical: "/privacy" },
};

// Plain facts only. The full privacy policy is written with counsel before public launch.
export default function PrivacyPage() {
  return (
    <DocPage
      title="Privacy"
      lead="Realm's full privacy policy will be published before public launch. Until then, here is what is true today, in plain language."
    >
      <h2>What is protected, and how</h2>
      <p>
        Everything travels over encrypted connections and is encrypted at rest. Direct messages are
        coming soon. They won't be end-to-end encrypted at first, and each conversation will say so;
        end-to-end encrypted DMs and group chats are planned before public launch. Rooms in Spaces,
        voice and video calls, posts and profiles are not end-to-end encrypted: Realm's servers can
        read them, which is also what lets a Space's moderators act on reports.
      </p>

      <h2>The services Realm runs on</h2>
      <p>
        Realm is built on a handful of services. Each one sees only what it needs to do its job:
      </p>
      <ul>
        <li>
          <strong>A Postgres database</strong> (Neon or Supabase) holds accounts, Spaces and
          messages.
        </li>
        <li>
          <strong>Upstash</strong> (Redis) holds short-lived things: who's online, who's typing,
          sign-in passes and rate limits.
        </li>
        <li>
          <strong>Cloudflare R2</strong> stores the photos, videos, voice messages and files you
          send. They're only handed out through Realm, which checks who can see them first. Profile
          pictures are public.
        </li>
        <li>
          <strong>LiveKit</strong> carries voice and video calls and screen sharing. The audio and
          video pass through LiveKit's servers.
        </li>
        <li>
          <strong>Mapbox</strong> draws maps and finds places when you search. Your browser talks to
          Mapbox directly when a map or a shared place is on screen.
        </li>
        <li>
          <strong>Resend</strong> sends Realm's emails, like your verification code.
        </li>
        <li>
          <strong>Google's Firebase Cloud Messaging</strong> delivers push notifications, if you
          turn them on. A notification includes who wrote and a preview of what they said.
        </li>
      </ul>

      <h2 id="location">Location</h2>
      <p>
        Realm never tracks where you are. Sharing a place in chat sends that one spot, once, as a
        card. "Use my location" asks your browser only when you press it. In Explore it's used for
        that one search, rounded to about a kilometre, and not kept. A Space's city is stored as the
        city, never an address. People under 18 can share places only in smaller Spaces, and can't
        look for Spaces nearby.
      </p>

      <h2 id="safety">Safety</h2>
      <p>
        Spam is slowed down automatically: bursts of messages, the same text again and again, and
        links from brand-new accounts. Reports go to the Space's own moderators and never say who
        sent them. A message hides itself after 2 reports in a Space of 10 or fewer people, or 3 in
        a bigger one, until a moderator decides. Reports of sexual content involving someone under
        18 hide the message at once and go straight to the people running Realm. Accounts under 18
        start private, take direct messages from friends only, and show they're around only in
        Spaces of 200 people or fewer.
      </p>

      <h2 id="security">Security</h2>
      <p>
        Passwords are stored with Argon2id. Session tokens are stored only as hashes. You can see
        every device signed in to your account and sign any of them out from Settings. Uploads are
        checked for what they really are, and programs can't be shared.
      </p>

      <h2>Your controls</h2>
      <p>
        You can block people (their messages fold away for you), mute people and Spaces, turn push
        notifications on or off per device, and change or remove your profile picture. Choosing who
        can message you, a private profile and read receipts arrive with direct messages.
      </p>
    </DocPage>
  );
}
