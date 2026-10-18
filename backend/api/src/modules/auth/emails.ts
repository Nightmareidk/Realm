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

/** A sign-in from a device this account hasn't used before. */
export function newSignInEmail(opts: { to: string; device: string; when: Date }): Mail {
  return {
    to: opts.to,
    subject: "New sign-in to your Realm account",
    text: [
      `Your Realm account was just signed in to on a new device: ${opts.device}, at ${opts.when.toUTCString()}.`,
      "",
      "If this was you, there's nothing to do.",
      "",
      "If it wasn't you, change your password now (Settings, Security and login, Password). Changing it signs out every other device straight away. Then check \"Where you're signed in\" for anything you don't recognise.",
    ].join("\n"),
  };
}

/** Someone kept guessing this account's password, and sign-in attempts are paused for a while. */
export function signInPausedEmail(opts: { to: string; minutes: number }): Mail {
  return {
    to: opts.to,
    subject: "Someone kept trying to sign in to your Realm account",
    text: [
      `Someone tried to sign in to your Realm account and got the password wrong many times, so Realm has paused sign-in attempts to your account for ${opts.minutes} minutes.`,
      "",
      "Your account is safe: wrong passwords don't get in.",
      "",
      "If it was you, wait a little and try again, or reset your password from the sign-in screen.",
      "If it wasn't you, nothing to do. For extra safety, use a long password you don't use anywhere else.",
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
      "If this wasn't you, reset your password immediately and review where you're signed in under Settings, Devices.",
    ].join("\n"),
  };
}
