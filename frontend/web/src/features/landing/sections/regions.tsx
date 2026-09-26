import { AvailabilityKey, FeatureList } from "@/components/availability";
import type { MapGeometry } from "../map/geometry";
import { BoardPreview } from "../previews/board-preview";
import { FeedPreview } from "../previews/feed-preview";
import { ProfilePreview } from "../previews/profile-preview";
import { SpacesPreview } from "../previews/spaces-preview";
import { RegionHeading } from "./region-heading";
import { Stage } from "./stage";

const shell = "mx-auto max-w-[90rem] px-4 md:px-8";

/** Spaces: a mint-lit stage, copy inside on the left, the app on the right. */
export function SpacesSection({ geometry }: { geometry: MapGeometry }) {
  return (
    <section id="spaces" aria-labelledby="spaces-title" className="scroll-mt-20 py-12 lg:py-16">
      <div className={shell}>
        <Stage tone="spaces" geometry={geometry} glow="10% 100%">
          <div className="grid grid-cols-1 gap-12 p-7 md:p-12 lg:grid-cols-12 lg:gap-10 lg:p-16">
            <div className="lg:col-span-5">
              <RegionHeading
                geometry={geometry}
                region="spaces"
                id="spaces-title"
                title="Spaces are where your group lives."
              >
                Text channels for every topic, boards for longer threads, and roles that decide who
                can do what.
              </RegionHeading>
              <FeatureList
                className="mt-8"
                items={[
                  { label: "Text channels and categories", status: "now" },
                  { label: "Roles, permissions and invites", status: "now" },
                  { label: "Moderation and audit log", status: "now" },
                  { label: "Voice rooms and screen share", status: "soon" },
                ]}
              />
              <AvailabilityKey className="mt-6" />
            </div>
            <div className="min-w-0 lg:col-span-7 lg:pt-2">
              <SpacesPreview />
            </div>
          </div>
        </Stage>
      </div>
    </section>
  );
}

/** Feed: an amber-lit stage, the feed leads on the left. */
export function FeedSection({ geometry }: { geometry: MapGeometry }) {
  return (
    <section id="feed" aria-labelledby="feed-title" className="scroll-mt-20 py-12 lg:py-16">
      <div className={shell}>
        <Stage tone="feed" geometry={geometry} glow="95% 0%">
          <div className="grid grid-cols-1 items-center gap-12 p-7 md:p-12 lg:grid-cols-12 lg:gap-16 lg:p-16">
            <div className="order-2 min-w-0 lg:order-1 lg:col-span-7">
              <FeedPreview />
            </div>
            <div className="order-1 lg:order-2 lg:col-span-5">
              <RegionHeading
                geometry={geometry}
                region="feed"
                id="feed-title"
                title="A feed of people you chose."
              >
                Posts and clips from friends, creators you follow and your Spaces. The Following tab
                stays in order, newest first.
              </RegionHeading>
              <FeatureList
                className="mt-8"
                items={[
                  { label: "Text and image posts", status: "now" },
                  { label: "Comments, likes and saves", status: "now" },
                  { label: "Clips: short vertical video", status: "soon" },
                ]}
              />
            </div>
          </div>
        </Stage>
      </div>
    </section>
  );
}

/** Profiles: open composition (no stage), an annotated specimen like a map figure. */
export function ProfilesSection({ geometry }: { geometry: MapGeometry }) {
  const callouts = [
    {
      title: "One handle everywhere",
      body: "The same name in chat, on posts, and in every Space.",
    },
    {
      title: "Friends and followers",
      body: "Friends for chat and presence. Follows for posts and clips.",
    },
    {
      title: "You decide who sees what",
      body: "Private profiles, who can message you, and read receipts.",
    },
  ];
  return (
    <section id="profiles" aria-labelledby="profiles-title" className="scroll-mt-20 py-20 lg:py-28">
      <div className={shell}>
        <div className="mx-auto max-w-[44rem] text-center [&_p]:mx-auto [&>div>div:first-child]:justify-center">
          <RegionHeading
            geometry={geometry}
            region="profiles"
            id="profiles-title"
            title="One profile across all of it."
          >
            Your posts, media and Spaces in one place, with privacy settings that stay in your
            hands.
          </RegionHeading>
        </div>
        <div className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_minmax(0,30rem)_1fr] lg:gap-12">
          <ol className="grid gap-8 lg:order-1 lg:text-right">
            {callouts.slice(0, 2).map((c) => (
              <Callout key={c.title} {...c} side="left" />
            ))}
          </ol>
          <div className="reveal min-w-0 lg:order-2">
            <ProfilePreview />
          </div>
          <ol className="grid gap-8 lg:order-3">
            {callouts.slice(2).map((c) => (
              <Callout key={c.title} {...c} side="right" />
            ))}
            <li className="text-sm text-ink-muted">
              Profiles, friends and privacy controls are available now.
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function Callout({ title, body, side }: { title: string; body: string; side: "left" | "right" }) {
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className={`absolute top-3 hidden h-px w-10 bg-profiles-line lg:block ${side === "left" ? "-right-12" : "-left-12"}`}
      />
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[0.95rem] text-ink-soft">{body}</p>
    </li>
  );
}

/** Boards: a coral-lit stage with a reading column, because boards are for reading. */
export function BoardsSection({ geometry }: { geometry: MapGeometry }) {
  return (
    <section id="boards" aria-labelledby="boards-title" className="scroll-mt-20 py-12 lg:py-16">
      <div className={shell}>
        <Stage tone="boards" geometry={geometry} glow="0% 0%">
          <div className="grid grid-cols-1 gap-12 p-7 md:p-12 lg:grid-cols-12 lg:gap-10 lg:p-16">
            <div className="lg:col-span-5">
              <RegionHeading
                geometry={geometry}
                region="boards"
                id="boards-title"
                title="Discussions that don't scroll away."
              >
                Board channels give every Space threaded posts with nested replies and votes, so
                good answers stay findable.
              </RegionHeading>
              <FeatureList
                className="mt-8"
                items={[
                  { label: "Threaded posts with nested replies", status: "now" },
                  { label: "Votes, saves and sorting", status: "now" },
                  { label: "Search across boards", status: "soon" },
                ]}
              />
            </div>
            <div className="min-w-0 lg:col-span-6 lg:col-start-7">
              <BoardPreview />
            </div>
          </div>
        </Stage>
      </div>
    </section>
  );
}
