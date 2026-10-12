import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque, Funnel_Display } from "next/font/google";
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

/**
 * The front page's display face (the new world, 2026-10): a confident, slightly quirky grotesk
 * that stays crisp set tight and large. Reading text stays Atkinson.
 */
const funnel = Funnel_Display({
  subsets: ["latin"],
  variable: "--font-funnel",
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
 * Night is the only edition for now. The person's colour (Mint, Orchid, Aqua or Ember) and paused
 * motion are remembered on this device and applied before first paint, so nothing flashes or
 * moves unexpectedly. The front page's loader plays once per visit, never with reduced or paused
 * motion.
 */
const bootScript = `try{var d=document.documentElement;d.classList.add("js");d.style.setProperty("--aurora-t",(Date.now()/1e3%48).toFixed(2));var a=localStorage.getItem("realm:accent");if(a==="orchid"||a==="aqua"||a==="ember")d.dataset.accent=a;var p=localStorage.getItem("realm:motion")==="paused";if(p)d.dataset.motion="paused";if(p||sessionStorage.getItem("realm:loaded")||matchMedia("(prefers-reduced-motion: reduce)").matches)d.dataset.homeLoaded="";if(p||sessionStorage.getItem("realm:intro")||matchMedia("(prefers-reduced-motion: reduce)").matches)d.dataset.intro="skip"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${atkinson.variable} ${funnel.variable}`}
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
