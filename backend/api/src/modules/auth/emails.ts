import { brandedMail, formatWhen, type Mail } from "@realm/server-core";

// Realm's account emails, in Realm's email design (server-core/email-layout.ts). Links that are
// paths ("/login") are joined to the website's address when the email goes out.

export function verificationEmail(opts: { to: string; code: string; link: string }): Mail {
  return brandedMail(opts.to, "Verify your email for Realm", {
    preheader: `Your code is ${opts.code}. It works for 15 minutes.`,
    heading: "Confirm your email",
    intro: ["Welcome to Realm! Enter this code in the app to confirm this is your email."],
    code: opts.code,
    button: { label: "Confirm my email", href: opts.link },
    outro: ["The code and the button work for 15 minutes."],
    reason:
      "You got this because someone made a Realm account with this email. If it wasn't you, you can ignore it.",
  });
}

export function passwordResetEmail(opts: { to: string; link: string }): Mail {
  return brandedMail(opts.to, "Reset your Realm password", {
    preheader: "Tap the button to pick a new password. The link works for 60 minutes.",
    heading: "Reset your password",
    intro: ["We got a request to reset the password for your Realm account."],
    button: { label: "Reset password", href: opts.link },
    outro: [
      "The link works once, for 60 minutes. Resetting your password signs you out on every device.",
      "Didn't ask for this? You can ignore this email. Your password hasn't changed.",
    ],
    reason: "You got this because someone asked to reset the password for this Realm account.",
  });
}

/** A sign-in from a device this account hasn't used before. */
export function newSignInEmail(opts: { to: string; device: string; when: Date }): Mail {
  return brandedMail(opts.to, "New sign-in to your Realm account", {
    preheader: `Your account was signed in to on ${opts.device}.`,
    heading: "New sign-in to your account",
    intro: ["Your Realm account was just signed in to on a device it hasn't used before."],
    details: [
      { label: "Device", value: opts.device },
      { label: "When", value: formatWhen(opts.when) },
    ],
    outro: [
      "If this was you, there's nothing to do.",
      "If it wasn't you, change your password now. That signs out every other device straight away. Then check where you're signed in.",
    ],
    button: { label: "Check where I'm signed in", href: "/settings/devices", last: true },
    reason: "We send this every time your account is used on a new device, to keep it safe.",
  });
}

/** Someone kept guessing this account's password, and sign-in attempts are paused for a while. */
export function signInPausedEmail(opts: { to: string; minutes: number }): Mail {
  return brandedMail(opts.to, "Someone kept trying to sign in to your Realm account", {
    preheader: `Sign-in attempts are paused for ${opts.minutes} minutes. Your account is safe.`,
    heading: "Someone kept trying to sign in",
    intro: [
      `Someone tried to sign in to your Realm account and got the password wrong many times. To keep you safe, Realm has paused sign-in attempts for ${opts.minutes} minutes.`,
      "Your account is safe: a wrong password can't get in.",
    ],
    outro: [
      "Was it you? Wait a little and try again, or reset your password.",
      "Wasn't you? There's nothing to do. For extra safety, use a long password you don't use anywhere else.",
    ],
    button: { label: "Reset my password", href: "/forgot", last: true },
    reason:
      "We send this when someone keeps getting your password wrong, to keep your account safe.",
  });
}

export function passwordChangedEmail(opts: { to: string }): Mail {
  return brandedMail(opts.to, "Your Realm password was changed", {
    preheader: "If this wasn't you, reset your password right away.",
    heading: "Your password was changed",
    intro: ["The password for your Realm account was just changed."],
    outro: [
      "If this was you, there's nothing to do.",
      "If it wasn't you, reset your password right away and check where you're signed in.",
    ],
    button: { label: "Reset my password", href: "/forgot", last: true },
    reason: "We send this every time your password changes, to keep your account safe.",
  });
}

/** The account will be deleted: when, and how to stop it. */
export function deletionScheduledEmail(opts: { to: string; when: Date }): Mail {
  return brandedMail(opts.to, "Your Realm account will be deleted", {
    preheader: "Changed your mind? Sign in before then and everything comes back.",
    heading: "Your account will be deleted",
    intro: ["Your Realm account is hidden now. Nobody can see your profile, posts or messages."],
    details: [{ label: "Deleted for good on", value: formatWhen(opts.when) }],
    outro: [
      "Changed your mind? Just sign in before then and everything comes back as it was.",
      "If you didn't ask for this, sign in now and change your password.",
    ],
    button: { label: "Sign in to keep my account", href: "/login", last: true },
    reason: "You got this because someone asked to delete this Realm account.",
  });
}

/** Two-step sign-in was turned on or off. */
export function twoStepChangedEmail(opts: { to: string; on: boolean }): Mail {
  return brandedMail(
    opts.to,
    opts.on
      ? "Two-step sign-in is on for your Realm account"
      : "Two-step sign-in was turned off on your Realm account",
    {
      preheader: opts.on
        ? "Signing in now also asks for a code from your authenticator app."
        : "Signing in now asks for your password only.",
      heading: opts.on ? "Two-step sign-in is on" : "Two-step sign-in is off",
      intro: [
        opts.on
          ? "From now on, signing in to Realm also asks for a code from your authenticator app. Keep your backup codes somewhere safe."
          : "Signing in to Realm now asks for your password only.",
      ],
      outro: [
        "If this wasn't you, reset your password straight away and check where you're signed in.",
      ],
      button: { label: "Check my security settings", href: "/settings/account", last: true },
      reason: "We send this when your sign-in settings change, to keep your account safe.",
    },
  );
}

export function signInCodeEmail(opts: { to: string; code: string; minutes: number }): Mail {
  return brandedMail(opts.to, `${opts.code} is your Realm sign-in code`, {
    preheader: `Use it to sign in. It works for ${opts.minutes} minutes.`,
    heading: "Your sign-in code",
    intro: ["Enter this code to sign in to Realm."],
    code: opts.code,
    outro: [
      `It works once, for ${opts.minutes} minutes.`,
      "Never share this code with anyone, not even someone who says they're from Realm.",
    ],
    reason:
      "You got this because someone asked to sign in to this Realm account. If it wasn't you, you can ignore it: nobody can sign in without the code.",
  });
}
