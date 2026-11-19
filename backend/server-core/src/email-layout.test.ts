import { describe, expect, it } from "vitest";
import {
  type EmailLayout,
  emailBodyText,
  emailHref,
  formatWhen,
  layoutFromText,
  renderEmailHtml,
  renderEmailText,
} from "./email-layout";
import { BrandedMailer, brandedMail, type Mail, MemoryMailer } from "./mailer";

const brand = { origin: "https://tomyrealm.com", contact: "info@tomyrealm.com" };

const layout: EmailLayout = {
  preheader: "Your code is 123456.",
  heading: "Confirm your email",
  intro: ["Enter this code."],
  code: "123456",
  button: { label: "Confirm my email", href: "https://tomyrealm.com/verify?token=abc" },
  reason: "You made an account.",
};

describe("email layout", () => {
  it("shows the code, the button, the logo and the footer", () => {
    const html = renderEmailHtml(layout, "noa@example.com", brand);
    expect(html).toContain(">123456</span>");
    expect(html).toContain('href="https://tomyrealm.com/verify?token=abc"');
    expect(html).toContain("https://tomyrealm.com/email/realm-icon.png");
    expect(html).toContain("mailto:info@tomyrealm.com");
    expect(html).toContain("noa@example.com");
    expect(html).toContain("Your code is 123456.");
  });

  it("escapes everything a person or a device name could slip in", () => {
    const html = renderEmailHtml(
      {
        ...layout,
        details: [{ label: "Device", value: '<script>alert(1)</script>"><img src=x>' }],
      },
      'x"<b>@example.com',
      brand,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).not.toContain('x"<b>');
    expect(html).toContain("&lt;script&gt;");
  });

  it("joins paths to the website and refuses links that aren't web pages", () => {
    expect(emailHref("/settings/devices", brand.origin)).toBe(
      "https://tomyrealm.com/settings/devices",
    );
    expect(emailHref("javascript:alert(1)", brand.origin)).toBeNull();
    expect(emailHref("data:text/html,hi", brand.origin)).toBeNull();
    const html = renderEmailHtml(
      { ...layout, button: { label: "Go", href: "javascript:alert(1)" } },
      "a@b.co",
      brand,
    );
    expect(html).not.toContain("javascript:");
  });

  it("puts the code on a line of its own in the plain text, with the footer", () => {
    const text = renderEmailText(layout, "noa@example.com", brand);
    expect(text).toMatch(/^123456$/m);
    expect(text).toContain("Questions? Write to info@tomyrealm.com.");
    expect(text).toContain("Confirm my email: https://tomyrealm.com/verify?token=abc");
  });

  it("puts a last button after the closing lines", () => {
    const text = emailBodyText(
      {
        ...layout,
        code: undefined,
        outro: ["If it wasn't you…"],
        button: { label: "Check", href: "/x", last: true },
      },
      brand.origin,
    );
    expect(text.indexOf("If it wasn't you")).toBeLessThan(
      text.indexOf("Check: https://tomyrealm.com/x"),
    );
  });

  it("writes dates the way people say them", () => {
    expect(formatWhen(new Date("2026-11-19T14:05:00Z"))).toBe("19 November 2026 at 14:05 UTC");
  });

  it("lays out a plain-text email one paragraph per gap", () => {
    const l = layoutFromText("Realm: storage is full", "First line.\n\nSecond line.");
    expect(l.heading).toBe("storage is full");
    expect(l.intro).toEqual(["First line.", "Second line."]);
  });
});

describe("BrandedMailer", () => {
  it("sends the designed HTML and the plain text with its footer", async () => {
    const inner = new MemoryMailer();
    const mailer = new BrandedMailer(inner, brand);
    await mailer.send(brandedMail("noa@example.com", "Hi", layout));
    const sent = inner.last() as Mail;
    expect(sent.html).toContain("<!doctype html>");
    expect(sent.text).toContain("Sent to noa@example.com.");
    expect(sent.layout).toBeUndefined();
  });

  it("dresses an email that has only text", async () => {
    const inner = new MemoryMailer();
    await new BrandedMailer(inner, brand).send({ to: "o@x.co", subject: "Note", text: "Hello." });
    expect(inner.last()?.html).toContain("Hello.");
  });
});
