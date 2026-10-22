import { eq, schema } from "@realm/db";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
} from "../../test/helpers";

let t: TestContext;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

let ip = 0;
async function person(overrides: Partial<Record<string, string>> = {}, established = true) {
  const account = newAccount(overrides);
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: account,
    remoteAddress: `10.70.${Math.floor(++ip / 250)}.${ip % 250}`,
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session");
  const id = res.json().user.id as string;
  if (established) {
    // Email confirmed, and the account a few days old.
    await t.deps.db
      .update(schema.users)
      .set({ emailVerifiedAt: new Date(), createdAt: new Date(Date.now() - 5 * 86_400_000) })
      .where(eq(schema.users.id, BigInt(id)));
  }
  return { cookie, id };
}

type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
const call = (cookie: string | undefined, method: Method, url: string, payload?: unknown) =>
  t.app.inject({
    method,
    url: `/v1${url}`,
    headers: browser(cookie),
    ...(payload === undefined ? {} : { payload: payload as object }),
  });

async function upload(cookie: string, bytes: Buffer, mimeType = "image/png") {
  const ticket = await call(cookie, "POST", "/media/uploads", {
    kind: "image",
    mimeType,
    sizeBytes: bytes.length,
  });
  const { mediaId, uploadUrl } = ticket.json();
  await t.app.inject({
    method: "PUT",
    url: uploadUrl.replace(/^\/api/, ""),
    headers: { "content-type": mimeType },
    payload: bytes,
  });
  const done = await call(cookie, "POST", `/media/${mediaId}/complete`);
  expect(done.statusCode).toBe(200);
  return mediaId as string;
}

const picture = (color: string) =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: color } })
    .png()
    .toBuffer();

const theme = (overrides: Record<string, unknown> = {}) => ({
  format: "realm-theme",
  version: 1,
  name: "Gotham Night",
  description: "Dark streets and a yellow signal.",
  look: "now-playing",
  colors: {
    ground: "#0a0a0c",
    surface: "#141418",
    raised: "#1e1e24",
    line: "#2a2a31",
    text: "#f5f5f0",
    textSoft: "#b4b4bc",
    accent: "#ffd400",
    onAccent: "#141400",
    lights: ["#6b5a00", "#2b2b40", "#3a3a48"],
  },
  art: { effect: { shape: "bats", color: "#ffd400", amount: "few" } },
  ...overrides,
});

async function make(cookie: string, body: Record<string, unknown> = {}) {
  const res = await call(cookie, "POST", "/themes", { file: theme(), tags: ["dark"], ...body });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().theme as { id: string; status: string };
}

describe("the theme store", () => {
  it("goes from draft to the store, and others add it, use it and drop it", async () => {
    const noor = await person();
    const kenji = await person();
    const draft = await make(noor.cookie);
    expect(draft.status).toBe("draft");

    // Not in the store yet, and nobody else can open it.
    expect(
      (await call(kenji.cookie, "GET", "/themes")).json().items.map((i: { id: string }) => i.id),
    ).not.toContain(draft.id);
    expect((await call(kenji.cookie, "GET", `/themes/${draft.id}`)).statusCode).toBe(404);

    const out = await call(noor.cookie, "POST", `/themes/${draft.id}/publish`);
    expect(out.statusCode, out.body).toBe(200);
    expect(out.json().status).toBe("published");

    const found = await call(undefined, "GET", "/themes?q=gotham&tag=dark&price=free");
    expect(found.json().items[0]).toMatchObject({ id: draft.id, priceCents: 0, owned: false });

    const got = await call(kenji.cookie, "POST", `/themes/${draft.id}/get`);
    expect(got.json()).toMatchObject({ owned: true, installs: 1 });
    // Adding twice doesn't count twice.
    expect((await call(kenji.cookie, "POST", `/themes/${draft.id}/get`)).json().installs).toBe(1);

    const use = await call(kenji.cookie, "PUT", "/themes/active", {
      kind: "theme",
      themeId: draft.id,
    });
    expect(use.json()).toMatchObject({ active: { kind: "theme" }, file: { name: "Gotham Night" } });

    await call(kenji.cookie, "DELETE", `/themes/${draft.id}/library`);
    const after = await call(kenji.cookie, "GET", "/themes/active");
    expect(after.json()).toMatchObject({
      active: { kind: "look", look: "now-playing" },
      file: null,
    });
  });

  it("starts everyone on Now Playing and switches between Realm's looks", async () => {
    const mei = await person();
    expect((await call(mei.cookie, "GET", "/themes/active")).json().active).toEqual({
      kind: "look",
      look: "now-playing",
      accent: "mint",
    });
    const set = await call(mei.cookie, "PUT", "/themes/active", {
      kind: "look",
      look: "wristband",
      accent: "orchid",
    });
    expect(set.json().active).toEqual({ kind: "look", look: "wristband", accent: "orchid" });
  });

  it("asks for a confirmed email before sharing", async () => {
    const fresh = await person({}, false);
    const draft = await make(fresh.cookie);
    const out = await call(fresh.cookie, "POST", `/themes/${draft.id}/publish`);
    expect(out.statusCode).toBe(403);
    expect(out.json().error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("fixes hard-to-read colours and says so", async () => {
    const noor = await person();
    const res = await call(noor.cookie, "POST", "/themes", {
      file: theme({ colors: { ...theme().colors, text: "#333333", textSoft: "#2a2a2a" } }),
    });
    expect(res.statusCode).toBe(201);
    const { theme: saved, problems } = res.json();
    expect(problems.join(" ")).toMatch(/hard to read.*adjusted/s);
    expect(saved.file.colors.text).not.toBe("#333333");
  });

  it("measures a wallpaper and dims it enough to read over", async () => {
    const noor = await person();
    const white = await upload(noor.cookie, await picture("#ffffff"));
    const res = await call(noor.cookie, "POST", "/themes/check", {
      file: theme({ art: { wallpaper: { image: `media:${white}`, dim: 0.2, blur: "none" } } }),
    });
    expect(res.json().ok).toBe(true);
    expect(res.json().file.art.wallpaper.dim).toBeGreaterThan(0.8);
  });

  it("lets a theme's pictures be seen once it's in the store, not before", async () => {
    const noor = await person();
    const kenji = await person();
    const wall = await upload(noor.cookie, await picture("#202030"));
    const draft = await make(noor.cookie, {
      file: theme({ art: { wallpaper: { image: `media:${wall}`, dim: 0.5, blur: "soft" } } }),
    });
    expect((await call(kenji.cookie, "GET", `/media/${wall}/raw`)).statusCode).toBe(404);
    await call(noor.cookie, "POST", `/themes/${draft.id}/publish`);
    expect((await call(kenji.cookie, "GET", `/media/${wall}/raw`)).statusCode).toBe(302);
  });
});

describe("selling themes", () => {
  it("needs the art to be yours, an adult seller, and payments switched on", async () => {
    const noor = await person();
    const draft = await make(noor.cookie);
    const noBox = await call(noor.cookie, "PATCH", `/themes/${draft.id}`, { priceCents: 299 });
    expect(noBox.statusCode).toBe(400);
    const priced = await call(noor.cookie, "PATCH", `/themes/${draft.id}`, {
      priceCents: 299,
      ownArt: true,
    });
    expect(priced.json().priceCents).toBe(299);
    const odd = await call(noor.cookie, "PATCH", `/themes/${draft.id}`, { priceCents: 123 });
    expect(odd.statusCode).toBe(400);

    const out = await call(noor.cookie, "POST", `/themes/${draft.id}/publish`);
    expect(out.statusCode).toBe(503);
    expect(out.json().error.code).toBe("PAYMENTS_NOT_SET_UP");
    expect((await call(undefined, "GET", "/themes/payments")).json()).toMatchObject({
      enabled: false,
      cutPercent: 12,
    });
  });

  it("keeps under-18s to free themes", async () => {
    const teen = await person({ birthDate: "2012-03-01" });
    const draft = await make(teen.cookie);
    const res = await call(teen.cookie, "PATCH", `/themes/${draft.id}`, {
      priceCents: 199,
      ownArt: true,
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("theme attacks", () => {
  it("refuses theme files carrying code, web addresses or extra fields", async () => {
    const noor = await person();
    const bad = [
      theme({ css: "body{display:none}" }),
      theme({ colors: { ...theme().colors, accent: "url(https://evil.example/x)" } }),
      theme({ colors: { ...theme().colors, ground: "#000;background:red" } }),
      theme({ name: "<img src=x onerror=alert(1)>" }),
      theme({
        art: { wallpaper: { image: "https://evil.example/t.png", dim: 0.5, blur: "none" } },
      }),
      theme({ art: { stickers: { header: "images/../../secret.png" } } }),
      theme({ look: "../../etc" }),
    ];
    for (const file of bad) {
      const res = await call(noor.cookie, "POST", "/themes", { file });
      expect(res.statusCode, JSON.stringify(file)).toBe(400);
    }
    const big = await call(noor.cookie, "POST", "/themes", {
      file: theme({ description: "x".repeat(70_000) }),
    });
    expect(big.statusCode).toBe(413);
  });

  it("keeps people out of other people's themes (no peeking or changing by ID)", async () => {
    const noor = await person();
    const kenji = await person();
    const draft = await make(noor.cookie);
    const tries: [Method, string, unknown?][] = [
      ["PATCH", `/themes/${draft.id}`, { tags: ["cute"] }],
      ["POST", `/themes/${draft.id}/publish`],
      ["POST", `/themes/${draft.id}/versions`, { file: theme({ name: "Mine now" }) }],
      ["DELETE", `/themes/${draft.id}`],
    ];
    for (const [m, url, body] of tries) {
      expect([403, 404]).toContain((await call(kenji.cookie, m, url, body)).statusCode);
    }
    expect((await call(kenji.cookie, "GET", `/themes/${draft.id}/file`)).statusCode).toBe(404);
    expect((await call(kenji.cookie, "POST", `/themes/${draft.id}/get`)).statusCode).toBe(404);
    const use = await call(kenji.cookie, "PUT", "/themes/active", {
      kind: "theme",
      themeId: draft.id,
    });
    expect(use.statusCode).toBe(403);
    // Still Noor's, unchanged.
    expect((await call(noor.cookie, "GET", `/themes/${draft.id}`)).json().name).toBe(
      "Gotham Night",
    );
  });

  it("drops pictures that aren't yours, and keeps borrowed ones out of the store", async () => {
    const noor = await person();
    const kenji = await person();
    const theirs = await upload(kenji.cookie, await picture("#303030"));
    const res = await call(noor.cookie, "POST", "/themes", {
      file: theme({ art: { stickers: { header: `media:${theirs}` } } }),
    });
    expect(res.json().theme.file.art?.stickers).toBeUndefined();
    expect(res.json().problems.join(" ")).toMatch(/isn't available/);

    // Kenji adds Noor's free theme and may use its wallpaper for himself, but not sell or share it.
    const wall = await upload(noor.cookie, await picture("#202030"));
    const shared = await make(noor.cookie, {
      file: theme({ art: { wallpaper: { image: `media:${wall}`, dim: 0.5, blur: "none" } } }),
    });
    await call(noor.cookie, "POST", `/themes/${shared.id}/publish`);
    await call(kenji.cookie, "POST", `/themes/${shared.id}/get`);
    const copy = await make(kenji.cookie, {
      file: theme({
        name: "Copy",
        art: { wallpaper: { image: `media:${wall}`, dim: 0.5, blur: "none" } },
      }),
    });
    const out = await call(kenji.cookie, "POST", `/themes/${copy.id}/publish`);
    expect(out.statusCode).toBe(400);
    expect(out.json().error.message).toMatch(/pictures you uploaded yourself/);
  });

  it("searches safely whatever is typed", async () => {
    for (const q of ["%' OR 1=1 --", "_", "%", "\\", "'; DROP TABLE themes; --"]) {
      const res = await call(undefined, "GET", `/themes?q=${encodeURIComponent(q)}`);
      expect(res.statusCode).toBe(200);
      expect(res.json().items).toEqual([]);
    }
  });

  it("only takes reviews from people who have the theme, without links", async () => {
    const noor = await person();
    const kenji = await person();
    const draft = await make(noor.cookie);
    await call(noor.cookie, "POST", `/themes/${draft.id}/publish`);
    expect(
      (await call(noor.cookie, "PUT", `/themes/${draft.id}/review`, { stars: 5 })).statusCode,
    ).toBe(403);
    expect(
      (await call(kenji.cookie, "PUT", `/themes/${draft.id}/review`, { stars: 5 })).statusCode,
    ).toBe(403);
    await call(kenji.cookie, "POST", `/themes/${draft.id}/get`);
    const link = await call(kenji.cookie, "PUT", `/themes/${draft.id}/review`, {
      stars: 5,
      text: "free stuff at www.scam.example",
    });
    expect(link.statusCode).toBe(400);
    const ok = await call(kenji.cookie, "PUT", `/themes/${draft.id}/review`, {
      stars: 4,
      text: "love it",
    });
    expect(ok.json()).toMatchObject({ rating: 4, ratingCount: 1 });
    // Changing your review doesn't count twice.
    const again = await call(kenji.cookie, "PUT", `/themes/${draft.id}/review`, { stars: 2 });
    expect(again.json()).toMatchObject({ rating: 2, ratingCount: 1 });
  });

  it("hides a theme after three established reports; owners keep it", async () => {
    const noor = await person();
    const fans = [await person(), await person(), await person()];
    const draft = await make(noor.cookie);
    await call(noor.cookie, "POST", `/themes/${draft.id}/publish`);
    await call(fans[0]?.cookie, "POST", `/themes/${draft.id}/get`);
    expect(
      (await call(noor.cookie, "POST", `/themes/${draft.id}/report`, { reason: "spam" }))
        .statusCode,
    ).toBe(403);
    await call(fans[0]?.cookie, "POST", `/themes/${draft.id}/report`, { reason: "not-their-art" });
    const twice = await call(fans[0]?.cookie, "POST", `/themes/${draft.id}/report`, {
      reason: "spam",
    });
    expect(twice.statusCode).toBe(409);
    let hidden = false;
    for (const f of fans.slice(1)) {
      hidden = (
        await call(f.cookie, "POST", `/themes/${draft.id}/report`, { reason: "not-their-art" })
      ).json().hidden;
    }
    expect(hidden).toBe(true);
    const store = await call(undefined, "GET", "/themes?q=gotham");
    expect(store.json().items.map((i: { id: string }) => i.id)).not.toContain(draft.id);
    const lib = await call(fans[0]?.cookie, "GET", "/themes/library");
    expect(lib.json().items.map((i: { id: string }) => i.id)).toContain(draft.id);
    expect((await call(noor.cookie, "POST", `/themes/${draft.id}/publish`)).statusCode).toBe(403);
  });
});

describe("colours from a picture", () => {
  it("suggests readable colour sets from your own picture, not someone else's", async () => {
    const noor = await person();
    const kenji = await person();
    const red = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#c01830" } })
      .composite([
        {
          input: await sharp({ create: { width: 16, height: 32, channels: 3, background: "#101018" } })
            .png()
            .toBuffer(),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
    const pic = await upload(noor.cookie, red);
    const res = await call(noor.cookie, "POST", "/themes/palette", { mediaId: pic });
    expect(res.statusCode, res.body).toBe(200);
    const { suggestions } = res.json();
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    // Each one makes a valid theme that Realm accepts as it is or fixes.
    const check = await call(noor.cookie, "POST", "/themes/check", {
      file: theme({ colors: suggestions[0].colors, panels: suggestions[0].panels }),
    });
    expect(check.json().ok).toBe(true);
    expect((await call(kenji.cookie, "POST", "/themes/palette", { mediaId: pic })).statusCode).toBe(404);
  });
});
