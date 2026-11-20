import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api } from "./server";

/**
 * Phone notifications (Android): Firebase delivers them, the phone shows them even while Realm is
 * closed, and a tap opens the chat, post or profile it's about. Realm's server only sends while
 * you're away, and Settings › Notifications says what about.
 */
export const PUSH_SUPPORTED = Platform.OS === "android";

const TOKEN_KEY = "realm.push-token";
const ASKED_KEY = "realm.push-asked";

export type PhonePush = "unsupported" | "blocked" | "off" | "on";

const store = {
  get: (k: string) => SecureStore.getItemAsync(k).catch(() => null),
  set: (k: string, v: string) => SecureStore.setItemAsync(k, v).catch(() => {}),
  del: (k: string) => SecureStore.deleteItemAsync(k).catch(() => {}),
};

if (PUSH_SUPPORTED) {
  // While Realm is open it shows new things itself, so a banner on top would be noise.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** The two groups people can tune in Android's own settings (made before asking, as Android needs). */
async function channels() {
  await Notifications.setNotificationChannelAsync("messages", {
    name: "Messages",
    description: "Chats, group chats and Spaces",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#FF8A3D",
  });
  await Notifications.setNotificationChannelAsync("activity", {
    name: "Likes, comments and follows",
    description: "Activity on your posts and profile",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#FF8A3D",
  });
}

/** Tell Realm where to reach this phone (the token can change; sending it again is harmless). */
async function register(): Promise<void> {
  const { data: token } = await Notifications.getDevicePushTokenAsync();
  if (typeof token !== "string" || token.length < 20) throw new Error("no token");
  await api("/users/@me/push-tokens", { method: "PUT", body: { token, platform: "android" } });
  await store.set(TOKEN_KEY, token);
}

export async function phonePushState(): Promise<PhonePush> {
  if (!PUSH_SUPPORTED) return "unsupported";
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return canAskAgain ? "off" : "blocked";
  return (await store.get(TOKEN_KEY)) ? "on" : "off";
}

/** Ask Android (once it says yes, it doesn't ask again), then sign this phone up. */
export async function turnOnPhonePush(): Promise<PhonePush> {
  if (!PUSH_SUPPORTED) return "unsupported";
  await channels();
  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && canAskAgain) {
    ({ status, canAskAgain } = await Notifications.requestPermissionsAsync());
  }
  await store.set(ASKED_KEY, "1");
  if (status !== "granted") return canAskAgain ? "off" : "blocked";
  await register();
  return "on";
}

/** Stop notifications on this phone only (other devices keep theirs). */
export async function turnOffPhonePush(): Promise<PhonePush> {
  const token = await store.get(TOKEN_KEY);
  await store.del(TOKEN_KEY);
  if (token) {
    await api("/users/@me/push-tokens", { method: "DELETE", body: { token } }).catch(() => {});
  }
  return PUSH_SUPPORTED ? "off" : "unsupported";
}

/**
 * Signed in: keep this phone's sign-up fresh, and the first time ever, ask (Android shows its
 * own "Allow notifications?" once). Never throws: notifications are a nice-to-have here.
 */
export async function startPhonePush(): Promise<void> {
  if (!PUSH_SUPPORTED) return;
  try {
    const asked = await store.get(ASKED_KEY);
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") {
      // Turned off in Settings on purpose: leave it off.
      if (asked && !(await store.get(TOKEN_KEY))) return;
      await channels();
      await register();
    } else if (!asked) {
      await turnOnPhonePush();
    }
  } catch {
    // No Google Play services, offline, or Firebase not set up in this build: try next time.
  }
}

/** Signing out: this phone shouldn't get that account's notifications any more. */
export async function forgetPhonePush(): Promise<void> {
  if (!PUSH_SUPPORTED) return;
  const token = await store.get(TOKEN_KEY);
  if (token) {
    await api("/users/@me/push-tokens", { method: "DELETE", body: { token } }).catch(() => {});
  }
  await store.del(TOKEN_KEY);
}

/** Firebase may give the phone a new token now and then: pass it on. */
export function watchPhonePushToken(): () => void {
  if (!PUSH_SUPPORTED) return () => {};
  const sub = Notifications.addPushTokenListener(async ({ data }) => {
    if (typeof data !== "string" || !(await store.get(TOKEN_KEY))) return;
    await api("/users/@me/push-tokens", {
      method: "PUT",
      body: { token: data, platform: "android" },
    }).catch(() => {});
    await store.set(TOKEN_KEY, data);
  });
  return () => sub.remove();
}

/** What a tapped notification carries (see the server's jobs.ts). */
export interface PushTarget {
  room?: string;
  kind?: string;
  name?: string;
  post?: string;
  user?: string;
  screen?: string;
}

/** Only the keys Realm sends, as plain strings: nothing else from a notification is trusted. */
export function pushTarget(data: unknown): PushTarget {
  if (!data || typeof data !== "object") return {};
  const d = data as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === "string" && /^\d{1,20}$/.test(v) ? v : undefined);
  const word = (v: unknown, re: RegExp) => (typeof v === "string" && re.test(v) ? v : undefined);
  return {
    room: id(d.room),
    kind: word(d.kind, /^(dm|group_dm|room)$/),
    name: typeof d.name === "string" ? d.name.slice(0, 80) : undefined,
    post: id(d.post),
    user: word(d.user, /^[a-z0-9_.]{1,32}$/i),
    screen: word(d.screen, /^(follow-requests|activity)$/),
  };
}
