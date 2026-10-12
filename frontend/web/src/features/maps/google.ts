import { GOOGLE_MAPS_KEY } from "@/lib/public-config";

/**
 * Google Maps, loaded from Google only when a map or a place search is first used (nothing is
 * bundled). Just the few pieces Realm uses are typed here.
 */
export interface LatLngLiteral {
  lat: number;
  lng: number;
}
interface LatLng {
  lat(): number;
  lng(): number;
}
interface GooglePlace {
  id: string;
  displayName?: string | null;
  formattedAddress?: string | null;
  location?: LatLng | null;
}
export interface PlacesLibrary {
  Place: {
    searchByText(request: Record<string, unknown>): Promise<{ places: GooglePlace[] }>;
  };
}
export interface GeocodingLibrary {
  Geocoder: new () => {
    geocode(request: { location: LatLngLiteral }): Promise<{
      results: {
        formatted_address: string;
        address_components: { long_name: string; types: string[] }[];
      }[];
    }>;
  };
}
export interface GoogleMap {
  addListener(event: string, handler: (e: { latLng?: LatLng | null }) => void): unknown;
  panTo(at: LatLngLiteral): void;
  setZoom(zoom: number): void;
  getCenter(): LatLng | undefined;
}
export interface MapsLibrary {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMap;
}
export interface MarkerLibrary {
  AdvancedMarkerElement: new (
    options: Record<string, unknown>,
  ) => {
    position: LatLngLiteral | null;
    map: GoogleMap | null;
  };
  PinElement: new (options: Record<string, unknown>) => { element: HTMLElement };
}
interface GoogleMapsNamespace {
  importLibrary(name: string): Promise<unknown>;
}

let loading: Promise<GoogleMapsNamespace> | null = null;

function maps(): Promise<GoogleMapsNamespace> {
  const w = window as unknown as { google?: { maps?: GoogleMapsNamespace } };
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google.maps);
  loading ??= new Promise((resolve, reject) => {
    const callback = "__realmGoogleMaps";
    (window as unknown as Record<string, () => void>)[callback] = () => {
      const g = (window as unknown as { google?: { maps?: GoogleMapsNamespace } }).google?.maps;
      if (g) resolve(g);
      else reject(new Error("Google Maps didn't start"));
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&loading=async&callback=${callback}`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error("Google Maps couldn't load"));
    };
    document.head.append(s);
  });
  return loading;
}

/** One of Google's libraries ("maps", "marker", "places", "geocoding"). */
export async function googleLibrary<T>(name: string): Promise<T> {
  return (await maps()).importLibrary(name) as Promise<T>;
}

export const toLiteral = (p: LatLng): LatLngLiteral => ({ lat: p.lat(), lng: p.lng() });
