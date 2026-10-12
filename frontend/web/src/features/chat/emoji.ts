/**
 * A hand-picked emoji set (no download): what friend groups and gamers reach for, with words to
 * search by. Quick reactions are the six most chat apps settle on, with fire in place of anger.
 */
export const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🔥"] as const;

export interface EmojiGroup {
  id: string;
  label: string;
  /** emoji → search words */
  items: [string, string][];
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: "smileys",
    label: "Smileys",
    items: [
      ["😀", "grinning happy"],
      ["😃", "smiley happy"],
      ["😄", "smile happy"],
      ["😁", "grin"],
      ["😆", "laughing"],
      ["😅", "sweat smile nervous"],
      ["🤣", "rofl rolling laughing"],
      ["😂", "joy tears laughing lol"],
      ["🙂", "slight smile"],
      ["😉", "wink"],
      ["😊", "blush happy"],
      ["😇", "halo angel innocent"],
      ["🥰", "love hearts"],
      ["😍", "heart eyes love"],
      ["🤩", "star struck wow"],
      ["😘", "kiss"],
      ["😋", "yum tasty"],
      ["😛", "tongue"],
      ["😜", "wink tongue silly"],
      ["🤪", "zany crazy"],
      ["😎", "cool sunglasses"],
      ["🤓", "nerd"],
      ["🥳", "party celebrate"],
      ["😏", "smirk"],
      ["😒", "unamused meh"],
      ["🙄", "eye roll"],
      ["😬", "grimace awkward"],
      ["😌", "relieved"],
      ["😔", "pensive sad"],
      ["😴", "sleeping tired"],
      ["🥱", "yawn bored"],
      ["🤒", "sick ill"],
      ["🥵", "hot"],
      ["🥶", "cold freezing"],
      ["🤯", "mind blown"],
      ["🤠", "cowboy"],
      ["🥺", "pleading puppy"],
      ["😢", "cry sad tear"],
      ["😭", "sob crying"],
      ["😤", "huff triumph"],
      ["😠", "angry"],
      ["😡", "rage mad"],
      ["😱", "scream shock"],
      ["😨", "fearful scared"],
      ["😳", "flushed embarrassed"],
      ["🤔", "thinking hmm"],
      ["🤫", "shush quiet secret"],
      ["🤭", "oops giggle"],
      ["🫡", "salute"],
      ["🫠", "melting"],
      ["😐", "neutral"],
      ["😶", "speechless"],
      ["😮", "wow surprised open mouth"],
      ["💀", "skull dead dying"],
      ["👻", "ghost"],
      ["🤖", "robot bot"],
      ["👽", "alien"],
      ["🤡", "clown"],
      ["💩", "poop"],
    ],
  },
  {
    id: "people",
    label: "Hands and people",
    items: [
      ["👍", "thumbs up yes like"],
      ["👎", "thumbs down no"],
      ["👏", "clap applause"],
      ["🙌", "raised hands yay"],
      ["🙏", "pray please thanks"],
      ["🤝", "handshake deal"],
      ["👋", "wave hi hello bye"],
      ["✌️", "peace victory"],
      ["🤞", "fingers crossed luck"],
      ["🤟", "love you"],
      ["🤘", "rock on"],
      ["👌", "ok perfect"],
      ["🤌", "pinched chef"],
      ["👊", "fist bump"],
      ["✊", "fist"],
      ["🤙", "call me shaka"],
      ["👉", "point right"],
      ["👆", "point up"],
      ["💪", "strong muscle flex"],
      ["🫶", "heart hands"],
      ["🫂", "hug"],
      ["👀", "eyes looking"],
      ["🧠", "brain smart"],
      ["🗣️", "speaking shouting"],
      ["🤷", "shrug dunno"],
      ["🤦", "facepalm"],
      ["🙋", "raising hand me"],
      ["💃", "dance"],
      ["🕺", "dance"],
    ],
  },
  {
    id: "hearts",
    label: "Hearts and sparkle",
    items: [
      ["❤️", "red heart love"],
      ["🧡", "orange heart"],
      ["💛", "yellow heart"],
      ["💚", "green heart"],
      ["💙", "blue heart"],
      ["💜", "purple heart"],
      ["🖤", "black heart"],
      ["🤍", "white heart"],
      ["💔", "broken heart"],
      ["💕", "two hearts"],
      ["💖", "sparkling heart"],
      ["💯", "hundred perfect"],
      ["✨", "sparkles"],
      ["🔥", "fire lit hot"],
      ["⭐", "star"],
      ["🌟", "glowing star"],
      ["💥", "boom"],
      ["💫", "dizzy"],
      ["🎉", "tada party congrats"],
      ["🎊", "confetti"],
      ["🏳️‍🌈", "pride rainbow flag"],
    ],
  },
  {
    id: "games",
    label: "Games and activities",
    items: [
      ["🎮", "game controller gaming"],
      ["🕹️", "joystick arcade"],
      ["🏆", "trophy win"],
      ["🥇", "gold medal first"],
      ["🎯", "bullseye target"],
      ["🎲", "dice"],
      ["♟️", "chess"],
      ["🃏", "joker cards"],
      ["🎧", "headphones"],
      ["🎤", "mic sing"],
      ["🎸", "guitar"],
      ["🎵", "music note"],
      ["⚽", "football soccer"],
      ["🏀", "basketball"],
      ["🏈", "american football"],
      ["🎾", "tennis"],
      ["🏓", "ping pong"],
      ["🛹", "skateboard"],
      ["🏃", "run"],
      ["🎬", "movie film"],
      ["📸", "camera photo"],
      ["🎨", "art paint"],
      ["🧩", "puzzle"],
      ["⚔️", "swords battle"],
      ["🛡️", "shield"],
      ["🏹", "bow arrow"],
    ],
  },
  {
    id: "food",
    label: "Food and drink",
    items: [
      ["🍕", "pizza"],
      ["🍔", "burger"],
      ["🍟", "fries"],
      ["🌮", "taco"],
      ["🍣", "sushi"],
      ["🍜", "ramen noodles"],
      ["🍩", "donut"],
      ["🍪", "cookie"],
      ["🍫", "chocolate"],
      ["🍿", "popcorn"],
      ["🍦", "ice cream"],
      ["🎂", "cake birthday"],
      ["🍉", "watermelon"],
      ["🍓", "strawberry"],
      ["🥑", "avocado"],
      ["☕", "coffee"],
      ["🧋", "boba bubble tea"],
      ["🥤", "soda drink"],
      ["🧃", "juice"],
      ["🍺", "beer"],
    ],
  },
  {
    id: "world",
    label: "Animals, nature and travel",
    items: [
      ["🐶", "dog puppy"],
      ["🐱", "cat"],
      ["🦊", "fox"],
      ["🐼", "panda"],
      ["🐸", "frog"],
      ["🐧", "penguin"],
      ["🦄", "unicorn"],
      ["🐉", "dragon"],
      ["🦋", "butterfly"],
      ["🐐", "goat goat"],
      ["🌸", "blossom flower"],
      ["🌈", "rainbow"],
      ["☀️", "sun"],
      ["🌙", "moon night"],
      ["⚡", "lightning zap"],
      ["❄️", "snow"],
      ["🌊", "wave ocean"],
      ["🌍", "earth world"],
      ["🚀", "rocket launch"],
      ["✈️", "plane travel"],
      ["🚗", "car"],
      ["🏠", "home house"],
      ["🌃", "night city"],
    ],
  },
  {
    id: "symbols",
    label: "Objects and symbols",
    items: [
      ["💡", "idea"],
      ["📌", "pin"],
      ["🔔", "bell"],
      ["💬", "speech chat"],
      ["💭", "thought"],
      ["✅", "check done yes"],
      ["❌", "cross no wrong"],
      ["❓", "question"],
      ["❗", "exclamation"],
      ["‼️", "double exclamation"],
      ["⚠️", "warning"],
      ["🆗", "ok button"],
      ["🆒", "cool button"],
      ["💰", "money"],
      ["💎", "gem diamond"],
      ["🎁", "gift present"],
      ["⏰", "alarm time"],
      ["📅", "calendar date"],
      ["🔗", "link"],
      ["👑", "crown king queen"],
      ["🪄", "magic wand"],
      ["🧢", "cap"],
      ["📍", "location pin"],
    ],
  },
];

const RECENT_KEY = "realm:recent-emoji";

/** The last few emoji you picked on this device. */
export function recentEmoji(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((e) => typeof e === "string").slice(0, 16) : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji: string) {
  try {
    const next = [emoji, ...recentEmoji().filter((e) => e !== emoji)].slice(0, 16);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

/** The name screen readers say for an emoji (its first search word). */
export function emojiName(emoji: string): string {
  for (const g of EMOJI_GROUPS) {
    const hit = g.items.find(([e]) => e === emoji);
    if (hit) return hit[1].split(" ").slice(0, 2).join(" ");
  }
  return emoji;
}
