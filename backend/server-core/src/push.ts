import { signRS256 } from "./jwt";
import type { Logger } from "./logger";

export type PushPlatform = "web" | "ios" | "android";

/** The phone's notification groups (Android "channels"): people can turn each off on its own. */
export type PushChannel = "messages" | "activity";

export interface PushMessage {
  token: string;
  /** Where the token came from: the website's service worker, or the phone app. */
  platform?: PushPlatform;
  title: string;
  body: string;
  /** Where a tap opens, as a website path, e.g. `/spaces/lobby/general`. */
  link: string;
  /** Notifications with the same tag replace each other (one per room, not one per message). */
  tag: string;
  /** Which group it belongs to on the phone. */
  channel?: PushChannel;
  /** Small extra hints for the phone app, such as a chat's id and kind (strings only). */
  extra?: Record<string, string>;
}

/**
 * The Firebase message for one device. FCM data values must all be strings.
 * - Website: a data message that Realm's service worker (`public/sw.js`) shows itself.
 * - Android app: the data shape the phone's notifications library reads (`title`, `message`,
 *   `channelId`, `tag`, and `body` as JSON for the app), so it shows while the app is closed too.
 */
export function fcmMessage(m: PushMessage) {
  const extra = m.extra ?? {};
  if (m.platform === "android") {
    return {
      token: m.token,
      data: {
        title: m.title,
        message: m.body,
        body: JSON.stringify({ link: m.link, tag: m.tag, ...extra }),
        channelId: m.channel ?? "messages",
        tag: m.tag,
        color: "#FF8A3D",
      },
      android: { priority: "high", collapse_key: m.tag, ttl: "3600s" },
    };
  }
  return {
    token: m.token,
    data: { ...extra, title: m.title, body: m.body, link: m.link, tag: m.tag },
    webpush: { headers: { Urgency: "high", TTL: "3600" } },
  };
}

export type PushResult = "sent" | "gone" | "failed";

export interface Pusher {
  readonly enabled: boolean;
  send(message: PushMessage): Promise<PushResult>;
}

/** No push service configured: nothing is sent (development, tests). */
export class NoopPusher implements Pusher {
  /** Tests switch it on to see what would have been sent. */
  constructor(readonly enabled = false) {}
  readonly sent: PushMessage[] = [];
  async send(message: PushMessage): Promise<PushResult> {
    this.sent.push(message);
    return "sent";
  }
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  private_key_id?: string;
}

/** The service account JSON from an env var, given raw or base64-encoded. */
export function parseServiceAccount(value: string): ServiceAccount {
  const text = value.trim().startsWith("{") ? value : Buffer.from(value, "base64").toString("utf8");
  const sa = JSON.parse(text) as ServiceAccount;
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email or private_key");
  }
  return sa;
}

/**
 * Firebase Cloud Messaging over its HTTP v1 API. The service account signs a JWT, trades it for
 * an hour-long OAuth token, and every send uses that. Data-only messages: Realm's own service
 * worker shows them, so the text and the tap target stay under Realm's control.
 */
export class FcmPusher implements Pusher {
  readonly enabled = true;
  private token: { value: string; expires: number } | null = null;

  constructor(
    private readonly sa: ServiceAccount,
    private readonly logger?: Logger,
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now() + 60_000) return this.token.value;
    const now = Math.floor(Date.now() / 1000);
    const assertion = signRS256(
      {
        iss: this.sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      },
      this.sa.private_key,
      this.sa.private_key_id,
    );
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`FCM auth failed: ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  async send(m: PushMessage): Promise<PushResult> {
    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${await this.accessToken()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ message: fcmMessage(m) }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (res.ok) return "sent";
      // UNREGISTERED: the device unsubscribed or the token expired, so forget it. (A 400 can be
      // any malformed request, so it doesn't count.)
      if (res.status === 404) return "gone";
      this.logger?.warn({ status: res.status }, "push: FCM refused a message");
      return "failed";
    } catch (err) {
      this.logger?.warn({ err }, "push: FCM unreachable");
      return "failed";
    }
  }
}
