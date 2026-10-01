import type { NextConfig } from "next";

const API_URL = process.env.REALM_API_URL ?? "http://localhost:4000";
const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy: only this site's own code, styles, images, fonts and media load, and
 * the page can't be framed, can't post forms elsewhere, and can't have its base URL swapped. An
 * injected <script src="https://evil…">, <object> or <iframe> is refused by the browser.
 *
 * Inline scripts stay allowed: Next.js boots each static page with small inline scripts, and
 * the alternative (a nonce per request) would render every page on every visit instead of serving
 * it prebuilt. 'wasm-unsafe-eval' lets the 3D model decoder (Draco, WebAssembly) compile; its
 * workers start from blob: URLs. Development also needs 'unsafe-eval' (React's debugging).
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  "connect-src 'self' blob: data:",
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
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
