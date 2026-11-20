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

/** The free maps' night style: OpenStreetMap data, drawn by OpenFreeMap (no key, no account). */
export const OSM_STYLE = "https://tiles.openfreemap.org/styles/dark";

/** Draw an interactive map in `el` (the free map, or Google or Mapbox when set). Taps call `onTap`. */
export async function createMap(
  el: HTMLElement,
  onTap: (lat: number, lng: number) => void,
  /** Closed before the map loaded: don't make it (no tiles fetched for nothing). */
  signal?: AbortSignal,
): Promise<MapHandle | null> {
  if (MAP_PROVIDER === "google") return googleMap(el, onTap);
  if (MAP_PROVIDER === "mapbox") return mapboxMap(el, onTap);
  return osmMap(el, onTap, signal);
}

async function osmMap(
  el: HTMLElement,
  onTap: (lat: number, lng: number) => void,
  signal?: AbortSignal,
) {
  const maplibre = await import("maplibre-gl");
  if (signal?.aborted) return null;
  const m = new maplibre.Map({
    container: el,
    style: OSM_STYLE,
    center: [WORLD.lng, WORLD.lat],
    zoom: 1.4,
    cooperativeGestures: true,
    attributionControl: { compact: true },
    // Sharp on phones without drawing more than a big screen needs.
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  });
  m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
  const marker = new maplibre.Marker({ color: "#f5f4f2" });
  m.on("click", (e) => onTap(e.lngLat.lat, e.lngLat.lng));
  return {
    pin(lat: number, lng: number) {
      marker.setLngLat([lng, lat]).addTo(m);
    },
    fly(lat: number, lng: number) {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (still) m.jumpTo({ center: [lng, lat], zoom: 15 });
      else m.flyTo({ center: [lng, lat], zoom: 15, essential: false });
    },
    center() {
      const c = m.getCenter();
      return { lat: c.lat, lng: c.lng };
    },
    destroy() {
      m.remove();
      // A newer map in the same box (opened again quickly) keeps the class this one took away.
      if (el.querySelector(".maplibregl-canvas-container")) el.classList.add("maplibregl-map");
    },
  } satisfies MapHandle;
}

/**
 * A still picture of a place on the free map, for the cards in chats: drawn once off screen,
 * kept as an image, and the map thrown away (browsers allow only a few live maps per page).
 * One at a time, remembered for the visit. Null if it can't be drawn.
 */
const snapshots = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();

export function placeSnapshot(lat: number, lng: number, width = 560, height = 260) {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)},${width}x${height}`;
  const known = snapshots.get(key);
  if (known) return known;
  const job = queue.then(() => drawSnapshot(lat, lng, width, height)).catch(() => null);
  queue = job;
  snapshots.set(key, job);
  return job;
}

async function drawSnapshot(lat: number, lng: number, width: number, height: number) {
  const maplibre = await import("maplibre-gl");
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none`;
  document.body.appendChild(holder);
  try {
    const m = new maplibre.Map({
      container: holder,
      style: OSM_STYLE,
      center: [lng, lat],
      zoom: 14.5,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      pixelRatio: 2,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    const url = await new Promise<string | null>((resolve) => {
      const give = setTimeout(() => resolve(null), 12_000);
      // "idle": the style, the tiles in view and the labels are all drawn. A missing tile only
      // leaves a gap, so errors don't stop it; the timer gives up on a map that never settles.
      m.once("idle", () => {
        clearTimeout(give);
        try {
          resolve(m.getCanvas().toDataURL("image/webp", 0.86));
        } catch {
          resolve(null);
        }
      });
    });
    m.remove();
    return url;
  } finally {
    holder.remove();
  }
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
