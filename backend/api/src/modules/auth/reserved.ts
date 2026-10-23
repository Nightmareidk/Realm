/** Usernames nobody can register: impersonation risks and future routes. */
export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "app",
  "about",
  "blog",
  "download",
  "downloads",
  "everyone",
  "explore",
  "feed",
  "help",
  "here",
  "home",
  "login",
  "logout",
  "me",
  "messages",
  "mod",
  "moderator",
  "moderators",
  "notifications",
  "null",
  "official",
  "privacy",
  "realm",
  "realmapp",
  "realm_team",
  "root",
  "security",
  "settings",
  "signup",
  "spaces",
  "staff",
  "status",
  "support",
  "system",
  "team",
  "terms",
  "trust",
  "undefined",
  "verify",
  "www",
]);

/** Words people wrap around a famous name to pass as its owner. */
const PREFIXES = ["official", "the", "real", "its", "iam"];
const SUFFIXES = ["official", "real", "hq", "tv", "app", "team", "page"];
/** Realm's own name with a staff word: nobody but Realm is "realm_support". */
const REALM_WORDS = [
  "",
  "app",
  "official",
  "support",
  "help",
  "team",
  "staff",
  "admin",
  "mod",
  "safety",
  "news",
];

/**
 * The forms of a username to check against reserved names: letters and numbers only, then with
 * the usual decorations taken off, one at a time ("the_real.sabrina_carpenter" → "sabrinacarpenter").
 */
export function handleForms(name: string): Set<string> {
  const start = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const forms = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const core = queue.shift() as string;
    const next = [
      ...PREFIXES.filter((p) => core.startsWith(p) && core.length > p.length + 2).map((p) =>
        core.slice(p.length),
      ),
      ...SUFFIXES.filter((x) => core.endsWith(x) && core.length > x.length + 2).map((x) =>
        core.slice(0, -x.length),
      ),
    ];
    for (const n of next) {
      if (!forms.has(n)) {
        forms.add(n);
        queue.push(n);
      }
    }
  }
  return forms;
}

/** Whether a name belongs to Realm itself ("realm", "realm_support", "official.realm"). */
export function isRealmName(name: string): boolean {
  const forms = handleForms(name);
  return REALM_WORDS.some((w) => forms.has(`realm${w}`) || (w && forms.has(`${w}realm`)));
}
