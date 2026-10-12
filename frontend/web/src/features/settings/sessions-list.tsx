"use client";

import { Browser, DeviceMobile, Monitor } from "@phosphor-icons/react";
import type { SessionInfo } from "@realm/contracts";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormNotice } from "@/components/form";
import { pill } from "@/components/pill";
import { ApiError, api } from "@/lib/api";

const PLATFORM: Record<SessionInfo["platform"], string> = {
  web: "Browser",
  windows: "Windows app",
  macos: "Mac app",
  linux: "Linux app",
  ios: "iPhone or iPad app",
  android: "Android app",
};

function DeviceIcon({ platform }: { platform: SessionInfo["platform"] }) {
  const Icon =
    platform === "web"
      ? Browser
      : platform === "ios" || platform === "android"
        ? DeviceMobile
        : Monitor;
  return <Icon aria-hidden="true" size={24} className="shrink-0 text-fg-soft" />;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "just now", "5 minutes ago", "yesterday", or a date once it's more than a week. */
function since(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return relative.format(-Math.round(seconds / 60), "minute");
  if (seconds < 86400) return relative.format(-Math.round(seconds / 3600), "hour");
  if (seconds < 7 * 86400) return relative.format(-Math.round(seconds / 86400), "day");
  return `on ${dateFormat.format(new Date(iso))}`;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; sessions: SessionInfo[] };

/**
 * Everywhere this account is signed in, this device first. Any other one can be signed out,
 * one at a time or all at once.
 */
export function SessionsList() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { sessions } = await api<{ sessions: SessionInfo[] }>("/auth/sessions");
      sessions.sort((a, b) => Number(b.current) - Number(a.current));
      setState({ status: "ready", sessions });
    } catch (err) {
      if (err instanceof ApiError && err.signedOut) {
        router.replace("/login?next=/settings/devices");
        return;
      }
      setState({
        status: "error",
        message: err instanceof ApiError ? err.message : "Couldn't load your devices.",
      });
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string | "others") => {
    if (busy) return;
    setBusy(id);
    setNotice(null);
    try {
      if (id === "others") {
        const { revoked } = await api<{ revoked: number }>("/auth/sessions", { method: "DELETE" });
        setNotice({
          tone: "success",
          text:
            revoked === 1
              ? "Signed out of 1 other device."
              : `Signed out of ${revoked} other devices.`,
        });
      } else {
        await api(`/auth/sessions/${id}`, { method: "DELETE" });
        setNotice({ tone: "success", text: "Signed out of that device." });
      }
      await load();
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Couldn't sign that device out. Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  if (state.status === "loading") {
    return (
      <p role="status" className="border-y border-line py-6 text-fg-soft">
        Loading your devices…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <FormNotice>{state.message}</FormNotice>
        <button type="button" onClick={() => void load()} className={pill("ghost", "md")}>
          Try again
        </button>
      </div>
    );
  }

  const others = state.sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-5">
      {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
      <ul className="divide-y divide-line border-y border-line">
        {state.sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
            <DeviceIcon platform={s.platform} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-fg">
                {s.deviceName}
                {s.current && (
                  <span className="inline-flex h-6 items-center rounded-full bg-fg/8 px-2.5 text-[0.82rem] font-bold text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)]">
                    This device
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[0.94rem] text-fg-soft tabular">
                {PLATFORM[s.platform]} · signed in {since(s.createdAt)}
                {!s.current && <> · last active {since(s.lastActiveAt)}</>}
              </p>
            </div>
            {!s.current && (
              <button
                type="button"
                onClick={() => void revoke(s.id)}
                aria-disabled={busy !== null || undefined}
                className={pill("ghost", "sm", "max-sm:ml-10")}
              >
                {busy === s.id ? "Signing out" : "Sign out"}
                <span className="sr-only"> of {s.deviceName}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {others > 0 ? (
        <button
          type="button"
          onClick={() => void revoke("others")}
          aria-disabled={busy !== null || undefined}
          className={pill("ghost", "md")}
        >
          {busy === "others" ? "Signing out" : "Sign out of all other devices"}
        </button>
      ) : (
        <p className="text-fg-soft">You're only signed in here.</p>
      )}
    </div>
  );
}
