import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
} from "../../test/helpers";
import { answer, normalise, STARTERS } from "./answers";

describe("Ask Realm's answers", () => {
  const about = (q: string) => answer(q).answer;

  it("answers the questions it suggests with the right topic", () => {
    expect(about("How do I change my theme?")).toContain("Themes");
    expect(about("How do I make my own theme?")).toContain("studio");
    expect(about("How do I make my account private?")).toContain("Private account");
    expect(about("How do I turn on notifications?")).toContain("Notifications");
    expect(about("How do I find Spaces?")).toContain("Spaces are group hangouts");
    expect(about("How do voice rooms work?")).toContain("website for now");
    expect(about("Are my messages encrypted?")).toContain("switched off for now");
    expect(about("What are Close Friends?")).toContain("Close Friends is a list");
    expect(about("How do I post?")).toContain("Create");
    expect(about("What is a time capsule?")).toContain("sealed");
    expect(about("How do I share a place?")).toContain("never your live location");
    expect(about("How do I download my information?")).toContain("one file");
    expect(about("How do I turn on two-step sign-in?")).toContain("authenticator");
  });

  it("every suggestion it offers has an answer of its own", () => {
    const fallback = answer("zzzz").answer;
    const offered = new Set(STARTERS);
    for (const q of [...STARTERS]) for (const s of answer(q).suggestions) offered.add(s);
    for (const s of offered) expect(answer(s).answer, s).not.toBe(fallback);
  });

  it("understands Turkish letters and messy typing", () => {
    expect(normalise("Şifremi UNUTTUM!!")).toBe("sifremi unuttum");
    expect(about("forgot my PASSWORD??")).toContain("Forgot password");
    expect(about("how 2 delete account")).toContain("30 days");
  });

  it("never claims messages are end-to-end encrypted", () => {
    expect(about("is chat end to end encrypted")).not.toMatch(/are end-to-end encrypted\b/);
  });

  it("says when it doesn't know, with things to try", () => {
    const a = answer("what's the weather in Ankara");
    expect(a.answer).toContain("not sure");
    expect(a.suggestions.length).toBeGreaterThan(0);
    expect(a.link).toBeNull();
  });
});

describe("Ask Realm's route", () => {
  let t: TestContext;
  let cookie: string;
  beforeAll(async () => {
    t = await createTestApp();
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: browser(),
      payload: newAccount(),
      remoteAddress: "10.63.0.1",
    });
    cookie = sessionCookie(res) ?? "";
  });
  afterAll(async () => {
    await t.close();
  });
  const ask = (c: string | undefined, question: unknown) =>
    t.app.inject({
      method: "POST",
      url: "/v1/help/ask",
      headers: browser(c),
      payload: { question },
    });

  it("answers signed-in people, with a link to the right place", async () => {
    const res = await ask(cookie, "how do i block someone");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      link: { web: "/settings/privacy", app: "/blocked" },
    });
    expect((await ask(undefined, "hi")).statusCode).toBe(401);
    expect((await ask(cookie, "")).statusCode).toBe(400);
    expect((await ask(cookie, "x".repeat(301))).statusCode).toBe(400);
  });

  it("offers starter questions", async () => {
    const res = await t.app.inject({
      method: "GET",
      url: "/v1/help/starters",
      headers: browser(cookie),
    });
    expect(res.json().suggestions).toEqual(STARTERS);
  });
});
