import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "Realm's privacy policy in plain language: what Realm collects, why, who sees it, the services it runs on, how long it's kept and how to delete it.",
  alternates: { canonical: "/privacy" },
};

const CONTACT = "info@tomyrealm.com";

// Plain facts only, kept in step with the code: when what Realm collects or keeps changes, this
// page changes in the same piece of work (and the Play Store's data safety answers with it).
export default function PrivacyPage() {
  return (
    <DocPage
      title="Privacy policy"
      lead="What Realm collects, why, who can see it and how to delete it. Written to be read, not skimmed past. Last updated 21 November 2026."
    >
      <h2>Who we are</h2>
      <p>
        Realm is a social app (on the web at tomyrealm.com and on Android) made by an independent
        developer. "We" on this page means the people running Realm. Questions, requests and
        complaints: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
      <p>
        Realm is in an early test (beta). Things will change; when what we collect changes, this
        page changes first.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address, a password (stored only as an Argon2id
          hash, never the password itself), your username and display name, and your birthday. Your
          birthday is used to check you're 13 or older and to turn on extra protection for people
          under 18. It's never shown to anyone.
        </li>
        <li>
          <strong>Your profile, if you add it:</strong> a profile picture, banner, bio, pronouns and
          a website link.
        </li>
        <li>
          <strong>What you make and send:</strong> posts, comments, Stories, notes, messages, voice
          messages, photos, videos and files, reactions, poll votes, the Spaces you join, who you
          follow, block or mute, what you save, your playlists and liked songs, and your chosen
          colours and themes.
        </li>
        <li>
          <strong>Music:</strong> the songs you play (for Recently played) and, while{" "}
          <em>Share what I'm listening to</em> is on, the song you're playing right now, which
          people who can see your profile see. You can turn it off in Settings.
        </li>
        <li>
          <strong>Sign-ins and devices:</strong> for each device you sign in on, its name and type,
          the app or browser version, the internet (IP) address it signed in from and the country
          that address is in, and when it was last used. We also keep a short security history
          (sign-ins, password and two-step changes) with the address each came from. If you turn on
          notifications, we keep that device's notification token.
        </li>
        <li>
          <strong>Camera and microphone:</strong> used only when you take a photo or video, record a
          voice message or join a call. Realm never records in the background, and calls are not
          recorded.
        </li>
        <li>
          <strong>Help questions:</strong> what you ask <em>Ask Realm</em>, the help chat in
          Settings, is answered on Realm&apos;s own server from a fixed list of answers. No AI
          service sees it, and your questions aren&apos;t saved.
        </li>
        <li>
          <strong>Location:</strong> Realm never tracks where you are.{" "}
          <Link href="#location">More below.</Link>
        </li>
      </ul>
      <p>
        We don't show ads, don't use advertising IDs, don't track you across other apps or websites,
        don't use analytics tools, and never sell your information.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>
          To run Realm: show your posts and messages to the people you choose, and keep your
          settings.
        </li>
        <li>
          To keep accounts and people safe: stop spam and break-in attempts, check reports and act
          on them.
        </li>
        <li>
          To send the emails Realm needs: sign-in and verification codes, security alerts and
          account notices. No marketing emails.
        </li>
        <li>To send notifications, if you turn them on.</li>
      </ul>

      <h2>Who can see what</h2>
      <ul>
        <li>
          Your username, display name and profile picture are public. Your posts follow your
          settings: a private profile shows them only to the followers you approve.
        </li>
        <li>
          Messages are seen by the people in that conversation.{" "}
          <strong>They are not end-to-end encrypted yet</strong>: Realm's servers can read them. The
          same is true of Rooms in Spaces, calls, posts and profiles. That is also what lets
          moderators act on reports.
        </li>
        <li>
          A Space's moderators see what is reported in their Space, never who reported it. Serious
          reports, and anything involving someone under 18, go to the people running Realm.
        </li>
        <li>We share information with the police or courts only when the law requires it.</li>
      </ul>

      <h2>The services Realm runs on</h2>
      <p>Each one only handles what it needs for its job, and none may use it for anything else:</p>
      <ul>
        <li>
          <strong>Oracle Cloud</strong> hosts Realm's server, including the voice and video server.
          Calls pass through it live and aren't stored.
        </li>
        <li>
          <strong>Neon</strong> holds Realm's database (accounts, posts, messages).
        </li>
        <li>
          <strong>Cloudflare</strong> stores the photos, videos, voice messages and files you send
          (R2), and runs Realm's web addresses. Files are only handed out through Realm, which
          checks who may see each one first. Profile pictures are public.
        </li>
        <li>
          <strong>Resend</strong> sends Realm's emails.
        </li>
        <li>
          <strong>Google Firebase Cloud Messaging</strong> delivers notifications to your phone or
          browser, if you turn them on. A notification includes who it's from and a short preview:
          the message, comment or mention, or what happened (&quot;liked your post&quot;).
        </li>
        <li>
          <strong>Jamendo and Openverse:</strong> songs in Realm's free music library play straight
          from Jamendo, and covers load from Jamendo or Openverse, so those services see your
          device's internet address when you play a song.
        </li>
        <li>
          <strong>OpenFreeMap</strong> draws Realm's maps from OpenStreetMap data. When a map is on
          screen, your browser loads it straight from OpenFreeMap, which sees your device's internet
          address.
        </li>
        <li>
          <strong>Photon (by Komoot)</strong> finds places when you search for one. Realm's server
          asks it for you, so it never learns who you are: it gets only the words you typed and the
          rough area the map is showing (rounded to about a kilometre), so nearby places come first.
          To name a spot you picked on the map, Realm sends it just that point.
        </li>
      </ul>

      <h2 id="message-helper">The message helper</h2>
      <p>Realm has a message helper that writes or rewords a message for you.</p>
      <ul>
        <li>
          <strong>What goes to the AI service:</strong> only the text that you type into the message
          helper. The Realm server sends this text to the API of Groq, the provider of the helper
          (model llama-3.3-70b-versatile), and shows you the answer with the label &quot;AI
          answer&quot;.
        </li>
        <li>
          <strong>What does not go to Groq:</strong> your private messages, your Space chats, your
          email address, your username and your contacts. The helper never reads your chats.
        </li>
      </ul>
      <p>
        Only the Realm server talks to Groq. The app never does, and the key of the API is only on
        the server.
      </p>
      <p>
        Please do not type passwords, bank details or other secrets into the helper, because the
        text leaves Realm and goes to Groq. Groq handles the text under its own terms and privacy
        policy.
      </p>
      <p>You can send at most 20 messages a day to the helper.</p>

      <h2 id="location">Location</h2>
      <p>
        Sharing a place in chat sends that one spot, once, as a card. "Use my location" asks your
        device only when you press it. In Explore it's used for that one search, rounded to about a
        kilometre, and not kept. A Space's city is stored as the city, never an address. People
        under 18 can share places only in smaller Spaces, and can't look for Spaces nearby.
      </p>

      <h2 id="safety">Safety</h2>
      <p>
        Spam is slowed down automatically: bursts of messages, the same text again and again, and
        links from brand-new accounts. A message hides itself after 2 reports in a Space of 10 or
        fewer people, or 3 in a bigger one, until a moderator decides. Reports of sexual content
        involving someone under 18 hide the message at once and go straight to the people running
        Realm. Accounts under 18 start private, take direct messages from friends only, and show
        they're around only in Spaces of 200 people or fewer.
      </p>

      <h2 id="security">How it's protected</h2>
      <p>
        Everything travels over encrypted connections (https), and the database and stored files are
        encrypted at rest by the services that hold them. Passwords are stored with Argon2id and
        sign-in tokens only as hashes. You can turn on two-step sign-in, see every device signed in
        to your account and sign any of them out. Uploads are checked for what they really are, and
        programs can't be shared.
      </p>

      <h2 id="keeping">How long we keep it</h2>
      <p>
        As long as your account exists. Something you delete, like a post, comment or message,
        disappears from Realm straight away; a copy may stay in our records until your account is
        deleted, so reports about it can still be checked. Server logs, which can include internet
        addresses, are overwritten automatically after a short time.
      </p>
      <p>
        <strong>Deleting your account:</strong> you have 30 days to change your mind (signing in
        cancels it). Then your profile, email address, birthday, posts, comments, Stories, notes,
        follows, saves, playlists, the files you uploaded, notification tokens and the internet
        addresses of your sign-ins are erased. Messages you sent to other people stay in their
        conversations, shown as from "Deleted account", because they are part of those people's
        conversations too; delete them yourself first if you'd like them gone. Reports about serious
        harm may be kept as long as needed to keep people safe or when the law requires it.{" "}
        <Link href="/delete-account">How to delete your account.</Link>
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Get a copy</strong> of what Realm keeps about you: on the website, Settings ›
          Account › Download your information.
        </li>
        <li>
          <strong>Change or remove</strong> your profile details, and anything you've posted, at any
          time.
        </li>
        <li>
          <strong>Control who reaches you:</strong> a private profile, who can message you, read
          receipts, blocking, muting, notifications on each device, and which kinds of notification
          you get (Settings › Notifications).
        </li>
        <li>
          <strong>Delete your account</strong> in the app (Settings › Take a break or delete your
          account) or on the website (Settings › Account).{" "}
          <Link href="/delete-account">All the ways.</Link>
        </li>
        <li>
          Anything else, including questions about your rights where you live: email{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We answer within 30 days.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        Realm is for people aged 13 and over. If we learn that someone under 13 has an account, we
        delete it. If you think that's happened, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        When this policy changes, the date at the top changes. If a change affects what we collect
        or who sees it, we'll tell you in Realm before it takes effect.
      </p>
    </DocPage>
  );
}
