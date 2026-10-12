import { MAP_PROVIDER, MAPBOX_TOKEN } from "@/lib/public-config";
import { type GeocodingLibrary, googleLibrary, type PlacesLibrary } from "./google";

export interface Found {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
}

interface Feature {
  id: string;
  properties: {
    name: string;
    full_address?: string;
    place_formatted?: string;
    coordinates: { latitude: number; longitude: number };
  };
}

const BASE = "https://api.mapbox.com/search/geocode/v6";

function toFound(f: Feature): Found {
  return {
    id: f.id,
    name: f.properties.name,
    address: f.properties.place_formatted ?? f.properties.full_address ?? null,
    lat: f.properties.coordinates.latitude,
    lng: f.properties.coordinates.longitude,
  };
}

/** Places matching what you typed. `cities` keeps it to towns and cities. */
export async function searchPlaces(
  query: string,
  opts: { near?: { lat: number; lng: number }; cities?: boolean; signal?: AbortSignal } = {},
): Promise<Found[]> {
  if (query.trim().length < 2) return [];
  if (MAP_PROVIDER === "google") return googleSearch(query.trim(), opts);
  if (!MAPBOX_TOKEN) return [];
  const params = new URLSearchParams({ q: query.trim(), limit: "6", access_token: MAPBOX_TOKEN });
  if (opts.near) params.set("proximity", `${opts.near.lng},${opts.near.lat}`);
  if (opts.cities) params.set("types", "place,locality");
  const res = await fetch(`${BASE}/forward?${params}`, { signal: opts.signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { features: Feature[] };
  return json.features.map(toFound);
}

/** The best name for a point on the map. */
export async function nameOf(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<Found | null> {
  if (MAP_PROVIDER === "google") return googleName(lat, lng);
  if (!MAPBOX_TOKEN) return null;
  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    limit: "1",
    access_token: MAPBOX_TOKEN,
  });
  const res = await fetch(`${BASE}/reverse?${params}`, { signal });
  if (!res.ok) return null;
  const json = (await res.json()) as { features: Feature[] };
  const f = json.features[0];
  return f ? { ...toFound(f), lat, lng } : null;
}

async function googleSearch(
  query: string,
  opts: { near?: { lat: number; lng: number }; cities?: boolean; signal?: AbortSignal },
): Promise<Found[]> {
  const { Place } = await googleLibrary<PlacesLibrary>("places");
  const { places } = await Place.searchByText({
    textQuery: query,
    fields: ["id", "displayName", "formattedAddress", "location"],
    maxResultCount: 6,
    ...(opts.near ? { locationBias: { center: opts.near, radius: 50_000 } } : {}),
    ...(opts.cities ? { includedType: "locality", useStrictTypeFiltering: true } : {}),
  });
  if (opts.signal?.aborted) return [];
  return places.flatMap((p) =>
    p.location
      ? [
          {
            id: p.id,
            name: p.displayName ?? p.formattedAddress ?? "Place",
            address: p.formattedAddress ?? null,
            lat: p.location.lat(),
            lng: p.location.lng(),
          },
        ]
      : [],
  );
}

async function googleName(lat: number, lng: number): Promise<Found | null> {
  const { Geocoder } = await googleLibrary<GeocodingLibrary>("geocoding");
  const { results } = await new Geocoder().geocode({ location: { lat, lng } });
  const best = results[0];
  if (!best) return null;
  const named = best.address_components.find((c) =>
    ["point_of_interest", "premise", "establishment", "route", "neighborhood", "locality"].some(
      (t) => c.types.includes(t),
    ),
  );
  return {
    id: `${lat},${lng}`,
    name: named?.long_name ?? best.formatted_address.split(",")[0] ?? "Dropped pin",
    address: best.formatted_address,
    lat,
    lng,
  };
}

/** Where this device is, if the person allows it, asked only when they press the button. */
export function whereAmI(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}
