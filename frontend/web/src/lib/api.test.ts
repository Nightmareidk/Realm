import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, safeNext } from "./api";

function respond(status: number, body?: unknown, headers: Record<string, string> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      body === undefined
        ? new Response(null, { status, headers })
        : new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json", ...headers },
          }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/settings/devices")).toBe("/settings/devices");
    expect(safeNext(["/spaces", "/feed"])).toBe("/spaces");
  });

  it("never sends anyone to another site", () => {
    const backslash = `/${String.fromCharCode(92)}evil.example`; // "/\evil.example"
    for (const next of ["//evil.example", backslash, "https://evil.example", "evil", ""]) {
      expect(safeNext(next)).toBe("/home");
    }
    expect(safeNext(undefined)).toBe("/home");
    expect(safeNext(null, "/login")).toBe("/login");
  });
});

describe("api", () => {
  it("sends JSON same-origin and returns the body", async () => {
    respond(200, { ok: true });
    await expect(api("/users/@me")).resolves.toEqual({ ok: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/users/@me");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("same-origin");
  });

  it("posts a body as JSON, and a bodiless POST without a content type", async () => {
    respond(204);
    await expect(api("/auth/login", { body: { login: "a" } })).resolves.toBeUndefined();
    let init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    respond(204);
    await api("/auth/logout", { method: "POST" });
    init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("turns validation failures into messages per field", async () => {
    respond(400, {
      error: {
        code: "VALIDATION_FAILED",
        message: "Some fields need attention",
        details: { issues: [{ path: ["email"], message: "Enter a valid email address" }] },
      },
    });
    const err = await api("/auth/register", { body: {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).fields).toEqual({ email: "Enter a valid email address" });
  });

  it("says how long to wait when rate-limited", async () => {
    respond(429, { error: { code: "RATE_LIMITED", message: "Too many requests", retryAfter: 90 } });
    const err = (await api("/auth/login", { body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(err.message).toBe("Too many tries. Wait 2 minutes and try again.");
    expect(err.retryAfter).toBe(90);
  });

  it("knows a lost session from a wrong password", async () => {
    respond(401, { error: { code: "UNAUTHORIZED", message: "Sign in to continue" } });
    const gone = (await api("/users/@me").catch((e: unknown) => e)) as ApiError;
    expect(gone.signedOut).toBe(true);

    respond(401, { error: { code: "INVALID_CREDENTIALS", message: "Wrong password" } });
    const wrong = (await api("/auth/login", { body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(wrong.signedOut).toBe(false);
  });

  it("explains being offline, and a server that isn't answering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    const offline = (await api("/users/@me").catch((e: unknown) => e)) as ApiError;
    expect(offline.code).toBe("NETWORK");
    expect(offline.message).toMatch(/couldn't reach Realm/);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })),
    );
    const down = (await api("/users/@me").catch((e: unknown) => e)) as ApiError;
    expect(down.message).toMatch(/isn't answering/);
  });
});
