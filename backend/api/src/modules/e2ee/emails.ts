import { brandedMail, formatWhen, type Mail } from "@realm/server-core";

export function deviceApprovedEmail(opts: { to: string; device: string; when: Date }): Mail {
  return brandedMail(opts.to, "A new device can read your encrypted Realm chats", {
    preheader: `${opts.device} can now read your encrypted chats.`,
    heading: "A new device can read your encrypted chats",
    intro: ["A device was just confirmed for your encrypted chats on Realm."],
    details: [
      { label: "Device", value: opts.device },
      { label: "When", value: formatWhen(opts.when) },
    ],
    outro: [
      "If this was you, there's nothing to do.",
      "If it wasn't, remove the device straight away and change your password.",
    ],
    button: { label: "Check my devices", href: "/settings/devices", last: true },
    reason: "We send this every time a device is added to your encrypted chats.",
  });
}

export function securityCodeChangedEmail(opts: { to: string; when: Date }): Mail {
  return brandedMail(opts.to, "Your Realm security code changed", {
    preheader: "Your encryption key was replaced and your old devices were removed.",
    heading: "Your security code changed",
    intro: [
      "Your account's encryption key was replaced, and all your old devices were removed from your encrypted chats.",
      "The people you chat with will see that your security code changed.",
    ],
    details: [{ label: "When", value: formatWhen(opts.when) }],
    outro: ["If you didn't do this, sign in and change your password straight away."],
    button: { label: "Check my security settings", href: "/settings/account", last: true },
    reason: "We send this when your encryption key changes, to keep your chats safe.",
  });
}
