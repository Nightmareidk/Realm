"use client";

import { api } from "@/lib/api";
import { FIREBASE } from "@/lib/public-config";

const TOKEN_KEY = "realm:push-token";

export type PushState = "unavailable" | "blocked" | "off" | "on";

/** Whether this device can get notifications, and whether it's signed up. */
export async function pushState(): Promise<PushState> {
  if (!FIREBASE || !("serviceWorker" in navigator) || !("Notification" in window))
    return "unavailable";
  if (Notification.permission === "denied") return "blocked";
  try {
    return Notification.permission === "granted" && localStorage.getItem(TOKEN_KEY) ? "on" : "off";
  } catch {
    return "off";
  }
}

async function messaging() {
  if (!FIREBASE) throw new Error("push isn't set up");
  // Firebase loads only when someone turns notifications on.
  const [{ initializeApp, getApps }, fm] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (!(await fm.isSupported())) throw new Error("unsupported");
  const app = getApps()[0] ?? initializeApp(FIREBASE);
  return { m: fm.getMessaging(app), fm };
}

/** Ask the browser, sign this device up with Firebase, and tell Realm where to send. */
export async function enablePush(): Promise<PushState> {
  if (!FIREBASE) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const registration = await navigator.serviceWorker.register("/sw.js");
  const { m, fm } = await messaging();
  const token = await fm.getToken(m, {
    vapidKey: FIREBASE.vapidKey,
    serviceWorkerRegistration: registration,
  });
  await api("/users/@me/push-tokens", { method: "PUT", body: { token, platform: "web" } });
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
  return "on";
}

/** Stop notifications on this device (other devices keep theirs). */
export async function disablePush(): Promise<PushState> {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  if (token)
    await api("/users/@me/push-tokens", { method: "DELETE", body: { token } }).catch(() => {});
  try {
    const { m, fm } = await messaging();
    await fm.deleteToken(m);
  } catch {
    // Already gone, or Firebase can't load: Realm has forgotten the token either way.
  }
  return "off";
}
