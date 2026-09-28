import type { Ink } from "@/components/avatar";

/**
 * Illustrative content for the landing-page previews. Every preview that uses it is
 * captioned as an example; none of these people, Spaces, or numbers are real.
 */

export interface DemoPerson {
  name: string;
  handle: string;
  ink: Ink;
  online: boolean;
  /** Their Realm avatar: a portrait of a 3D character from the cast. */
  avatar?: string;
}

const face = (who: string) => `/art/cast/${who}-face.webp`;

export const people = {
  noor: {
    name: "Noor Haddad",
    handle: "noor",
    ink: "feed",
    online: true,
    avatar: face("astro-teal"),
  },
  tomas: {
    name: "Tomás Ruiz",
    handle: "tomasr",
    ink: "spaces",
    online: true,
    avatar: face("alien-zib"),
  },
  kenji: {
    name: "Kenji Mori",
    handle: "kenji",
    ink: "profiles",
    online: true,
    avatar: face("monster-bruno"),
  },
  amara: {
    name: "Amara Okafor",
    handle: "amara.ok",
    ink: "boards",
    online: false,
    avatar: face("alien-nova"),
  },
  priya: {
    name: "Priya Nair",
    handle: "priya",
    ink: "spaces",
    online: true,
    avatar: face("alien-meshy"),
  },
  mateo: {
    name: "Mateo Silva",
    handle: "mateo_s",
    ink: "profiles",
    online: false,
    avatar: face("monster-gloop"),
  },
  saoirse: {
    name: "Saoirse Doyle",
    handle: "saoirse",
    ink: "feed",
    online: true,
    avatar: face("human-maya"),
  },
  ilya: {
    name: "Ilya Petrov",
    handle: "ilya",
    ink: "boards",
    online: true,
    avatar: face("human-leo"),
  },
} satisfies Record<string, DemoPerson>;

/** The viewer, for "your own message" bubbles. */
export const me = { name: "You", handle: "you", ink: "spaces", online: true } satisfies DemoPerson;

export const space = {
  name: "Late Night Lobby",
  members: 24,
  /** Rooms as the Space's tabs, in order. */
  rooms: [
    { name: "general", kind: "text" as const, unread: 0, active: true },
    { name: "clips", kind: "text" as const, unread: 3, active: false },
    { name: "lfg", kind: "text" as const, unread: 0, active: false },
    { name: "builds-and-guides", kind: "board" as const, unread: 1, active: false },
    { name: "Squad room", kind: "voice" as const, unread: 0, active: false },
  ],
  /** Who's around right now, and what they're up to. */
  here: [
    { who: people.noor, doing: "Cutting a clip" },
    { who: people.kenji, doing: "In a match, 12m" },
    { who: people.priya, doing: "In #general" },
    { who: people.tomas, doing: "Queued for ranked" },
  ],
};

export interface ChatMessage {
  who: DemoPerson;
  time: string;
  text?: string;
  mine?: boolean;
  role?: string;
  reactions?: { emoji: string; count: number; mine?: boolean }[];
  replyTo?: { name: string; text: string };
  clip?: { title: string; duration: string; image: string };
  voice?: { duration: string };
  seenBy?: DemoPerson[];
}

export const chat: ChatMessage[] = [
  { who: people.tomas, time: "9:02 PM", role: "host", text: "anyone up for ranked after 9?" },
  {
    who: people.amara,
    time: "9:03 PM",
    text: "only if kenji stops picking healer and then roaming off",
  },
  {
    who: people.kenji,
    time: "9:03 PM",
    text: "I was scouting. there's a difference",
    reactions: [
      { emoji: "💀", count: 4, mine: true },
      { emoji: "😂", count: 2 },
    ],
  },
  { who: people.priya, time: "9:04 PM", voice: { duration: "0:12" } },
  {
    who: people.noor,
    time: "9:05 PM",
    text: "last night's clip. it's too good not to post",
    clip: {
      title: "the jump that should not have worked",
      duration: "0:42",
      image: "/media/clip-monoliths-wide.webp",
    },
  },
  {
    who: me,
    time: "9:06 PM",
    text: "in for ranked. queue at 9:15?",
    mine: true,
    replyTo: { name: "Tomás", text: "anyone up for ranked after 9?" },
    seenBy: [people.tomas, people.kenji, people.noor],
  },
];

/** The event pinned at the top of #general. */
export const pinnedEvent = {
  title: "Ranked night",
  when: "Tonight, 9:15 PM",
  going: [people.tomas, people.kenji, people.priya, people.noor],
  count: 6,
};

/** Who's talking in the Space's voice room. */
export const voiceRoom = {
  name: "Squad room",
  people: [
    { who: people.kenji, speaking: true },
    { who: people.tomas, speaking: false },
    { who: people.priya, speaking: false },
  ],
};

export const clip = {
  by: people.noor,
  caption: "the jump that should not have worked",
  duration: "0:42",
  sound: "original sound · noor",
  likes: "12.4k",
  comments: 318,
  image: "/media/clip-monoliths-tall.webp",
};

export const post = {
  by: people.ilya,
  time: "2h",
  space: "Late Night Lobby",
  text: "Found the glowing gate on last night's run with @noor. Three weekends of hunting for it, zero regrets.",
  tags: ["#screenshots", "#openworld"],
  image: "/media/post-gateway.webp",
  likes: 214,
  comments: 31,
  likedBy: [people.noor, people.kenji, people.priya],
  topComment: { who: people.kenji, text: "the light coming off that gate is unreal" },
};

export const profile = {
  person: people.saoirse,
  pronouns: "she/her",
  bio: "Speedruns, sourdough, and very long voice calls.",
  banner: "/media/banner-storm.webp",
  followers: 1284,
  following: 312,
  spaces: 9,
  media: [
    "/media/media-arch.webp",
    "/media/media-storm.webp",
    "/media/media-meadow.webp",
    "/media/media-gate.webp",
    "/media/media-monoliths.webp",
    "/media/media-hills.webp",
  ],
};

export const thread = {
  channel: "builds-and-guides",
  title: "Best four-player co-op games that aren't shooters?",
  by: people.mateo,
  time: "5h",
  body: "We have four people, mixed skill levels, and two of us get motion sick. Looking for something we can sink a season into.",
  votes: 128,
  comments: 46,
  replies: [
    {
      by: people.priya,
      votes: 57,
      text: "Anything with a shared base to build. We put sixty hours into one last winter and still log in to decorate.",
      replies: [
        {
          by: people.tomas,
          votes: 21,
          text: "Seconding base builders. Pick one with a photo mode, you'll want it.",
        },
      ],
    },
    {
      by: people.ilya,
      votes: 18,
      text: "Co-op puzzle games are underrated for mixed skill groups. Nobody carries, everybody talks.",
      replies: [],
    },
  ],
};
