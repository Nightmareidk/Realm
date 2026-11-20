import type { HelpAnswer, HelpLink } from "@realm/contracts";

/**
 * "Ask Realm": a small help chat for basic questions. TEMPORARY (for the course project): it
 * matches words against the answers below, with no AI service and nothing sent anywhere. To take
 * it out, delete this folder, `shared/contracts/src/schemas/help.ts` (and its export), the
 * `/help` line in app.ts, the website's `/settings/help` page and the app's `help.tsx` screen.
 */
interface Entry {
  /** Words that point here; a phrase counts more than a single word. */
  keys: string[];
  answer: string;
  link?: HelpLink;
  /** What to ask next. */
  next?: string[];
}

const link = (label: string, web: string, app: string | null): HelpLink => ({ label, web, app });

export const STARTERS = [
  "What is Realm?",
  "How do I change my theme?",
  "How do I make my account private?",
  "How do I turn on notifications?",
];

const ENTRIES: Entry[] = [
  {
    keys: ["hello", "hi", "hey", "selam", "merhaba", "good morning", "good evening", "yo"],
    answer:
      "Hi! I'm Realm's little helper. Ask me how to do something in Realm, like changing your theme, going private, or turning on notifications.",
    next: STARTERS.slice(0, 3),
  },
  {
    keys: ["thanks", "thank you", "thx", "ty", "cheers", "tesekkur", "sagol"],
    answer: "You're welcome! Ask me anything else about Realm.",
    next: ["What is Realm?", "How do I find Spaces?"],
  },
  {
    keys: [
      "what is realm",
      "about realm",
      "about",
      "what can i do",
      "what is this",
      "tell me about",
    ],
    answer:
      "Realm puts your friends in one place: photo and text posts, Clips, Stories and Notes, chats with friends, Spaces (group hangouts with rooms), and music you can share. It works on the website and in the Android app.",
    next: ["How do I find Spaces?", "How do I add music?", "How do I post?"],
  },
  {
    keys: ["theme", "themes", "colour", "color", "look", "dark", "font", "wallpaper", "appearance"],
    answer:
      "Go to Settings, then Themes. Pick one of Realm's three looks (Now Playing, Wristband, Plain), a theme someone made, or build your own in the theme studio. Your colours follow you to every device.",
    link: link("Open Themes", "/settings/themes", "/themes"),
    next: ["How do I make my own theme?", "How do I edit my profile?"],
  },
  {
    keys: ["own theme", "make a theme", "studio", "create theme", "theme studio"],
    answer:
      "Open Themes, then the studio. Choose your colours, wallpaper and fonts, see it live, then save it. You can share it in the theme store too.",
    link: link("Open the studio", "/themes/studio", "/themes/studio"),
  },
  {
    keys: ["private", "public", "who can see", "hide my posts", "private account", "visibility"],
    answer:
      "Turn on Private account in Settings. Then only people you approve see your posts and Clips. Business accounts are always public.",
    link: link("Open privacy settings", "/settings/privacy", "/settings"),
    next: ["How do I block someone?", "What are Close Friends?"],
  },
  {
    keys: ["notification", "notifications", "notify", "push", "alerts", "buzz", "sound"],
    answer:
      "Open Settings, then Notifications, and turn them on for this device. You can choose what you hear about: messages, likes, comments, new followers and mentions, or pause them all. Realm stays quiet while you're already using it.",
    link: link("Open notification settings", "/settings/notifications", "/notifications"),
  },
  {
    keys: ["block", "blocking", "unblock", "stop someone", "harass", "bully", "creep"],
    answer:
      "Open their profile, tap the ••• menu, then Block. They can't see you or message you, and they aren't told. Unblock them any time in Settings, Blocked accounts.",
    link: link("Blocked accounts", "/settings/privacy", "/blocked"),
    next: ["How do I report something?", "How do I mute someone?"],
  },
  {
    keys: ["mute", "muting", "unmute", "hide someone", "see less"],
    answer:
      "Open their profile, tap the ••• menu, then Mute posts or Mute Stories. They aren't told, and you still follow them. Your muted list is in Settings.",
    link: link("Muted accounts", "/settings/privacy", "/muted"),
  },
  {
    keys: ["report", "reporting", "abuse", "spam", "scam", "fake account", "inappropriate"],
    answer:
      "Tap the ••• menu on the post, message or profile, then Report, and pick the reason. Reports are private. If someone is in danger, call your local emergency number first.",
    next: ["How do I block someone?"],
  },
  {
    keys: ["password", "change password", "forgot password", "reset password", "forgot"],
    answer:
      "To change it, go to Settings, then Password. If you forgot it, press Forgot password on the sign-in page and we'll email you a link.",
    link: link("Change password", "/settings/account#password", "/change-password"),
    next: ["How do I turn on two-step sign-in?"],
  },
  {
    keys: [
      "two step",
      "two-step",
      "2fa",
      "two factor",
      "authenticator",
      "security code",
      "secure my account",
      "hacked",
    ],
    answer:
      "Two-step sign-in asks for a code from an authenticator app as well as your password. Turn it on in Settings, under Security. You can also see where you're signed in and sign a device out.",
    link: link("Two-step sign-in", "/settings/account#two-step", "/two-step"),
  },
  {
    keys: [
      "delete",
      "delete account",
      "deactivate",
      "leave realm",
      "remove my account",
      "take a break",
      "close account",
    ],
    answer:
      "Go to Settings, then Take a break or delete your account. A break hides your account until you sign in again. Deleting it removes it for good after 30 days, and you can change your mind before then.",
    link: link("Take a break or delete", "/settings/account#leave", "/leave-realm"),
    next: ["How do I download my information?"],
  },
  {
    keys: ["download", "my data", "my information", "export", "copy of my data", "gdpr", "kvkk"],
    answer:
      "On the website, open Settings, then Account, then Your information. You get one file with your profile, posts, comments, Stories, saves and messages.",
    link: link("Your information", "/settings/account#your-information", null),
  },
  {
    keys: [
      "profile",
      "edit profile",
      "bio",
      "avatar",
      "profile picture",
      "profile photo",
      "display name",
      "pronouns",
    ],
    answer:
      "Go to your profile and press Edit profile. You can change your photo, name, bio, pronouns and the song on your profile.",
    link: link("Edit profile", "/settings/profile", "/edit-profile"),
  },
  {
    keys: ["post", "posting", "upload", "share a photo", "create", "new post", "caption"],
    answer:
      "Press Create (the + button). Pick photos or write a text post, add a caption, tag people, add a song, then share it. You can also post only to Close Friends.",
    next: ["What is a time capsule?", "How do I add music?"],
  },
  {
    keys: ["capsule", "time capsule", "seal", "future post", "open later"],
    answer:
      "A time capsule is a post that stays sealed until a date you choose. People see a countdown, and can press Remind me. When it opens, everyone who saved it is told.",
  },
  {
    keys: ["music", "song", "now playing", "listen", "spotify", "playlist"],
    answer:
      "Open Music to play Realm's free library. Add a song to a post, a Story or your profile. Friends can see what you play and listen along. You can turn that off in Settings.",
    link: link("Open Music", "/music", "/music"),
  },
  {
    keys: [
      "space",
      "spaces",
      "server",
      "group",
      "community",
      "room",
      "rooms",
      "join",
      "create a space",
      "make a space",
      "new space",
    ],
    answer:
      "Spaces are group hangouts with their own rooms, like a club or a server. Find one in Explore, join with an invite link, or make your own and invite friends.",
    link: link("Find Spaces", "/explore/spaces", "/explore"),
    next: ["How do voice rooms work?"],
  },
  {
    keys: [
      "voice",
      "call",
      "video",
      "voice room",
      "voice rooms",
      "voice chat",
      "talk",
      "mic",
      "microphone",
    ],
    answer:
      "Voice rooms in Spaces work on the website for now. Open a Space on tomyrealm.com and join its voice room. Voice in the phone app comes in a later version.",
  },
  {
    keys: [
      "message",
      "messages",
      "dm",
      "chat",
      "inbox",
      "text someone",
      "message request",
      "requests",
    ],
    answer:
      "Open Messages (the Inbox in the app) and start a chat with someone. If you don't follow each other, your first message arrives as a request they can accept.",
    link: link("Open Messages", "/messages", "/inbox"),
    next: ["How do I share a place?", "Are my messages encrypted?"],
  },
  {
    keys: ["place", "location", "map", "share a place", "send a place", "address"],
    answer:
      "In a chat on the website, press + then Place. Search for it or tap the map, then send. Realm only shares the place you pick, never your live location.",
  },
  {
    keys: [
      "encrypted",
      "encryption",
      "e2ee",
      "end to end",
      "safe",
      "secure messages",
      "messages encrypted",
      "who reads",
    ],
    answer:
      "Your messages travel over a secure connection (https) and are stored on Realm's servers. End-to-end encrypted chats are still being built and are switched off for now, so don't share anything very private in Realm yet.",
    link: link("Privacy policy", "/privacy", null),
  },
  {
    keys: ["close friends", "close friend", "green ring", "best friends"],
    answer:
      "Close Friends is a list you make. Share a Story, a Note or a post to Close Friends and only they see it, with a green ring. Nobody is told when you add or remove them.",
    link: link("Close Friends", "/settings/privacy", "/close-friends"),
  },
  {
    keys: ["verified", "verification", "badge", "blue tick", "check mark", "tick"],
    answer:
      "Notable people and businesses can ask for the badge in Settings, then Verification. Realm checks it by hand.",
    link: link("Verification", "/settings/verification", "/verification"),
  },
  {
    keys: ["follow", "followers", "follow request", "friends", "friend", "add friend"],
    answer:
      "Press Follow on someone's profile. If their account is private, they get a request first. People who follow each other are friends: they can see each other's Notes and what they're listening to.",
  },
  {
    keys: [
      "change email",
      "email address",
      "confirm email",
      "verify email",
      "my email",
      "new email",
    ],
    answer:
      "Your email is in Settings. Confirm it with the link Realm sends you, or change it there. Realm uses it to sign you in and to help if you're ever locked out.",
    link: link("Email settings", "/settings/account#details", "/verify-email"),
  },
  {
    keys: [
      "contact",
      "support",
      "human",
      "team",
      "bug",
      "problem",
      "not working",
      "broken",
      "crash",
      "error",
    ],
    answer:
      "Sorry it's not working! Write to info@tomyrealm.com and say what happened, on which device. A screenshot helps a lot.",
  },
];

const FALLBACK: HelpAnswer = {
  answer:
    "I'm not sure about that one yet. I know the basics: themes, privacy, notifications, posts, Spaces, music, messages and your account. Try asking one of these, or write to info@tomyrealm.com.",
  link: null,
  suggestions: STARTERS,
};

/** Lower case, Turkish letters folded, punctuation gone, so "Şifre?" and "sifre" match. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[çÇ]/g, "c")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The best answer: the entry whose words match most (phrases beat single words). */
export function answer(question: string): HelpAnswer {
  const q = ` ${normalise(question)} `;
  if (q.trim().length === 0) return FALLBACK;
  let best: Entry | null = null;
  let bestScore = 0;
  for (const e of ENTRIES) {
    let score = 0;
    for (const key of e.keys) {
      const k = normalise(key);
      if (k && q.includes(` ${k} `)) score += k.includes(" ") ? 3 : 1 + Math.min(k.length, 10) / 10;
    }
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  if (!best) return FALLBACK;
  return {
    answer: best.answer,
    link: best.link ?? null,
    suggestions: (best.next ?? []).slice(0, 4),
  };
}
