import { type AddressInfo, createConnection } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
} from "../test/helpers";
import { attachGateway, type Gateway } from "./gateway";

let t: TestContext;
let gateway: Gateway;
let url: string;

beforeAll(async () => {
  t = await createTestApp();
  gateway = attachGateway(t.app.server, t.deps);
  await t.app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = t.app.server.address() as AddressInfo;
  url = `ws://127.0.0.1:${port}/gateway`;
});
afterAll(async () => {
  await gateway.close();
  await t.close();
});

let ip = 0;
async function person() {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: newAccount(),
    remoteAddress: `10.20.0.${++ip}`,
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session");
  return { cookie, id: res.json().user.id as string };
}

const call = (cookie: string, method: "GET" | "POST", path: string, payload?: object) =>
  t.app.inject({ method, url: `/v1${path}`, headers: browser(cookie), payload });

interface Frame {
  op: number;
  t?: string;
  s?: number;
  d: Record<string, unknown>;
}

/** A socket that records every frame and can wait for one. */
async function connect(cookie: string) {
  const ticket = (await call(cookie, "POST", "/gateway/tickets")).json().ticket as string;
  const ws = new WebSocket(url);
  const frames: Frame[] = [];
  const waiters: { match: (f: Frame) => boolean; resolve: (f: Frame) => void }[] = [];
  ws.addEventListener("message", (e) => {
    const frame = JSON.parse(String(e.data)) as Frame;
    frames.push(frame);
    for (const w of [...waiters]) {
      if (w.match(frame)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(frame);
      }
    }
  });
  const next = (match: (f: Frame) => boolean, ms = 3000) =>
    new Promise<Frame>((resolve, reject) => {
      const seen = frames.find(match);
      if (seen) return resolve(seen);
      const timer = setTimeout(() => reject(new Error("timed out waiting for a frame")), ms);
      waiters.push({
        match,
        resolve: (f) => {
          clearTimeout(timer);
          resolve(f);
        },
      });
    });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  await next((f) => f.op === 10); // HELLO
  ws.send(JSON.stringify({ op: 2, d: { ticket, client: { platform: "web", version: "test" } } }));
  const ready = await next((f) => f.t === "READY");
  return { ws, frames, next, ready };
}

describe("gateway", () => {
  it("signs in with a ticket and carries a Space's messages to its members only", async () => {
    const noor = await person();
    const kenji = await person();
    const stranger = await person();
    const space = (await call(noor.cookie, "POST", "/communities", { name: "Lobby" })).json();
    const invite = (await call(noor.cookie, "POST", `/communities/${space.id}/invites`, {})).json();
    await call(kenji.cookie, "POST", `/invites/${invite.code}`);
    const room = space.channels[0].id as string;

    const k = await connect(kenji.cookie);
    const s = await connect(stranger.cookie);
    const spaces = k.ready.d.communities as { id: string }[];
    expect(spaces.map((c) => c.id)).toEqual([space.id]);

    await call(noor.cookie, "POST", `/channels/${room}/messages`, {
      content: "who's on",
      nonce: "x1",
    });
    const got = await k.next((f) => f.t === "MESSAGE_CREATE" && f.d.content === "who's on");
    expect(got.d.nonce).toBe("x1");
    expect(got.s).toBeGreaterThan(1);
    expect(s.frames.some((f) => f.t === "MESSAGE_CREATE")).toBe(false);

    // Kenji is around now, and Noor's member list says so.
    const members = (await call(noor.cookie, "GET", `/communities/${space.id}/members`)).json();
    expect(members.presences.map((p: { userId: string }) => p.userId)).toContain(kenji.id);

    k.ws.close();
    s.ws.close();
  });

  it("sends typing to the others in the room, not back to the typist", async () => {
    const noor = await person();
    const kenji = await person();
    const space = (await call(noor.cookie, "POST", "/communities", { name: "Typing" })).json();
    const invite = (await call(noor.cookie, "POST", `/communities/${space.id}/invites`, {})).json();
    await call(kenji.cookie, "POST", `/invites/${invite.code}`);
    const room = space.channels[0].id as string;
    const n = await connect(noor.cookie);
    const k = await connect(kenji.cookie);
    k.ws.send(JSON.stringify({ op: 8, d: { channelId: room } }));
    const typing = await n.next((f) => f.t === "TYPING_START");
    expect(typing.d).toMatchObject({ channelId: room, userId: kenji.id });
    await new Promise((r) => setTimeout(r, 150));
    expect(k.frames.some((f) => f.t === "TYPING_START")).toBe(false);
    n.ws.close();
    k.ws.close();
  });

  it("hears about a Space you join after connecting", async () => {
    const noor = await person();
    const kenji = await person();
    const k = await connect(kenji.cookie);
    const space = (await call(noor.cookie, "POST", "/communities", { name: "Later" })).json();
    const invite = (await call(noor.cookie, "POST", `/communities/${space.id}/invites`, {})).json();
    await call(kenji.cookie, "POST", `/invites/${invite.code}`);
    await k.next((f) => f.t === "COMMUNITY_CREATE" && f.d.id === space.id);
    await call(noor.cookie, "POST", `/channels/${space.channels[0].id}/messages`, {
      content: "hey",
    });
    await k.next((f) => f.t === "MESSAGE_CREATE" && f.d.content === "hey");
    k.ws.close();
  });

  it("tells the Space who's in a voice room, and when they leave", async () => {
    const noor = await person();
    const kenji = await person();
    const space = (await call(noor.cookie, "POST", "/communities", { name: "Voice" })).json();
    const invite = (await call(noor.cookie, "POST", `/communities/${space.id}/invites`, {})).json();
    await call(kenji.cookie, "POST", `/invites/${invite.code}`);
    const voice = (
      await call(noor.cookie, "POST", `/communities/${space.id}/channels`, {
        name: "hangout",
        type: "voice",
      })
    ).json();
    const n = await connect(noor.cookie);
    const k = await connect(kenji.cookie);
    k.ws.send(JSON.stringify({ op: 12, d: { channelId: voice.id } }));
    const joined = await n.next((f) => f.t === "VOICE_STATE_UPDATE" && f.d.joined === true);
    expect(joined.d).toMatchObject({ channelId: voice.id, userId: kenji.id });
    k.ws.close();
    const left = await n.next((f) => f.t === "VOICE_STATE_UPDATE" && f.d.joined === false);
    expect(left.d).toMatchObject({ channelId: voice.id, userId: kenji.id });
    n.ws.close();
  });

  it("refuses a used ticket and a foreign origin", async () => {
    const noor = await person();
    const ticket = (await call(noor.cookie, "POST", "/gateway/tickets")).json().ticket as string;
    const first = await connect(noor.cookie);
    first.ws.close();
    // The ticket from connect() was consumed; a fresh one is used once here, then again.
    const ws = new WebSocket(url);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    ws.send(JSON.stringify({ op: 2, d: { ticket, client: { platform: "web", version: "t" } } }));
    await new Promise((r) => setTimeout(r, 100));
    const again = new WebSocket(url);
    const closed = new Promise<number>((r) => again.addEventListener("close", (e) => r(e.code)));
    await new Promise((r) => again.addEventListener("open", r, { once: true }));
    again.send(JSON.stringify({ op: 2, d: { ticket, client: { platform: "web", version: "t" } } }));
    expect(await closed).toBe(4004);
    ws.close();

    // A raw handshake from another site's page is turned away before any socket opens.
    const CRLF = "\r\n";
    const { port } = t.app.server.address() as AddressInfo;
    const status = await new Promise<string>((resolve, reject) => {
      const sock = createConnection({ port, host: "127.0.0.1" }, () => {
        sock.write(
          [
            "GET /gateway HTTP/1.1",
            `Host: 127.0.0.1:${port}`,
            "Connection: Upgrade",
            "Upgrade: websocket",
            "Origin: https://evil.example",
            "Sec-WebSocket-Version: 13",
            "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
            "",
            "",
          ].join(CRLF),
        );
      });
      sock.once("data", (b) => {
        resolve(b.toString().split(CRLF)[0] ?? "");
        sock.destroy();
      });
      sock.once("error", reject);
    });
    expect(status).toBe("HTTP/1.1 403 Forbidden");
  });
});
