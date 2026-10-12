import type { Metadata } from "next";
import { HomeMotion } from "@/features/home/home-motion";
import { Loader } from "@/features/home/loader";
import { ProfileCanvas } from "@/features/home/profile/profile-canvas";
import { ClosingSection, PlatformsSection, PrivacySection } from "@/features/home/sections";
import { Tour } from "@/features/home/tour/tour";
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

export default async function HomePage() {
  const releases = await getReleases();
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party structured data, with "<" escaped.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
      <Loader />
      <Tour />
      <ProfileCanvas />
      <PrivacySection />
      <PlatformsSection releases={releases} />
      <ClosingSection />
      <HomeMotion />
    </>
  );
}
