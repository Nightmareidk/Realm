import { GOOGLE_MAP_ID, MAP_PROVIDER, MAPBOX_TOKEN } from "@/lib/public-config";
import { googleLibrary, type MapsLibrary, type MarkerLibrary, toLiteral } from "./google";

/** A map the place picker can drive, whichever service draws it. */
export interface MapHandle {
  /** Put the one pin here. */
  pin(lat: number, lng: number): void;
  /** Move to a spot, close in. */
  fly(lat: number, lng: number): void;
  center(): { lat: number; lng: number } | null;
  destroy(): void;
}

const WORLD = { lat: 20, lng: 0 };

/** Draw an interactive map in `el` (Google or Mapbox, from the settings). Taps call `onTap`. */
export async function createMap(
  el: HTMLElement,
  onTap: (lat: number, lng: number) => void,
): Promise<MapHandle | null> {
  if (MAP_PROVIDER === "google") return googleMap(el, onTap);
  if (MAP_PROVIDER === "mapbox") return mapboxMap(el, onTap);
  return null;
}

async function googleMap(el: HTMLElement, onTap: (lat: number, lng: number) => void) {
  const [{ Map: GoogleMapClass }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
    googleLibrary<MapsLibrary>("maps"),
    googleLibrary<MarkerLibrary>("marker"),
  ]);
  const map = new GoogleMapClass(el, {
    center: WORLD,
    zoom: 2,
    // A Map ID from Google Cloud styles it; without one, Google's own dark scheme.
    mapId: GOOGLE_MAP_ID || "DEMO_MAP_ID",
    colorScheme: "DARK",
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    gestureHandling: "cooperative",
  });
  const pinEl = new PinElement({
    background: "#f5f4f2",
    borderColor: "#0b0b0e",
    glyphColor: "#0b0b0e",
  });
  const marker = new AdvancedMarkerElement({ content: pinEl.element });
  map.addListener("click", (e) => {
    if (e.latLng) {
      const at = toLiteral(e.latLng);
      onTap(at.lat, at.lng);
    }
  });
  return {
    pin(lat: number, lng: number) {
      marker.position = { lat, lng };
      marker.map = map;
    },
    fly(lat: number, lng: number) {
      map.panTo({ lat, lng });
      map.setZoom(15);
    },
    center() {
      const c = map.getCenter();
      return c ? toLiteral(c) : null;
    },
    destroy() {
      marker.map = null;
      el.replaceChildren();
    },
  } satisfies MapHandle;
}

async function mapboxMap(el: HTMLElement, onTap: (lat: number, lng: number) => void) {
  const mapboxgl = (await import("mapbox-gl")).default;
  mapboxgl.accessToken = MAPBOX_TOKEN;
  const m = new mapboxgl.Map({
    container: el,
    style: "mapbox://styles/mapbox/dark-v11",
    center: [WORLD.lng, WORLD.lat],
    zoom: 1.4,
    attributionControl: true,
    cooperativeGestures: true,
  });
  m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
  const marker = new mapboxgl.Marker({ color: "#f5f4f2" });
  m.on("click", (e) => onTap(e.lngLat.lat, e.lngLat.lng));
  return {
    pin(lat: number, lng: number) {
      marker.setLngLat([lng, lat]).addTo(m);
    },
    fly(lat: number, lng: number) {
      m.flyTo({ center: [lng, lat], zoom: 15, essential: false });
    },
    center() {
      const c = m.getCenter();
      return { lat: c.lat, lng: c.lng };
    },
    destroy() {
      m.remove();
    },
  } satisfies MapHandle;
}
