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

const OWNER = "owner@example.com";
// A 2×3 PNG: 69 bytes.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0, 0, 0, 13]),
  Buffer.from("IHDR"),
  Buffer.from([0, 0, 0, 2, 0, 0, 0, 3, 8, 6, 0, 0, 0]),
  Buffer.alloc(40),
]);

/** The limit, in bytes (the setting is in GB). */
const limitTo = (bytes: number) => {
  (t.deps.config as { REALM_STORAGE_LIMIT_GB: number }).REALM_STORAGE_LIMIT_GB = bytes / 1e9;
};
const alerts = () => t.mailer.outbox.filter((m) => m.to === OWNER).map((m) => m.subject);

async function photo(cookie: string) {
  const ticket = await t.app.inject({
    method: "POST",
    url: "/v1/media/uploads",
    headers: browser(cookie),
    payload: { kind: "image", mimeType: "image/png", sizeBytes: PNG.length },
  });
  if (ticket.statusCode !== 201) return ticket;
  const { mediaId, uploadUrl } = ticket.json();
  await t.app.inject({
    method: "PUT",
    url: uploadUrl.replace(/^\/api/, ""),
    headers: { "content-type": "image/png" },
    payload: PNG,
  });
  return t.app.inject({
    method: "POST",
    url: `/v1/media/${mediaId}/complete`,
    headers: browser(cookie),
  });
}

describe("the storage limit", () => {
  it("warns the owner at 90%, 93% and 97%, then pauses uploads when full", async () => {
    (t.deps.config as { REALM_ALERT_EMAIL?: string }).REALM_ALERT_EMAIL = OWNER;
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: browser(),
      payload: newAccount(),
    });
    const cookie = sessionCookie(res) as string;

    const warnings = () => alerts().filter((x) => / GB used$/.test(x)).length;
    const fulls = () => alerts().filter((x) => /is full/.test(x)).length;

    // Each photo is 69 bytes; the limit moves so each upload lands where we want it.
    limitTo(75); // 69 of 75: 92%
    expect((await photo(cookie)).statusCode).toBe(200);
    expect(warnings()).toBe(1);
    limitTo(147); // 138 of 147: 94%
    expect((await photo(cookie)).statusCode).toBe(200);
    expect(warnings()).toBe(2);
    limitTo(212); // 207 of 212: 98%
    expect((await photo(cookie)).statusCode).toBe(200);
    expect(warnings()).toBe(3);
    expect(fulls()).toBe(0);

    // Full: the next upload is refused with a plain reason, and the owner is told once.
    const refused = await photo(cookie);
    expect(refused.statusCode).toBe(507);
    expect(refused.json().error.code).toBe("UPLOADS_PAUSED");
    expect((await photo(cookie)).statusCode).toBe(507);
    expect(fulls()).toBe(1);
    expect(warnings()).toBe(3);

    // Room again: uploads work, and the warnings are ready to go out again.
    limitTo(100_000);
    expect((await photo(cookie)).statusCode).toBe(200); // 276 bytes stored
    // One jump from under 90% straight to 98%: a single email, not three.
    limitTo(352); // 345 of 352
    expect((await photo(cookie)).statusCode).toBe(200);
    expect(warnings()).toBe(4);
    expect((await photo(cookie)).statusCode).toBe(507);
    expect(fulls()).toBe(2);
  });

  it("can be turned off", async () => {
    (t.deps.config as { REALM_STORAGE_LIMIT_GB: number }).REALM_STORAGE_LIMIT_GB = 0;
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: browser(),
      payload: newAccount(),
      remoteAddress: "10.5.5.5",
    });
    expect((await photo(sessionCookie(res) as string)).statusCode).toBe(200);
  });
});
