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
}

export const people = {
  noor: { name: "Noor Haddad", handle: "noor", ink: "feed", online: true },
  tomas: { name: "Tomás Ruiz", handle: "tomasr", ink: "spaces", online: true },
  kenji: { name: "Kenji Mori", handle: "kenji", ink: "profiles", online: true },
  amara: { name: "Amara Okafor", handle: "amara.ok", ink: "boards", online: false },
  priya: { name: "Priya Nair", handle: "priya", ink: "spaces", online: true },
  mateo: { name: "Mateo Silva", handle: "mateo_s", ink: "profiles", online: false },
  saoirse: { name: "Saoirse Doyle", handle: "saoirse", ink: "feed", online: true },
  ilya: { name: "Ilya Petrov", handle: "ilya", ink: "boards", online: true },
} satisfies Record<string, DemoPerson>;

export const space = {
  name: "Late Night Lobby",
  categories: [
    {
      name: "Chat",
      channels: [
        { name: "general", kind: "text" as const, unread: false, active: true },
        { name: "clips", kind: "text" as const, unread: true, active: false },
        { name: "lfg", kind: "text" as const, unread: false, active: false },
      ],
    },
    {
      name: "Boards",
      channels: [
        { name: "builds-and-guides", kind: "board" as const, unread: true, active: false },
      ],
    },
    {
      name: "Voice",
      channels: [{ name: "Squad room", kind: "voice" as const, unread: false, active: false }],
    },
  ],
};

export const chat = [
  { who: people.tomas, time: "9:02 PM", text: "anyone up for ranked after 9?" },
  {
    who: people.amara,
    time: "9:03 PM",
    text: "only if kenji stops picking healer and then roaming off",
  },
  {
    who: people.kenji,
    time: "9:03 PM",
    text: "I was scouting. there's a difference",
    reactions: [{ emoji: "💀", count: 4 }],
  },
  {
    who: people.noor,
    time: "9:05 PM",
    text: "posting last night's clip in #clips. it's too good not to",
  },
];

export const clip = {
  by: people.noor,
  caption: "the jump that should not have worked",
  duration: "0:42",
  image: "https://picsum.photos/seed/realm-clip-ridge/540/960",
};

export const post = {
  by: people.ilya,
  time: "2h",
  text: "Planning the next arc of our campaign. Three weekends of notes, zero regrets.",
  image: "https://picsum.photos/seed/realm-post-map/960/600",
  likes: 214,
  comments: 31,
};

export const profile = {
  person: people.saoirse,
  pronouns: "she/her",
  bio: "Speedruns, sourdough, and very long voice calls.",
  banner: "https://picsum.photos/seed/realm-profile-coast/1200/400",
  followers: 1284,
  following: 312,
  spaces: 9,
  media: [
    "https://picsum.photos/seed/realm-media-1/400/400",
    "https://picsum.photos/seed/realm-media-2/400/400",
    "https://picsum.photos/seed/realm-media-3/400/400",
    "https://picsum.photos/seed/realm-media-4/400/400",
    "https://picsum.photos/seed/realm-media-5/400/400",
    "https://picsum.photos/seed/realm-media-6/400/400",
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
