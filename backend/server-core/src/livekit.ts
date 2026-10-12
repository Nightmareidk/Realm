import { signHS256 } from "./jwt";

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export type LiveKitSource = "microphone" | "camera" | "screen_share" | "screen_share_audio";

/**
 * An access token for one person in one LiveKit room (voice, video and screen sharing). It says
 * what they may publish; LiveKit enforces it. Short-lived: it's only needed to join.
 */
export function liveKitToken(
  cfg: LiveKitConfig,
  opts: {
    identity: string;
    name: string;
    room: string;
    canPublish: boolean;
    sources: LiveKitSource[];
    metadata?: string;
    ttlSeconds?: number;
  },
): string {
  const now = Math.floor(Date.now() / 1000);
  return signHS256(
    {
      iss: cfg.apiKey,
      sub: opts.identity,
      name: opts.name,
      nbf: now - 10,
      exp: now + (opts.ttlSeconds ?? 600),
      metadata: opts.metadata,
      video: {
        room: opts.room,
        roomJoin: true,
        canSubscribe: true,
        canPublish: opts.canPublish && opts.sources.length > 0,
        canPublishData: true,
        canPublishSources: opts.sources,
      },
    },
    cfg.apiSecret,
  );
}
