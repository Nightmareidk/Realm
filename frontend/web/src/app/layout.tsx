import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.REALM_WEB_ORIGIN ?? "http://localhost:3000"),
  title: {
    default: "Realm: four apps, one Realm",
    template: "%s | Realm",
  },
  description:
    "Group chat, Spaces, a feed, profiles and discussion boards in one place. Early access is open in your browser.",
  applicationName: "Realm",
};

export const viewport: Viewport = {
  themeColor: "#0a2129",
  colorScheme: "dark light",
};

/**
 * Dark is the default. A person who picked the day edition gets it before first paint
 * (no flash); the choice lives in localStorage until accounts sync it from settings.
 */
const themeScript = `try{var t=localStorage.getItem("realm:theme");if(t==="day"||t==="night")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={archivo.variable} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
