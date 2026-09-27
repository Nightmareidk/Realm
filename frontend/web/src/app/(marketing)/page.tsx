import { buildStarChart } from "@/features/landing/map/star-chart";
import { ClosingSection } from "@/features/landing/sections/closing";
import { EditionsSection } from "@/features/landing/sections/editions";
import { Hero } from "@/features/landing/sections/hero";
import { MapSection } from "@/features/landing/sections/map-section";
import { StickerMarquee } from "@/features/landing/sections/marquee";
import { PrivacySection } from "@/features/landing/sections/privacy";
import {
  BoardsSection,
  FeedSection,
  ProfilesSection,
  SpacesSection,
} from "@/features/landing/sections/regions";
import { ShowcaseSection } from "@/features/landing/sections/showcase";
import { getReleases } from "@/lib/releases";

export default async function LandingPage() {
  const chart = buildStarChart();
  const releases = await getReleases();
  return (
    <>
      <Hero />
      <StickerMarquee />
      <ShowcaseSection />
      <MapSection chart={chart} />
      <SpacesSection chart={chart} />
      <FeedSection chart={chart} />
      <ProfilesSection chart={chart} />
      <BoardsSection chart={chart} />
      <PrivacySection />
      <EditionsSection releases={releases} />
      <ClosingSection />
    </>
  );
}
