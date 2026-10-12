import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJwt, signHS256 } from "./jwt";
import { liveKitToken } from "./livekit";
import { contentDisposition, LocalStore, S3Store } from "./object-store";
import { MemoryQueue } from "./queue";

describe("S3 request signing (SigV4)", () => {
  it("matches AWS's published presigned-URL example", () => {
    // docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    const store = new S3Store({
      endpoint: "https://examplebucket.s3.amazonaws.com",
      region: "us-east-1",
      bucket: "examplebucket",
      bucketInPath: false,
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });
    const url = store.presign(
      "GET",
      "test.txt",
      { expiresSeconds: 86400 },
      new Date("2013-05-24T00:00:00Z"),
    );
    expect(url).toContain(
      "X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
    );
    expect(url.startsWith("https://examplebucket.s3.amazonaws.com/test.txt?")).toBe(true);
  });

  it("signs uploads with their type and exact size, path-style for R2", async () => {
    const store = new S3Store({
      endpoint: "https://acct.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "realm-media",
      accessKeyId: "id",
      secretAccessKey: "secret",
    });
    const put = await store.presignPut("u/1/abc.png", {
      contentType: "image/png",
      sizeBytes: 1234,
      expiresSeconds: 300,
    });
    expect(
      put.url.startsWith("https://acct.r2.cloudflarestorage.com/realm-media/u/1/abc.png?"),
    ).toBe(true);
    expect(decodeURIComponent(put.url)).toContain(
      "X-Amz-SignedHeaders=content-length;content-type;host",
    );
    expect(put.headers["Content-Type"]).toBe("image/png");
  });

  it("writes download names safely", () => {
    expect(contentDisposition('notes "final".pdf')).toBe(
      `attachment; filename="notes _final_.pdf"; filename*=UTF-8''notes%20%22final%22.pdf`,
    );
  });
});

describe("local store (development)", () => {
  it("signs and checks links, and never leaves its folder", async () => {
    const dir = await mkdtemp(join(tmpdir(), "realm-media-"));
    try {
      const store = new LocalStore(dir, "s".repeat(40));
      const put = await store.presignPut("u/1/a.txt", {
        contentType: "text/plain",
        sizeBytes: 5,
        expiresSeconds: 60,
      });
      const url = new URL(put.url, "http://x");
      const e = Number(url.searchParams.get("e"));
      const s = url.searchParams.get("s") ?? "";
      expect(store.verify("PUT", "u/1/a.txt", e, s, "text/plain\n5")).toBe(true);
      expect(store.verify("PUT", "u/1/a.txt", e, s, "text/plain\n6")).toBe(false);
      expect(store.verify("PUT", "u/1/b.txt", e, s, "text/plain\n5")).toBe(false);
      expect(() => store.path("../escape.txt")).toThrow();

      await store.ensureDir("u/1/a.txt");
      await writeFile(store.path("u/1/a.txt"), "hello");
      expect(await store.head("u/1/a.txt")).toEqual({ sizeBytes: 5, contentType: null });
      expect(Buffer.from(await store.read("u/1/a.txt", 0, 1)).toString()).toBe("he");
      await store.delete("u/1/a.txt");
      expect(await store.head("u/1/a.txt")).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("tokens", () => {
  it("signs HS256 JWTs", () => {
    // jwt.io's well-known example.
    const token = signHS256(
      { sub: "1234567890", name: "John Doe", iat: 1516239022 },
      "your-256-bit-secret",
    );
    expect(token).toBe(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    );
  });

  it("gives LiveKit only what the person may publish", () => {
    const token = liveKitToken(
      { url: "wss://x.livekit.cloud", apiKey: "APIkey", apiSecret: "secret" },
      { identity: "42", name: "Noor", room: "room-1", canPublish: true, sources: ["microphone"] },
    );
    const claims = decodeJwt(token);
    expect(claims.iss).toBe("APIkey");
    expect(claims.sub).toBe("42");
    expect(claims.video).toMatchObject({
      room: "room-1",
      roomJoin: true,
      canPublish: true,
      canPublishSources: ["microphone"],
    });
    const listener = decodeJwt(
      liveKitToken(
        { url: "wss://x", apiKey: "k", apiSecret: "s" },
        { identity: "7", name: "Kenji", room: "r", canPublish: false, sources: [] },
      ),
    );
    expect((listener.video as { canPublish: boolean }).canPublish).toBe(false);
  });
});

describe("in-memory job queue", () => {
  it("runs jobs after the request, and survives a failing one", async () => {
    const q = new MemoryQueue();
    const seen: string[] = [];
    q.process({
      ok: async (d) => {
        seen.push(String(d.n));
      },
      bad: async () => {
        throw new Error("nope");
      },
    });
    await q.enqueue("ok", { n: 1 });
    await q.enqueue("bad", {});
    await q.enqueue("ok", { n: 2 });
    expect(seen).toEqual([]);
    await q.drain();
    expect(seen).toEqual(["1", "2"]);
  });
});
