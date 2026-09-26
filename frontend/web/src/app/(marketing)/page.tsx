import { buildMapGeometry } from "@/features/landing/map/geometry";
import { ClosingSection } from "@/features/landing/sections/closing";
import { EditionsSection } from "@/features/landing/sections/editions";
import { Hero } from "@/features/landing/sections/hero";
import { MapSection } from "@/features/landing/sections/map-section";
import { PrivacySection } from "@/features/landing/sections/privacy";
import {
  BoardsSection,
  FeedSection,
  ProfilesSection,
  SpacesSection,
} from "@/features/landing/sections/regions";
import { getReleases } from "@/lib/releases";

export default async function LandingPage() {
  const geometry = buildMapGeometry();
  const releases = await getReleases();
  return (
    <>
      <Hero />
      <MapSection geometry={geometry} />
      <SpacesSection geometry={geometry} />
      <FeedSection geometry={geometry} />
      <ProfilesSection geometry={geometry} />
      <BoardsSection geometry={geometry} />
      <PrivacySection />
      <EditionsSection releases={releases} />
      <ClosingSection />
    </>
  );
}
