import { createHash } from "node:crypto";
import type { FoundPlace } from "@realm/contracts";
import type { Deps } from "../../deps";

/**
 * Place search for the free maps: Photon, a search over OpenStreetMap data (photon.komoot.io).
 * Realm asks it from the server, so the service sees Realm, not the person (no IP, no account),
 * and the same searches are answered from Realm's cache. Photon asks for fair use, so answers
 * are kept for a day and Realm backs off for a minute when Photon says "too many".
 */
const PHOTON = "https://photon.komoot.io";
const AGENT = "Realm (tomyrealm.com)";
const CACHE_SECONDS = 24 * 3600;
const BACKOFF_KEY = "places:backoff";
/** Towns and cities, for "Spaces near you" and a Space's home town. */
const CITY_KINDS = new Set(["city", "town", "village", "municipality", "borough", "hamlet"]);

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

/** Coordinates rounded to about 1 km: enough to rank nearby places, too rough to track anyone. */
const rough = (n: number) => Math.round(n * 100) / 100;

export class PlacesService {
  constructor(private readonly deps: Deps) {}

  async search(
    q: string,
    opts: { near?: { lat: number; lng: number }; cities?: boolean },
  ): Promise<FoundPlace[]> {
    const params = new URLSearchParams({ q, limit: opts.cities ? "10" : "8" });
    if (opts.near) {
      params.set("lat", String(rough(opts.near.lat)));
      params.set("lon", String(rough(opts.near.lng)));
    }
    if (opts.cities) params.set("osm_tag", "place");
    const found = await this.ask(`/api/?${params}`);
    const places = found
      .filter((f) => !opts.cities || CITY_KINDS.has(f.properties?.osm_value ?? ""))
      .flatMap((f) => toPlace(f) ?? []);
    // The same place can come back twice (a node and its outline): keep the first.
    const seen = new Set<string>();
    return places
      .filter((p) => {
        const k = `${p.name}|${p.address}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 6);
  }

  /** The best name for a point someone tapped on the map. */
  async nameOf(lat: number, lng: number): Promise<FoundPlace | null> {
    // About 10 m: the same tap twice is one question.
    const la = Math.round(lat * 10_000) / 10_000;
    const ln = Math.round(lng * 10_000) / 10_000;
    const [f] = await this.ask(`/reverse?lat=${la}&lon=${ln}&limit=1`);
    const p = f ? toPlace(f) : null;
    // The pin stays where they put it; only the name comes from the search.
    return p ? { ...p, lat, lng } : null;
  }

  private async ask(path: string): Promise<PhotonFeature[]> {
    const key = `places:c:${createHash("sha256").update(path).digest("base64url").slice(0, 32)}`;
    const cached = await this.deps.kv.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as PhotonFeature[];
      } catch {
        // A bad cache entry: ask again.
      }
    }
    if (await this.deps.kv.get(BACKOFF_KEY)) throw new PlacesBusy();
    let res: Response;
    try {
      res = await fetch(`${PHOTON}${path}`, {
        headers: { Accept: "application/json", "User-Agent": AGENT },
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      this.deps.logger.warn({ err }, "places: search unreachable");
      throw new PlacesBusy();
    }
    if (res.status === 429 || res.status >= 500) {
      await this.deps.kv.set(BACKOFF_KEY, "1", 60);
      this.deps.logger.warn({ status: res.status }, "places: search said wait");
      throw new PlacesBusy();
    }
    if (!res.ok) return [];
    const body = (await res.json().catch(() => null)) as { features?: PhotonFeature[] } | null;
    const features = Array.isArray(body?.features) ? body.features.slice(0, 12) : [];
    await this.deps.kv.set(key, JSON.stringify(features), CACHE_SECONDS);
    return features;
  }
}

export class PlacesBusy extends Error {
  constructor() {
    super("place search is busy");
  }
}

function toPlace(f: PhotonFeature): FoundPlace | null {
  const c = f.geometry?.coordinates;
  const p = f.properties;
  if (!c || !p || typeof c[0] !== "number" || typeof c[1] !== "number") return null;
  const [lng, lat] = c;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const name = (p.name ?? street) || p.city || p.state || p.country;
  if (!name) return null;
  const parts = [
    street && street !== name ? street : null,
    p.district !== name ? p.district : null,
    p.city !== name ? p.city : null,
    p.state !== name && p.state !== p.city ? p.state : null,
    p.country !== name ? p.country : null,
  ].filter((x): x is string => Boolean(x));
  const address = [...new Set(parts)].join(", ");
  return {
    id: `osm:${p.osm_type ?? "x"}${p.osm_id ?? `${lat},${lng}`}`.slice(0, 80),
    name: name.slice(0, 120),
    address: address ? address.slice(0, 240) : null,
    lat,
    lng,
  };
}
