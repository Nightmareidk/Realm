import { afterEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "./logger";
import { ResendMailer } from "./mailer";

const mail = { to: "Someone@Example.com", subject: "Your Realm code", text: "Code 123456" };

function fakeLogger() {
  const info = vi.fn();
  return { logger: { info } as unknown as Logger, info };
}

function answers(...statuses: number[]) {
  const fetchMock = vi.fn();
  for (const status of statuses) {
    fetchMock.mockResolvedValueOnce(
      new Response(status === 200 ? JSON.stringify({ id: "re_123" }) : "{}", { status }),
    );
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ResendMailer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("logs Resend's id and the domain only, never the address or the text", async () => {
    answers(200);
    const { logger, info } = fakeLogger();
    await new ResendMailer("Realm <no-reply@tomyrealm.com>", "key", logger, []).send(mail);
    const [fields, message] = info.mock.calls[0] ?? [];
    expect(message).toBe("mail sent");
    expect(fields).toMatchObject({ resendId: "re_123", tries: 1, toDomain: "example.com" });
    expect(JSON.stringify(fields)).not.toMatch(/someone|123456/i);
  });

  it("tries again when Resend is busy, then succeeds", async () => {
    const fetchMock = answers(429, 503, 200);
    const { logger, info } = fakeLogger();
    await new ResendMailer("from", "key", logger, [0, 0]).send(mail);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(info.mock.calls[0]?.[0]).toMatchObject({ tries: 3 });
  });

  it("gives up after the last wait", async () => {
    const fetchMock = answers(429, 429, 429);
    await expect(new ResendMailer("from", "key", undefined, [0, 0]).send(mail)).rejects.toThrow(
      "429",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("doesn't retry an email Resend rejects", async () => {
    const fetchMock = answers(422);
    await expect(new ResendMailer("from", "key", undefined, [0, 0]).send(mail)).rejects.toThrow(
      "422",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
