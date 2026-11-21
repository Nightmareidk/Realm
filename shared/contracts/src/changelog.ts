/**
 * What changed in each version of Realm, newest first. One list for everyone:
 * - the app shows the new entries' highlights once, right after an update;
 * - Settings › What's new (app and website) lists every version;
 * - the website's /changelog page shows every section in full.
 *
 * To ship an update: raise "version" in frontend/app/app.json, then add an entry at the TOP with
 * that same version and today's date. Keep the words simple. Highlights are short lines that fit
 * on a phone card (2 to 5 of them); the sections are the full story for the website.
 */
export interface ChangelogEntry {
  /** The app's version, exactly as in frontend/app/app.json ("0.2.0"). */
  version: string;
  /** When it came out, as YYYY-MM-DD. */
  date: string;
  title: string;
  /** For the "What's new" card in the app: short, most important first. */
  highlights: string[];
  /** The whole story, for the website's /changelog page. */
  sections: { heading: string; items: string[] }[];
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: "0.1.2",
    date: "2026-11-21",
    title: "Edit photos and trim videos",
    highlights: [
      "Edit a photo before you share it: cut it to a shape, turn it or mirror it.",
      "Trim a video: drag the ends to keep just the part you want.",
      "A video that's too long or too big now opens in the trimmer instead of being turned away.",
    ],
    sections: [
      {
        heading: "Photos",
        items: [
          "Tap Edit on a photo in a new post, or Edit on a photo Story.",
          "Cut it to a shape: Original, Square, 4:5 (as posts show in the feed), 9:16 (a full Story) or 16:9. Drag to move it in the frame; pinch or double-tap to zoom.",
          "Turn it a quarter at a time, or mirror it. Reset puts it back.",
          "Your photo in the gallery is never changed: Realm saves an edited copy.",
        ],
      },
      {
        heading: "Videos",
        items: [
          "Tap Trim on a Clip or a video Story. Drag either end of the strip, or drag the chosen part along it; the video plays just that part.",
          "Trimming happens on your phone and keeps the video's quality. It starts on the nearest whole picture, so it can begin a moment early.",
          "Videos over 60 seconds or 100 MB open in the trimmer with the part that fits already chosen.",
        ],
      },
    ],
  },
  {
    version: "0.1.1",
    date: "2026-11-21",
    title: "Faster, and photos and videos post again",
    highlights: [
      "Photos, videos, Stories and Clips upload again, with a progress count while they go.",
      "Screens, buttons and chats answer much faster.",
      "Sideways (landscape) videos show whole, with a button to watch them full screen.",
      'The "No messages yet" line in a new chat is no longer back to front.',
    ],
    sections: [
      {
        heading: "Fixed",
        items: [
          "Uploads from the Android app were turned away, so nothing you picked could be posted. They work again.",
          "The chat screen showed its empty-chat line mirrored on Android.",
          "Landscape videos were cut down to fill the tall screen. Now they show whole in Clips, Stories and while you make a post, and you can turn your phone to watch them full screen.",
          "The weekly music recap could fail to load.",
        ],
      },
      {
        heading: "Faster",
        items: [
          "Realm's database moved onto the same server as the app, so screens and buttons answer in a blink instead of almost a second.",
          "A copy of everything is saved every night.",
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-11-20",
    title: "The first Realm beta",
    highlights: [
      "Share photos, Stories and Clips, and chat with your friends.",
      "Notifications for messages, likes, comments and new followers, with a switch for each.",
      "Share a place in a chat, found on a free map.",
      "Make Realm yours: three looks, eight colour sets and themes people made.",
      "Stuck? Ask Realm in Settings answers quick questions.",
    ],
    sections: [
      {
        heading: "Posts, Stories and Clips",
        items: [
          "Post photos, or words on their own. Add a song, a poll or a quote of someone else's post.",
          "Stories last a day. Share them with everyone or only your Close Friends.",
          "Clips are short videos you scroll through one at a time.",
          "Time capsules: write a post that only opens on the date you choose.",
        ],
      },
      {
        heading: "Messages and Spaces",
        items: [
          "Chats and group chats, with photos, voice messages, reactions and replies.",
          "Spaces are places for a group, with their own rooms. Invite people with a link.",
          "Share a place in any chat. Search for it or pick it on the map. It's sent once, as a card, and never tracks you.",
          "Voice rooms in Spaces work on the website for now.",
        ],
      },
      {
        heading: "Music",
        items: [
          "A free music library to play while you look around, even with the screen off.",
          "Put a song on a post or a Story, and see what your friends are listening to.",
        ],
      },
      {
        heading: "Your look",
        items: [
          "Three looks: Now Playing (the default), Wristband and Plain and clear.",
          "Eight colour sets and a choice of fonts, picked separately.",
          "Make your own theme in the studio, or use one someone else made.",
        ],
      },
      {
        heading: "Notifications",
        items: [
          "Your phone or browser tells you about messages, likes, comments, mentions and new followers while you're away.",
          "Settings › Notifications has a switch for each kind, and Pause all.",
          "Tap a notification to open the chat, post or profile it's about.",
        ],
      },
      {
        heading: "Help and safety",
        items: [
          "A short tour the first time you open the app. Take it again from Settings.",
          "Ask Realm in Settings answers quick questions about using Realm.",
          "Private accounts, blocking, muting, reporting and two-step sign-in.",
          "Take a break, or delete your account, any time.",
          "Messages are not end-to-end encrypted yet. Realm will say clearly when they are.",
        ],
      },
    ],
  },
];

/** The id of a version's part of the /changelog page: "v0-1-0". */
export const changelogAnchor = (version: string) => `v${version.replaceAll(".", "-")}`;

/** Compares "0.10.2" with "0.9.0" number by number: below 0 means a is older. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The entries someone hasn't seen: newer than what they last saw, up to this version. */
export function changesSince(seen: string, current: string): ChangelogEntry[] {
  return CHANGELOG.filter(
    (e) => compareVersions(e.version, seen) > 0 && compareVersions(e.version, current) <= 0,
  );
}
