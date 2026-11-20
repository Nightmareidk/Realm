"use client";

import { BellRinging } from "@phosphor-icons/react";
import type { NotificationKind, NotificationPrefs } from "@realm/contracts";
import { useEffect, useId, useState } from "react";
import { FormNotice } from "@/components/form";
import { pill } from "@/components/pill";
import { disablePush, enablePush, type PushState, pushState } from "@/features/push/push";
import { useRealm } from "@/features/realtime/store";
import { api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { FIREBASE } from "@/lib/public-config";

const KINDS: { kind: NotificationKind; label: string; hint: string }[] = [
  {
    kind: "messages",
    label: "Messages",
    hint: "Chats, group chats, and Spaces of up to 50 people.",
  },
  { kind: "comments", label: "Comments and replies", hint: "On your posts, and replies to you." },
  { kind: "mentions", label: "Mentions and tags", hint: "When someone @mentions or tags you." },
  { kind: "follows", label: "New followers", hint: "New followers and follow requests." },
  { kind: "likes", label: "Likes and reposts", hint: "At most one per post every 10 minutes." },
];

/** Push notifications on this device, what they tell you about, and plainly how they work. */
export function NotificationsPanel() {
  const [device, setState] = useState<PushState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  // The server has to be able to send too; never offer a switch that can't do anything.
  const serverPush = useRealm((s) => s.capabilities?.push);
  const notSetUp = !FIREBASE || serverPush === false;
  const state = notSetUp ? "unavailable" : device;

  useEffect(() => {
    void pushState().then(setState);
    api<NotificationPrefs>("/users/@me/notification-prefs")
      .then(setPrefs)
      .catch(() => setError("Couldn't load your notification choices. Reload to try again."));
  }, []);

  const flip = async () => {
    setPending(true);
    setError("");
    try {
      setState(state === "on" ? await disablePush() : await enablePush());
    } catch {
      setError("Couldn't change notifications on this device. Try again.");
    } finally {
      setPending(false);
    }
  };

  // Shown at once, saved behind; put back if the save fails.
  const change = async (patch: {
    paused?: boolean;
    kinds?: Partial<Record<NotificationKind, boolean>>;
  }) => {
    if (!prefs) return;
    const before = prefs;
    setPrefs({ paused: patch.paused ?? prefs.paused, kinds: { ...prefs.kinds, ...patch.kinds } });
    setError("");
    try {
      setPrefs(
        await api<NotificationPrefs>("/users/@me/notification-prefs", {
          method: "PUT",
          body: patch,
        }),
      );
    } catch {
      setPrefs(before);
      setError("That didn't save. Try again.");
    }
  };

  return (
    <div className="space-y-6">
      <FormNotice>{error}</FormNotice>
      {state === null ? (
        <p role="status" className="text-fg-soft">
          Checking this device…
        </p>
      ) : state === "unavailable" ? (
        <p className="text-fg-soft">
          {notSetUp
            ? "Push notifications aren't set up on this Realm yet."
            : "This browser doesn't support push notifications."}
        </p>
      ) : state === "blocked" ? (
        <p className="text-fg-soft">
          Your browser is blocking notifications from Realm. Allow them in the address bar's site
          settings, then come back here.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-bold text-fg">
            <BellRinging aria-hidden="true" size={20} />
            {state === "on" ? "On for this device" : "Off on this device"}
          </span>
          <button
            type="button"
            aria-disabled={pending || undefined}
            onClick={() => void flip()}
            className={pill(state === "on" ? "ghost" : "action", "md")}
          >
            {pending ? "One moment" : state === "on" ? "Turn off" : "Turn on"}
          </button>
        </div>
      )}

      {prefs && (
        <section aria-labelledby="notify-what" className="max-w-[40rem]">
          <h2 id="notify-what" className="pb-1 font-display text-[1.1rem] font-bold text-fg">
            What to tell you about
          </h2>
          <p className="pb-2 text-[0.92rem] text-fg-soft">
            On every device where notifications are on, including the Android app.
          </p>
          <Toggle
            label="Pause all"
            hint="Nothing buzzes until you turn this off. Your choices below stay as they are."
            checked={prefs.paused}
            onChange={(paused) => void change({ paused })}
          />
          {KINDS.map((k) => (
            <Toggle
              key={k.kind}
              label={k.label}
              hint={k.hint}
              checked={prefs.kinds[k.kind] && !prefs.paused}
              disabled={prefs.paused}
              onChange={(on) => void change({ kinds: { [k.kind]: on } })}
            />
          ))}
        </section>
      )}

      <ul className="max-w-[56ch] list-disc space-y-1.5 pl-5 text-[0.95rem] text-fg-soft">
        <li>Only while you're away from Realm: when you're here, the app shows it instead.</li>
        <li>At most one per chat every couple of minutes; a newer one replaces it.</li>
        <li>Nothing from people you've blocked or muted, or from Spaces you've muted.</li>
        <li>
          Notifications pass through Google's push service (Firebase), like most apps'. Message text
          is included so you can read it at a glance.
        </li>
      </ul>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <div
      className={cx("flex items-center gap-4 border-t border-line py-3", disabled && "opacity-50")}
    >
      <span className="min-w-0 flex-1">
        <span id={id} className="block font-bold text-fg">
          {label}
        </span>
        <span id={`${id}-hint`} className="block text-[0.9rem] text-fg-soft">
          {hint}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        aria-describedby={`${id}-hint`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 disabled:cursor-not-allowed",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "absolute top-1 left-1 size-5 rounded-full bg-[#ffffff] shadow-[0_1px_3px_rgb(0_0_0/0.35)] transition-transform duration-150",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}
