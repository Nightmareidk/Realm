import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Unbounded } from "next/font/google";
import "./globals.css";

/** Wide, modern display face for headlines: a little spacey, never sci-fi costume. */
const unbounded = Unbounded({
  subsets: ["latin"],
  variable: "--font-unbounded",
  display: "swap",
});

/** Body text: designed for legibility (distinct letterforms help dyslexic readers). */
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
  // next/font has no metrics for this family, so it can't size-adjust a fallback; say so explicitly.
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.REALM_WEB_ORIGIN ?? "http://localhost:3000"),
  title: {
    default: "Realm: step into another universe with your crew",
    template: "%s | Realm",
  },
  description:
    "Chat, post, share clips and hang out with your friends. Spaces, a feed, profiles and boards in one app. Early access is open in your browser.",
  applicationName: "Realm",
};

export const viewport: Viewport = {
  themeColor: "#060d16",
  colorScheme: "dark light",
};

/**
 * Dark is the default. The day edition and paused motion are personal choices remembered on
 * this device and applied before first paint, so nothing flashes or moves unexpectedly.
 */
const bootScript = `try{var d=document.documentElement,t=localStorage.getItem("realm:theme");if(t==="day"||t==="night")d.dataset.theme=t;if(localStorage.getItem("realm:motion")==="paused")d.dataset.motion="paused"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${unbounded.variable} ${atkinson.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party preferences bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
