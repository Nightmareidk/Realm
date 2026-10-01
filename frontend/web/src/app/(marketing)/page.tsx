import type { Metadata } from "next";
import { Intro } from "@/features/landing/intro/intro";
import { buildStarChart } from "@/features/landing/map/star-chart";
import { ScrollFX } from "@/features/landing/scroll-fx";
import { ClosingSection } from "@/features/landing/sections/closing";
import { EditionsSection } from "@/features/landing/sections/editions";
import { Hero } from "@/features/landing/sections/hero";
import { MapSection } from "@/features/landing/sections/map-section";
import { StickerMarquee } from "@/features/landing/sections/marquee";
import { PrivacySection } from "@/features/landing/sections/privacy";
import { WorldsSection } from "@/features/landing/sections/regions";
import { ShowcaseSection } from "@/features/landing/sections/showcase";
import { StatementSection } from "@/features/landing/sections/statement";
import { SkyLife } from "@/features/landing/sky-life";
import { getReleases } from "@/lib/releases";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * Structured data for search engines: the site, the organisation behind it, and the app itself
 * (free, in the browser). Nothing here claims ratings, users or reviews that don't exist.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.origin}/#org`,
      name: "Realm",
      url: SITE.origin,
      logo: `${SITE.origin}/icon.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.origin}/#website`,
      name: "Realm",
      url: SITE.origin,
      description: SITE.description,
      publisher: { "@id": `${SITE.origin}/#org` },
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      name: "Realm",
      url: SITE.origin,
      description: SITE.description,
      applicationCategory: "SocialNetworkingApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires a modern web browser with JavaScript.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE.origin}/#org` },
    },
  ],
};

export default async function LandingPage() {
  const chart = buildStarChart();
  const releases = await getReleases();
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party structured data, with "<" escaped.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
      <Intro />
      <Hero />
      <SkyLife />
      <StickerMarquee />
      <StatementSection />
      <ShowcaseSection />
      <MapSection chart={chart} />
      <WorldsSection chart={chart} />
      <PrivacySection />
      <EditionsSection releases={releases} />
      <ClosingSection />
      <ScrollFX />
    </>
  );
}
