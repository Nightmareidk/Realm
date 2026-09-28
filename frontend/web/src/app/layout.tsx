import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

/**
 * Headlines: a modern editorial grotesk. Its optical sizes tighten it up at display sizes (the
 * browser picks the size automatically), and its ink traps give big type a crafted edge.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  axes: ["opsz"],
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
  metadataBase: new URL(SITE.origin),
  title: {
    default: SITE.title,
    template: "%s | Realm",
  },
  description: SITE.description,
  applicationName: "Realm",
  category: "social networking",
  keywords: [
    "Realm",
    "group chat",
    "friend group app",
    "gaming community",
    "Discord alternative",
    "Spaces",
    "short clips",
    "discussion boards",
    "social app",
  ],
  openGraph: {
    type: "website",
    siteName: "Realm",
    locale: "en_US",
    url: "/",
    title: SITE.title,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0c1f",
  colorScheme: "dark light",
};

/**
 * Dark is the default. The day edition and paused motion are personal choices remembered on
 * this device and applied before first paint, so nothing flashes or moves unexpectedly.
 */
const bootScript = `try{var d=document.documentElement;d.style.setProperty("--aurora-t",(Date.now()/1e3%48).toFixed(2));var t=localStorage.getItem("realm:theme");if(t==="day"||t==="night")d.dataset.theme=t;if(localStorage.getItem("realm:motion")==="paused")d.dataset.motion="paused"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${atkinson.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party preferences bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <div className="realm-nebula" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {children}
      </body>
    </html>
  );
}
