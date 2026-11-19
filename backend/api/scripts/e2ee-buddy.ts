/**
 * A second person to chat with, for trying end-to-end encrypted DMs on the local TEST server
 * without two phones. It is a real client: it makes its own keys, keeps them in a sealed store,
 * and talks to the server exactly as the app does. It refuses any server that isn't localhost.
 *
 * From realm/backend/api:
 *   pnpm exec tsx scripts/e2ee-buddy.ts whoami
 *   pnpm exec tsx scripts/e2ee-buddy.ts say <username> <text…>     start (or continue) a chat
 *   pnpm exec tsx scripts/e2ee-buddy.ts read                       fetch and show the chat
 *   pnpm exec tsx scripts/e2ee-buddy.ts reply <text…>
 *   pnpm exec tsx scripts/e2ee-buddy.ts react <n> <emoji> | edit <n> <text…> | unsend <n> | seen
 *   pnpm exec tsx scripts/e2ee-buddy.ts code                       the security code to compare
 *
 * Its account, session and keys live in realm/.data/e2ee-buddy (not in git). The storage key
 * sits in a file beside the sealed records, which is fine for a test tool and nothing else.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  aes256GcmSealer,
  type BlobStore,
  type ChatState,
  E2eeClient,
  E2eeRequestError,
  SealedKeyStore,
} from "@realm/e2ee";

const ORIGIN = process.env.REALM_BUDDY_ORIGIN ?? "http://localhost:4000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(ORIGIN)) {
  throw new Error("e2ee-buddy only talks to a server on this computer");
}
/** One line to the terminal: this is a command-line tool, so printing is its job. */
const say = (line: string | null) =>
  process.stdout.write(`${line ?? ""}
`);
const HOME = fileURLToPath(new URL("../../../.data/e2ee-buddy", import.meta.url));
mkdirSync(join(HOME, "store"), { recursive: true });

interface Account {
  email: string;
  username: string;
  password: string;
  userId: string;
  token: string;
}

const headers = (token?: string) => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Realm-Client": "android/0.1.0",
  "X-Realm-Device": "Test buddy",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function call<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${ORIGIN}/v1${path}`, {
    method,
    headers: headers(token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };
  if (!res.ok) {
    throw new E2eeRequestError(
      res.status,
      json.error?.code ?? "UNKNOWN",
      json.error?.message ?? "",
    );
  }
  return json as T;
}

/** The buddy's account: made on first use, signed in again when its session has ended. */
async function account(): Promise<Account> {
  const file = join(HOME, "account.json");
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, "utf8")) as Account;
    try {
      await call("GET", "/users/@me", undefined, saved.token);
      return saved;
    } catch {
      const again = await call<{ token: string }>("POST", "/auth/login", {
        login: saved.username,
        password: saved.password,
      });
      const next = { ...saved, token: again.token };
      writeFileSync(file, JSON.stringify(next));
      return next;
    }
  }
  const tag = randomBytes(3).toString("hex");
  const fresh = {
    email: `buddy-${tag}@example.com`,
    username: `buddy_${tag}`,
    displayName: "Test Buddy",
    password: randomBytes(18).toString("base64url"),
    birthDate: "2000-01-01",
  };
  const made = await call<{ token: string; user: { id: string } }>("POST", "/auth/register", fresh);
  const saved: Account = {
    email: fresh.email,
    username: fresh.username,
    password: fresh.password,
    userId: made.user.id,
    token: made.token,
  };
  writeFileSync(file, JSON.stringify(saved));
  return saved;
}

class Files implements BlobStore {
  private path(name: string) {
    return join(HOME, "store", name.replaceAll(":", "."));
  }
  async get(name: string) {
    return existsSync(this.path(name)) ? new Uint8Array(readFileSync(this.path(name))) : null;
  }
  async put(name: string, value: Uint8Array) {
    writeFileSync(this.path(name), value);
  }
  async delete(name: string) {
    rmSync(this.path(name), { force: true });
  }
}

function storageKey(): Uint8Array {
  const file = join(HOME, "storage.key");
  if (!existsSync(file)) writeFileSync(file, randomBytes(32));
  return new Uint8Array(readFileSync(file));
}

function show(chat: ChatState, me: string) {
  say(`\nChat ${chat.channelId}${chat.problems ? ` (${chat.problems} unreadable)` : ""}`);
  chat.messages.forEach((m, i) => {
    const who = m.authorId === me ? "buddy" : "them ";
    const marks = [
      m.editedAt ? "edited" : "",
      m.status ?? "",
      ...Object.entries(m.reactions).map(([e, users]) => `${e}x${users.length}`),
    ].filter(Boolean);
    const text = m.deleted ? "(unsent)" : m.text;
    say(`  ${i + 1}. ${who}: ${text}${marks.length ? `  [${marks.join(", ")}]` : ""}`);
  });
  const seen = Object.entries(chat.seen).map(
    ([user, id]) =>
      `${user === me ? "buddy" : "they"} read up to ${chat.messages.findIndex((m) => m.id === id) + 1}`,
  );
  if (seen.length) say(`  ${seen.join("; ")}`);
}

const [command = "whoami", ...args] = process.argv.slice(2);
const me = await account();
const client = new E2eeClient({
  userId: me.userId,
  transport: { request: (method, path, body) => call(method, path, body, me.token) },
  store: new SealedKeyStore(new Files(), aes256GcmSealer(storageKey())),
});
const state = await client.start();
if (command === "whoami") {
  say(`@${me.username} (id ${me.userId}), encrypted chats: ${state}`);
}

/** Everything except `whoami`: needs the buddy's device to be ready. */
async function chat() {
  if (state !== "ready") throw new Error(`encrypted chats aren't ready for the buddy: ${state}`);
  await client.sync();

  /** The chat this is about: the one with the newest message. */
  async function current(): Promise<ChatState> {
    const all = (await Promise.all((await client.chats()).map((id) => client.chat(id)))).filter(
      (c): c is ChatState => c !== null,
    );
    const newest = all.sort((a, b) =>
      (b.messages.at(-1)?.sentAt ?? "").localeCompare(a.messages.at(-1)?.sentAt ?? ""),
    )[0];
    if (!newest) throw new Error("no chat yet: use `say <username> <text>` first");
    return newest;
  }
  const nth = (chat: ChatState, n: string | undefined) => {
    const m = chat.messages[Number(n) - 1];
    if (!m) throw new Error(`there is no message ${n}`);
    return m;
  };

  switch (command) {
    case "say": {
      const [username, ...words] = args;
      const them = await call<{ user: { id: string } }>(
        "GET",
        `/users/${encodeURIComponent(username ?? "")}/profile`,
        undefined,
        me.token,
      );
      const channelId = await client.openDm(them.user.id);
      await client.sendText(channelId, words.join(" "));
      break;
    }
    case "reply":
      await client.sendText((await current()).channelId, args.join(" "));
      break;
    case "react": {
      const chat = await current();
      await client.react(chat.channelId, nth(chat, args[0]).id, args[1] ?? "❤️");
      break;
    }
    case "edit": {
      const chat = await current();
      await client.edit(chat.channelId, nth(chat, args[0]).id, args.slice(1).join(" "));
      break;
    }
    case "unsend": {
      const chat = await current();
      await client.remove(chat.channelId, nth(chat, args[0]).id);
      break;
    }
    case "seen": {
      const chat = await current();
      const last = chat.messages.findLast((m) => m.authorId !== me.userId && !m.deleted);
      if (last) await client.markSeen(chat.channelId, last.id);
      break;
    }
    case "code": {
      const chat = await current();
      const other = chat.messages.find((m) => m.authorId !== me.userId)?.authorId;
      say(other ? await client.safetyNumber(other) : "nobody else has written yet");
      break;
    }
    case "read":
      break;
    default:
      throw new Error(`unknown command: ${command}`);
  }
  show(await current(), me.userId);
}

if (command !== "whoami") await chat();
