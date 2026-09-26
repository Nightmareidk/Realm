import type { Mail } from "@realm/server-core";

// Plain, accessible transactional emails. Branded templates come with the design system.

export function verificationEmail(opts: { to: string; code: string; link: string }): Mail {
  return {
    to: opts.to,
    subject: "Verify your email for Realm",
    text: [
      "Welcome to Realm.",
      "",
      `Your verification code is: ${opts.code}`,
      "",
      `Or open this link: ${opts.link}`,
      "",
      "The code expires in 15 minutes. If you didn't create a Realm account, ignore this email.",
    ].join("\n"),
  };
}

export function passwordResetEmail(opts: { to: string; link: string }): Mail {
  return {
    to: opts.to,
    subject: "Reset your Realm password",
    text: [
      "Someone (hopefully you) asked to reset your Realm password.",
      "",
      `Reset it here: ${opts.link}`,
      "",
      "This link expires in 60 minutes and can be used once. Resetting signs you out everywhere.",
      "If you didn't ask for this, you can ignore this email — your password hasn't changed.",
    ].join("\n"),
  };
}

export function passwordChangedEmail(opts: { to: string }): Mail {
  return {
    to: opts.to,
    subject: "Your Realm password was changed",
    text: [
      "Your Realm password was just changed.",
      "",
      "If this wasn't you, reset your password immediately and review your signed-in devices in Settings → Security.",
    ].join("\n"),
  };
}
