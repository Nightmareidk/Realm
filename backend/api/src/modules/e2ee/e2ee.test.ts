import { generateKeyPairSync, type KeyObject, sign } from "node:crypto";
import { deviceCertificateBytes, deviceRevocationBytes, fromBase64Url } from "@realm/e2ee";
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
const nextIp = () => `10.80.${Math.floor(++ip / 250)}.${ip % 250}`;

function keyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return { pub: Buffer.from(raw).toString("base64url"), priv: privateKey };
}
const signB64 = (priv: KeyObject, msg: Uint8Array) =>
  Buffer.from(sign(null, msg, priv)).toString("base64url");

type Method = "GET" | "POST";
const call = (cookie: string, method: Method, url: string, payload?: unknown) =>
  t.app.inject({ method, url: `/v1${url}`, headers: browser(cookie), payload: payload as object });

async function person() {
  const account = newAccount();
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: account,
    remoteAddress: nextIp(),
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session");
  return { cookie, id: res.json().user.id as string, account };
}

/** Another sign-in for the same person: a second device. */
async function signInAgain(p: Awaited<ReturnType<typeof person>>) {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    headers: browser(),
    payload: { login: p.account.username, password: p.account.password },
    remoteAddress: nextIp(),
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no second session");
  return cookie;
}

function certFor(userId: string, deviceId: string, devicePub: string, issuedAt = Date.now()) {
  return deviceCertificateBytes({
    userId,
    deviceId,
    signatureKey: fromBase64Url(devicePub),
    issuedAt,
  });
}

/** A person with one confirmed device, the way the first app install sets itself up. */
async function setUp() {
  const p = await person();
  const account = keyPair();
  const device = keyPair();
  const reg = await call(p.cookie, "POST", "/e2ee/devices", { signatureKey: device.pub });
  expect(reg.statusCode).toBe(201);
  const deviceId = reg.json().id as string;
  expect(reg.json().status).toBe("pending");
  expect(
    (await call(p.cookie, "POST", "/e2ee/account-key", { publicKey: account.pub })).statusCode,
  ).toBe(204);
  const issuedAt = Date.now();
  const ok = await call(p.cookie, "POST", `/e2ee/devices/${deviceId}/approve`, {
    issuedAt,
    signature: signB64(account.priv, certFor(p.id, deviceId, device.pub, issuedAt)),
  });
  expect(ok.statusCode).toBe(204);
  return { ...p, accountKey: account, device, deviceId };
}

const fakeKeyPackage = (n: number) => Buffer.alloc(120, n).toString("base64url");

describe("devices", () => {
  it("lets a first device set the account key and confirm itself, and publishes its certificate", async () => {
    const p = await setUp();
    expect(t.mailer.last(p.account.email)?.subject).toMatch(/new device/i);

    const mine = await call(p.cookie, "GET", "/e2ee/devices");
    expect(mine.json().accountKeyVersion).toBe(1);
    expect(mine.json().devices[0]).toMatchObject({
      id: p.deviceId,
      status: "approved",
      current: true,
    });

    const other = await person();
    const pub = await call(other.cookie, "GET", `/e2ee/users/${p.id}`);
    expect(pub.statusCode).toBe(200);
    const body = pub.json();
    expect(body.accountKey.publicKey).toBe(p.accountKey.pub);
    expect(body.devices).toHaveLength(1);
    // What anyone can fetch carries no device name or platform.
    expect(Object.keys(body.devices[0]).sort()).toEqual(
      ["accountKeyVersion", "id", "issuedAt", "signature", "signatureKey"].sort(),
    );
  });

  it("refuses signatures from the wrong key, stale times, and a second registration", async () => {
    const p = await person();
    const account = keyPair();
    const device = keyPair();
    const id = (await call(p.cookie, "POST", "/e2ee/devices", { signatureKey: device.pub })).json()
      .id;
    await call(p.cookie, "POST", "/e2ee/account-key", { publicKey: account.pub });

    const stranger = keyPair();
    const forged = await call(p.cookie, "POST", `/e2ee/devices/${id}/approve`, {
      issuedAt: Date.now(),
      signature: signB64(stranger.priv, certFor(p.id, id, device.pub)),
    });
    expect(forged.statusCode).toBe(400);
    expect(forged.json().error.code).toBe("SIGNATURE_INVALID");

    // Signed for a different device key than the one registered: the server rebuilds the text.
    const swapped = await call(p.cookie, "POST", `/e2ee/devices/${id}/approve`, {
      issuedAt: Date.now(),
      signature: signB64(account.priv, certFor(p.id, id, keyPair().pub)),
    });
    expect(swapped.json().error.code).toBe("SIGNATURE_INVALID");

    const old = Date.now() - 60 * 60 * 1000;
    const stale = await call(p.cookie, "POST", `/e2ee/devices/${id}/approve`, {
      issuedAt: old,
      signature: signB64(account.priv, certFor(p.id, id, device.pub, old)),
    });
    expect(stale.statusCode).toBe(400);

    const again = await call(p.cookie, "POST", "/e2ee/devices", { signatureKey: keyPair().pub });
    expect(again.statusCode).toBe(409);
    const secondKey = await call(p.cookie, "POST", "/e2ee/account-key", {
      publicKey: keyPair().pub,
    });
    expect(secondKey.statusCode).toBe(409);
  });

  it("makes a second device wait until a confirmed device approves it", async () => {
    const p = await setUp();
    const second = await signInAgain(p);
    const device2 = keyPair();
    const id2 = (await call(second, "POST", "/e2ee/devices", { signatureKey: device2.pub })).json()
      .id;

    // It can't confirm itself, even with a valid signature, once a device is already confirmed.
    const self = await call(second, "POST", `/e2ee/devices/${id2}/approve`, {
      issuedAt: Date.now(),
      signature: signB64(p.accountKey.priv, certFor(p.id, id2, device2.pub)),
    });
    expect(self.statusCode).toBe(403);
    expect(self.json().error.code).toBe("DEVICE_NOT_APPROVED");
    expect(
      (await call(second, "POST", "/e2ee/key-packages", { keyPackages: [fakeKeyPackage(1)] }))
        .statusCode,
    ).toBe(403);

    const approved = await call(p.cookie, "POST", `/e2ee/devices/${id2}/approve`, {
      issuedAt: Date.now(),
      signature: signB64(p.accountKey.priv, certFor(p.id, id2, device2.pub)),
    });
    expect(approved.statusCode).toBe(204);
    const pub = await call(p.cookie, "GET", `/e2ee/users/${p.id}`);
    expect(pub.json().devices).toHaveLength(2);
  });

  it("revokes a device with a signed revocation: it's signed out and drops out of the list", async () => {
    const p = await setUp();
    const second = await signInAgain(p);
    const device2 = keyPair();
    const id2 = (await call(second, "POST", "/e2ee/devices", { signatureKey: device2.pub })).json()
      .id;
    await call(p.cookie, "POST", `/e2ee/devices/${id2}/approve`, {
      issuedAt: Date.now(),
      signature: signB64(p.accountKey.priv, certFor(p.id, id2, device2.pub)),
    });
    await call(second, "POST", "/e2ee/key-packages", { keyPackages: [fakeKeyPackage(2)] });

    const revokedAt = Date.now();
    const sig = signB64(
      p.accountKey.priv,
      deviceRevocationBytes({ userId: p.id, deviceId: id2, revokedAt }),
    );
    const wrong = await call(p.cookie, "POST", `/e2ee/devices/${id2}/revoke`, {
      revokedAt: revokedAt + 1,
      signature: sig,
    });
    expect(wrong.json().error.code).toBe("SIGNATURE_INVALID");
    expect(
      (await call(p.cookie, "POST", `/e2ee/devices/${id2}/revoke`, { revokedAt, signature: sig }))
        .statusCode,
    ).toBe(204);

    expect((await call(second, "GET", "/e2ee/devices")).statusCode).toBe(401);
    const pub = await call(p.cookie, "GET", `/e2ee/users/${p.id}`);
    expect(pub.json().devices.map((d: { id: string }) => d.id)).toEqual([p.deviceId]);
  });

  it("revokes with the password when no confirmed device is at hand, and checks the password", async () => {
    const p = await setUp();
    const bad = await call(p.cookie, "POST", `/e2ee/devices/${p.deviceId}/revoke`, {
      password: "not the password",
    });
    expect(bad.statusCode).toBe(401);
    const ok = await call(p.cookie, "POST", `/e2ee/devices/${p.deviceId}/revoke`, {
      password: p.account.password,
    });
    expect(ok.statusCode).toBe(204);
  });

  it("resets the account key: old devices are out, contacts see a new key, and setup starts over", async () => {
    const p = await setUp();
    const fresh = keyPair();
    const reset = await call(p.cookie, "POST", "/e2ee/account-key/reset", {
      password: p.account.password,
      publicKey: fresh.pub,
    });
    expect(reset.statusCode).toBe(204);
    expect(t.mailer.last(p.account.email)?.subject).toMatch(/security code changed/i);

    const pub = await call(p.cookie, "GET", `/e2ee/users/${p.id}`);
    expect(pub.json().accountKey).toEqual({ version: 2, publicKey: fresh.pub });
    expect(pub.json().devices).toEqual([]);

    // The same sign-in sets itself up again under the new key.
    const device = keyPair();
    const id = (await call(p.cookie, "POST", "/e2ee/devices", { signatureKey: device.pub })).json()
      .id;
    const ok = await call(p.cookie, "POST", `/e2ee/devices/${id}/approve`, {
      issuedAt: Date.now(),
      signature: signB64(fresh.priv, certFor(p.id, id, device.pub)),
    });
    expect(ok.statusCode).toBe(204);
  });
});

describe("key packages", () => {
  it("hands out each package once, one per confirmed device, and says when one has run out", async () => {
    const bob = await setUp();
    await call(bob.cookie, "POST", "/e2ee/key-packages", {
      keyPackages: [fakeKeyPackage(1), fakeKeyPackage(2)],
    });
    expect((await call(bob.cookie, "GET", "/e2ee/key-packages/count")).json()).toEqual({
      unclaimed: 2,
    });

    const alice = await setUp();
    const first = (
      await call(alice.cookie, "POST", "/e2ee/key-packages/claim", { userIds: [bob.id] })
    ).json();
    const second = (
      await call(alice.cookie, "POST", "/e2ee/key-packages/claim", { userIds: [bob.id] })
    ).json();
    const third = (
      await call(alice.cookie, "POST", "/e2ee/key-packages/claim", { userIds: [bob.id] })
    ).json();
    expect(first.packages).toHaveLength(1);
    expect(second.packages).toHaveLength(1);
    expect(first.packages[0].keyPackage).not.toBe(second.packages[0].keyPackage);
    expect(third).toEqual({ packages: [], missing: [{ userId: bob.id, deviceId: bob.deviceId }] });
    expect((await call(bob.cookie, "GET", "/e2ee/key-packages/count")).json()).toEqual({
      unclaimed: 0,
    });
  });

  it("caps what a device can park on the server, and hides people who don't exist", async () => {
    const p = await setUp();
    const hundred = Array.from({ length: 100 }, (_, i) => fakeKeyPackage(i));
    expect(
      (await call(p.cookie, "POST", "/e2ee/key-packages", { keyPackages: hundred })).statusCode,
    ).toBe(204);
    expect(
      (await call(p.cookie, "POST", "/e2ee/key-packages", { keyPackages: hundred })).statusCode,
    ).toBe(204);
    const over = await call(p.cookie, "POST", "/e2ee/key-packages", {
      keyPackages: [fakeKeyPackage(1)],
    });
    expect(over.statusCode).toBe(409);
    expect(
      (await call(p.cookie, "POST", "/e2ee/key-packages", { keyPackages: ["too-short"] }))
        .statusCode,
    ).toBe(400);

    const nobody = await call(p.cookie, "POST", "/e2ee/key-packages/claim", {
      userIds: ["123456789"],
    });
    expect(nobody.statusCode).toBe(404);
  });

  it("needs a signed-in user", async () => {
    const res = await t.app.inject({ method: "GET", url: "/v1/e2ee/devices", headers: browser() });
    expect(res.statusCode).toBe(401);
  });
});
