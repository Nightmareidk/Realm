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
describe("friends", () => {
  it("asks, accepts both ways, respects 'nobody', and unfriends", async () => {
    const noor = await person();
    const kenji = await person();
    const shy = await person();
    expect(
      (await call(noor.cookie, "PUT", `/users/@me/relationships/${kenji.username}`)).json().type,
    ).toBe("pending_outgoing");
    const theirs = (await call(kenji.cookie, "GET", "/users/@me/relationships")).json().items;
    expect(theirs).toEqual([
      expect.objectContaining({
        type: "pending_incoming",
        user: expect.objectContaining({ id: noor.id }),
      }),
    ]);
    expect(
      (await call(kenji.cookie, "PUT", `/users/@me/relationships/${noor.username}`)).json().type,
    ).toBe("friend");
    expect((await call(noor.cookie, "GET", "/users/@me/relationships")).json().items[0].type).toBe(
      "friend",
    );
    // Friends message straight to the inbox.
    const dm = (
      await call(noor.cookie, "POST", "/users/@me/channels", { recipientIds: [kenji.id] })
    ).json();
    expect(dm.awaiting).toBe(false);

    await call(shy.cookie, "PATCH", "/users/@me/settings", { friendRequestPolicy: "nobody" });
    expect(
      (await call(noor.cookie, "PUT", `/users/@me/relationships/${shy.username}`)).statusCode,
    ).toBe(403);

    expect(
      (await call(noor.cookie, "DELETE", `/users/@me/relationships/${kenji.username}`)).statusCode,
    ).toBe(204);
    expect((await call(kenji.cookie, "GET", "/users/@me/relationships")).json().items).toEqual([]);
  });
});
