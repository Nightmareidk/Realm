import { type Release, ReleasePlatform, ReleasesResponse } from "@realm/contracts";

const API_URL = process.env.REALM_API_URL ?? "http://localhost:4000";

/** What the download portal shows when the API can't be reached: every app is coming soon. */
const FALLBACK: Release[] = ReleasePlatform.options.map((platform) => ({
  platform,
  status: "coming_soon",
  channel: "stable",
  version: null,
  url: null,
  sha256: null,
  sizeBytes: null,
  minOs: null,
  publishedAt: null,
}));

/**
 * Download-portal data from `GET /v1/releases`. Revalidated every five minutes, so flipping a
 * platform to "available" in the database publishes the button without a deploy.
 */
export async function getReleases(): Promise<Release[]> {
  try {
    const res = await fetch(`${API_URL}/v1/releases`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return FALLBACK;
    return ReleasesResponse.parse(await res.json()).releases;
  } catch {
    return FALLBACK;
  }
}
