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
const register = (overrides: Partial<Record<string, string>> = {}) =>
  t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: newAccount(overrides),
    remoteAddress: `10.90.${Math.floor(++ip / 250)}.${ip % 250}`,
  });
async function person(overrides: Partial<Record<string, string>> = {}) {
  const res = await register(overrides);
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error(`no session: ${res.body}`);
  return { cookie, id: res.json().user.id as string, username: res.json().user.username as string };
}
type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
const call = (cookie: string | undefined, method: Method, url: string, payload?: unknown) =>
  t.app.inject({
    method,
    url: `/v1${url}`,
    headers: browser(cookie),
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
describe("Sparks and AutoMod", () => {
  it("lights a Space up with Sparks, two each, and AutoMod holds back what the Space blocks", async () => {
    const owner = await person();
    const fan = await person();
    const space = (await call(owner.cookie, "POST", "/communities", { name: "Glow Crew" })).json();
    const invite = (
      await call(owner.cookie, "POST", `/communities/${space.id}/invites`, {})
    ).json();
    await call(fan.cookie, "POST", `/invites/${invite.code}`);

    const first = (await call(fan.cookie, "POST", `/communities/${space.id}/sparks`)).json();
    expect(first).toMatchObject({ count: 1, level: 0, toNext: 2, mine: 1, testing: true });
    await call(fan.cookie, "POST", `/communities/${space.id}/sparks`);
    expect((await call(fan.cookie, "POST", `/communities/${space.id}/sparks`)).statusCode).toBe(
      400,
    );
    const lit = (await call(owner.cookie, "POST", `/communities/${space.id}/sparks`)).json();
    expect(lit).toMatchObject({ count: 3, level: 1 });

    // Only someone who manages the Space sets AutoMod.
    const rules = {
      words: ["spoiler"],
      blockLinks: true,
      blockInvites: true,
      minAccountDays: 0,
      minMemberMinutes: 0,
    };
    expect(
      (await call(fan.cookie, "PUT", `/communities/${space.id}/automod`, rules)).statusCode,
    ).toBe(403);
    expect(
      (await call(owner.cookie, "PUT", `/communities/${space.id}/automod`, rules)).statusCode,
    ).toBe(200);
    const room =
      space.channels?.[0]?.id ??
      (await call(owner.cookie, "GET", `/communities/${space.id}`))
        .json()
        .channels.find((c: { type: string }) => c.type === "text").id;
    const held = await call(fan.cookie, "POST", `/channels/${room}/messages`, {
      content: "huge SPOILER ahead",
    });
    expect(held.json().error.code).toBe("AUTOMOD");
    const link = await call(fan.cookie, "POST", `/channels/${room}/messages`, {
      content: "see https://example.com",
    });
    expect(link.json().error.code).toBe("AUTOMOD");
    expect(
      (await call(fan.cookie, "POST", `/channels/${room}/messages`, { content: "hello all" }))
        .statusCode,
    ).toBe(201);
    // Mods aren't held back.
    expect(
      (
        await call(owner.cookie, "POST", `/channels/${room}/messages`, {
          content: "no spoiler talk",
        })
      ).statusCode,
    ).toBe(201);
    const log = (await call(owner.cookie, "GET", `/communities/${space.id}/audit-log`)).json()
      .entries;
    expect(log.some((e: { action: string }) => e.action === "automod.update")).toBe(true);
  });
});
