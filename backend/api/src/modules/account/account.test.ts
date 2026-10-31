import { eq, schema } from "@realm/db";
import { hotp, unseal } from "@realm/server-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
} from "../../test/helpers";
import { AccountService } from "./service";

let t: TestContext;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

let ip = 0;
async function person() {
  const account = newAccount();
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: account,
    remoteAddress: `10.60.${Math.floor(++ip / 250)}.${ip % 250}`,
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session");
  return {
    cookie,
    id: res.json().user.id as string,
    username: account.username as string,
    password: account.password as string,
  };
}

type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
const call = (cookie: string | undefined, method: Method, url: string, payload?: unknown) =>
  t.app.inject({
    method,
    url: `/v1${url}`,
    headers: browser(cookie),
    ...(payload === undefined ? {} : { payload: payload as object }),
  });

const login = (who: { username: string; password: string }, code?: string) =>
  t.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    headers: browser(),
    payload: { login: who.username, password: who.password, ...(code ? { code } : {}) },
    remoteAddress: `10.61.${Math.floor(++ip / 250)}.${ip % 250}`,
  });

const step = () => Math.floor(Date.now() / 30_000);

/** Turns two-step on and returns the secret and the backup codes. */
async function turnOnTwoStep(who: { cookie: string }) {
  const setup = (await call(who.cookie, "POST", "/users/@me/two-step/setup")).json();
  const res = await call(who.cookie, "POST", "/users/@me/two-step", {
    secret: setup.secret,
    code: hotp(setup.secret, step()),
  });
  expect(res.statusCode).toBe(200);
  return { secret: setup.secret as string, codes: res.json().codes as string[] };
}

describe("two-step sign-in", () => {
  it("asks for the app's code after the right password, and refuses wrong and reused codes", async () => {
    const noor = await person();
    const setup = (await call(noor.cookie, "POST", "/users/@me/two-step/setup")).json();
    expect(setup.uri).toMatch(/^otpauth:\/\/totp\/Realm/);
    // A wrong first code doesn't turn it on.
    const bad = await call(noor.cookie, "POST", "/users/@me/two-step", {
      secret: setup.secret,
      code: "000000" === hotp(setup.secret, step()) ? "111111" : "000000",
    });
    expect(bad.json().error.code).toBe("INVALID_CODE");
    expect((await call(noor.cookie, "GET", "/users/@me")).json().twoStep).toBe(false);

    const secret = setup.secret as string;
    const on = await call(noor.cookie, "POST", "/users/@me/two-step", {
      secret,
      code: hotp(secret, step()),
    });
    const codes = on.json().codes as string[];
    expect(codes).toHaveLength(10);
    expect((await call(noor.cookie, "GET", "/users/@me")).json().twoStep).toBe(true);
    // The secret is never kept in plain text.
    const [row] = await t.deps.db
      .select({ s: schema.users.mfaSecret })
      .from(schema.users)
      .where(eq(schema.users.id, BigInt(noor.id)));
    expect(row?.s).not.toContain(secret);
    expect(unseal(t.deps.config.REALM_SECRET, row?.s ?? "")).toBe(secret);

    // Right password, no code: asked for one, and no session is given.
    const noCode = await login(noor);
    expect(noCode.statusCode).toBe(401);
    expect(noCode.json().error.code).toBe("MFA_REQUIRED");
    expect(sessionCookie(noCode)).toBeUndefined();
    expect((await login(noor, "123 456")).json().error.code).toMatch(/INVALID_CODE|MFA_REQUIRED/);

    // The next step's code (the one used to turn it on was this step's) signs in once.
    const fresh = hotp(secret, step() + 1);
    expect((await login(noor, fresh)).statusCode).toBe(200);
    expect((await login(noor, fresh)).json().error.code).toBe("INVALID_CODE");
  });

  it("lets a backup code in once, and needs password and code to turn it off", async () => {
    const kenji = await person();
    const { secret, codes } = await turnOnTwoStep(kenji);
    const backup = codes[0] ?? "";
    expect((await login(kenji, backup.toUpperCase())).statusCode).toBe(200);
    expect((await login(kenji, backup)).json().error.code).toBe("INVALID_CODE");
    expect((await call(kenji.cookie, "GET", "/users/@me/two-step")).json().backupCodesLeft).toBe(9);

    const noCode = await call(kenji.cookie, "POST", "/users/@me/two-step/disable", {
      password: kenji.password,
    });
    expect(noCode.json().error.code).toBe("MFA_REQUIRED");
    const wrongPassword = await call(kenji.cookie, "POST", "/users/@me/two-step/disable", {
      password: "not the password",
      code: codes[1],
    });
    expect(wrongPassword.json().error.code).toBe("INVALID_CREDENTIALS");
    const off = await call(kenji.cookie, "POST", "/users/@me/two-step/disable", {
      password: kenji.password,
      code: codes[1],
    });
    expect(off.statusCode).toBe(204);
    expect((await login(kenji)).statusCode).toBe(200);
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("stops password guessing on the confirm step", async () => {
    const ada = await person();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await call(ada.cookie, "POST", "/users/@me/deactivate", { password: `wrong-${i}` }))
        .statusCode;
    }
    expect(last).toBe(429);
  });

  it("is only for the signed-in person", async () => {
    expect((await call(undefined, "POST", "/users/@me/two-step/setup")).statusCode).toBe(401);
    expect((await call(undefined, "POST", "/users/@me/delete", { password: "x" })).statusCode).toBe(
      401,
    );
    expect((await call(undefined, "GET", "/users/@me/data")).statusCode).toBe(401);
  });
});

describe("taking a break and deleting the account", () => {
  it("hides a deactivated account and brings it back on sign-in", async () => {
    const mei = await person();
    const viewer = await person();
    expect(
      (await call(mei.cookie, "POST", "/users/@me/deactivate", { password: "nope" })).json().error
        .code,
    ).toBe("INVALID_CREDENTIALS");
    expect(
      (await call(mei.cookie, "POST", "/users/@me/deactivate", { password: mei.password }))
        .statusCode,
    ).toBe(204);
    // Signed out everywhere, and nobody can see the profile.
    expect((await call(mei.cookie, "GET", "/users/@me")).statusCode).toBe(401);
    expect((await call(viewer.cookie, "GET", `/users/${mei.username}/profile`)).statusCode).toBe(
      404,
    );
    const back = await login(mei);
    expect(back.statusCode).toBe(200);
    expect(back.json().welcomeBack).toBe("deactivated");
    expect((await call(viewer.cookie, "GET", `/users/${mei.username}/profile`)).statusCode).toBe(
      200,
    );
  });

  it("deletes after 30 days unless they sign in, and won't leave a Space without an owner", async () => {
    const aras = await person();
    const space = (await call(aras.cookie, "POST", "/communities", { name: "Aras Crew" })).json();
    const refused = await call(aras.cookie, "POST", "/users/@me/delete", {
      password: aras.password,
    });
    expect(refused.json().error.code).toBe("OWNER_CANNOT_LEAVE");
    expect(
      (await call(aras.cookie, "DELETE", `/communities/${space.id}`, {})).statusCode,
    ).toBeLessThan(300);

    const post = await call(aras.cookie, "POST", "/posts", { kind: "text", caption: "bye" });
    const scheduled = await call(aras.cookie, "POST", "/users/@me/delete", {
      password: aras.password,
    });
    expect(scheduled.statusCode).toBe(200);
    const days = (Date.parse(scheduled.json().deletesAt) - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(30);

    // Changing their mind: signing in stops it.
    const back = await login(aras);
    expect(back.json().welcomeBack).toBe("deletion_cancelled");
    const cookie = sessionCookie(back) ?? "";
    await call(cookie, "POST", "/users/@me/delete", { password: aras.password });

    const account = new AccountService(t.deps);
    expect(await account.sweepDeletions(new Date())).toBe(0);
    expect(await account.sweepDeletions(new Date(Date.now() + 31 * 86_400_000))).toBe(1);

    const [row] = await t.deps.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, BigInt(aras.id)));
    expect(row?.status).toBe("deleted");
    expect(row?.username).toBe(`deleted_${aras.id}`);
    expect(row?.email).not.toContain("@example");
    expect((await login(aras)).statusCode).toBe(401);
    const gone = await call(undefined, "GET", `/posts/${post.json().id}`);
    expect(gone.statusCode).toBe(404);
  });

  it("hands over a copy of your data without secrets", async () => {
    const lin = await person();
    await call(lin.cookie, "POST", "/posts", { kind: "text", caption: "hello world" });
    const res = await call(lin.cookie, "GET", "/users/@me/data");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="realm-data-/);
    const data = res.json();
    expect(data.account.username).toBe(lin.username);
    expect(data.posts[0].caption).toBe("hello world");
    expect(res.body).not.toMatch(/passwordHash|mfaSecret|argon2/);
  });
});
