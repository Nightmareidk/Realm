import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

const API_URL = process.env.REALM_API_URL ?? "http://localhost:4000";
const isDev = process.env.NODE_ENV === "development";
/** Development: this PC's home-network addresses, so a phone on the Wi-Fi can open the dev site. */
const LAN_HOSTS = isDev
  ? Object.values(networkInterfaces())
      .flat()
      .flatMap((i) => (i && i.family === "IPv4" && !i.internal ? [i.address] : []))
  : [];
const LAN_GATEWAYS = LAN_HOSTS.map((h) => `ws://${h}:4000`).join(" ");
/** The realtime gateway (the API serves it at /gateway in development). */
const GATEWAY_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_REALM_GATEWAY_URL ?? "ws://localhost:4000/gateway",
).origin;
/** Where uploads go and are read from directly (Cloudflare R2), when it's set up. */
const STORAGE_ORIGIN = process.env.REALM_STORAGE_ORIGIN
  ? new URL(process.env.REALM_STORAGE_ORIGIN).origin
  : "";
/** Voice and video (LiveKit Cloud, or your own LiveKit server). */
const LIVEKIT = process.env.NEXT_PUBLIC_LIVEKIT_HOST
  ? `wss://${process.env.NEXT_PUBLIC_LIVEKIT_HOST} https://${process.env.NEXT_PUBLIC_LIVEKIT_HOST}`
  : "wss://*.livekit.cloud https://*.livekit.cloud";
/** In development, LiveKit for Windows on this PC (the `realm-voice` dev server). */
const LIVEKIT_LOCAL = isDev ? "ws://localhost:7880 http://localhost:7880" : "";
/** Maps (Mapbox) and push sign-up (Firebase Cloud Messaging). */
const MAPBOX = "https://api.mapbox.com https://events.mapbox.com";
/** Google Maps, when its key is set (it loads its own script, tiles and fonts from Google). */
const GOOGLE = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY);
const GOOGLE_SCRIPT = GOOGLE ? "https://maps.googleapis.com https://maps.gstatic.com" : "";
const GOOGLE_IMG = GOOGLE
  ? "https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com"
  : "";
const GOOGLE_CONNECT = GOOGLE ? "https://*.googleapis.com https://*.google.com" : "";
const FIREBASE =
  "https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com";

/**
 * Content Security Policy: only this site's own code, styles, images, fonts and media load, and
 * the page can't be framed, can't post forms elsewhere, and can't have its base URL swapped. An
 * injected <script src="https://evil…">, <object> or <iframe> is refused by the browser.
 *
 * Inline scripts stay allowed: Next.js boots each static page with small inline scripts, and
 * the alternative (a nonce per request) would render every page on every visit instead of serving
 * it prebuilt. 'wasm-unsafe-eval' lets the 3D model decoder (Draco, WebAssembly) compile; its
 * workers start from blob: URLs. Development also needs 'unsafe-eval' (React's debugging).
 * Beyond that, the page may reach exactly the services Realm uses: the realtime gateway, upload
 * storage, LiveKit for calls, Mapbox for maps, and Firebase to sign up for push notifications.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""} ${GOOGLE_SCRIPT}`.trim(),
  `style-src 'self' 'unsafe-inline'${GOOGLE ? " https://fonts.googleapis.com" : ""}`,
  // Free library music: covers from Openverse and Jamendo, tracks streamed from Jamendo.
  `img-src 'self' data: blob: https://api.mapbox.com https://api.openverse.org https://usercontent.jamendo.com ${GOOGLE_IMG} ${STORAGE_ORIGIN}`.trim(),
  `font-src 'self'${GOOGLE ? " https://fonts.gstatic.com" : ""}`,
  `media-src 'self' blob: https://prod-1.storage.jamendo.com https://*.jamendo.com ${STORAGE_ORIGIN}`.trim(),
  `connect-src 'self' blob: data: ${GATEWAY_ORIGIN} ${LAN_GATEWAYS} ${STORAGE_ORIGIN} ${LIVEKIT} ${LIVEKIT_LOCAL} ${MAPBOX} ${GOOGLE_CONNECT} ${FIREBASE}`.replace(
    /\s+/g,
    " ",
  ),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: LAN_HOSTS,
  poweredByHeader: false,
  devIndicators: false,
  // The web app talks to the API same-origin (/api/v1/...), so session cookies stay first-party.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // HTTPS only, for two years, subdomains too (browsers ignore it over plain HTTP).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Other sites' windows can't reach into ours, nor embed our files.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          {
            key: "Permissions-Policy",
            value:
              // Calls, screen sharing and "use my location" work on Realm's own pages only.
              "camera=(self), microphone=(self), display-capture=(self), geolocation=(self), payment=(), usb=(), serial=(), hid=(), bluetooth=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
