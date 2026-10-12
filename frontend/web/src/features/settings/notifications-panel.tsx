"use client";

import { BellRinging } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { FormNotice } from "@/components/form";
import { pill } from "@/components/pill";
import { SoonTag } from "@/features/app/place";
import { disablePush, enablePush, type PushState, pushState } from "@/features/push/push";
import { useRealm } from "@/features/realtime/store";
import { FIREBASE } from "@/lib/public-config";

/** Push notifications on this device, and plainly what they'll tell you. */
export function NotificationsPanel() {
  const [device, setState] = useState<PushState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // The server has to be able to send too; never offer a switch that can't do anything.
  const serverPush = useRealm((s) => s.capabilities?.push);
  const notSetUp = !FIREBASE || serverPush === false;
  const state = notSetUp ? "unavailable" : device;

  useEffect(() => {
    void pushState().then(setState);
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

  return (
    <div className="space-y-5">
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
      <ul className="max-w-[56ch] list-disc space-y-1.5 pl-5 text-[0.95rem] text-fg-soft">
        <li>New messages in Spaces of up to 50 people, while you're away from Realm.</li>
        <li>At most one per room every couple of minutes; a newer one replaces it.</li>
        <li>Nothing from people you've blocked or muted, or from Spaces you've muted.</li>
        <li>
          Notifications pass through Google's push service (Firebase), like most apps'. Message text
          is included so you can read it at a glance.
        </li>
      </ul>
      <SoonTag>Mentions and per-room choices: coming soon</SoonTag>
    </div>
  );
}
