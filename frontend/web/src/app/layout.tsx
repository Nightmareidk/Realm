import type { Metadata, Viewport } from "next";
import {
  Atkinson_Hyperlegible_Next,
  Bangers,
  Bebas_Neue,
  Bricolage_Grotesque,
  Comfortaa,
  Fredoka,
  Funnel_Display,
  Lexend,
  Nunito,
  Orbitron,
  Pacifico,
  Permanent_Marker,
  Press_Start_2P,
  Righteous,
} from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";
import { themeBootScript } from "@/features/themes/engine";

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

/**
 * Fonts a theme may pick (docs/THEMING.md). Served by Realm like the others, never preloaded: a
 * browser only downloads one when the theme in use asks for it.
 */
const bangers = Bangers({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bangers",
  display: "swap",
  preload: false,
});
const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  display: "swap",
  preload: false,
});
const pacifico = Pacifico({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pacifico",
  display: "swap",
  preload: false,
});
const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start",
  display: "swap",
  preload: false,
});
const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
  display: "swap",
  preload: false,
});
const righteous = Righteous({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-righteous",
  display: "swap",
  preload: false,
});
const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
  preload: false,
});
const marker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-permanent-marker",
  display: "swap",
  preload: false,
});
const comfortaa = Comfortaa({
  subsets: ["latin"],
  variable: "--font-comfortaa",
  display: "swap",
  preload: false,
});
const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
  preload: false,
});
const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
  preload: false,
});
const themeFonts = [
  bangers,
  fredoka,
  pacifico,
  pressStart,
  bebas,
  righteous,
  orbitron,
  marker,
  comfortaa,
  lexend,
  nunito,
]
  .map((f) => f.variable)
  .join(" ");

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
      className={`${bricolage.variable} ${atkinson.variable} ${funnel.variable} ${themeFonts}`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party preferences bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: bootScript + themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
