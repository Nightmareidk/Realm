/**
 * Keys the browser needs, all meant to be public (each is restricted on its own service's side:
 * the Mapbox token to Realm's URLs, Firebase's web config to Realm's domain). Missing ones turn
 * their feature off instead of breaking the page.
 */
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

/** Google Maps (restricted to Realm's domains in Google Cloud). Wins over Mapbox when set. */
export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
/** Optional: a Map ID from Google Cloud's map styling, to give the maps Realm's own look. */
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "";

/** Which maps Realm draws: Google when its key is set, otherwise Mapbox, otherwise none. */
export const MAP_PROVIDER: "google" | "mapbox" | null = GOOGLE_MAPS_KEY
  ? "google"
  : MAPBOX_TOKEN
    ? "mapbox"
    : null;
export const MAPS_ON = MAP_PROVIDER !== null;

export const FIREBASE =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    ? {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      }
    : null;
