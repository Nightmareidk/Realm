import { AvailabilityKey, FeatureList } from "@/components/availability";
import { Art, Explorer } from "../art";
import type { StarChart } from "../map/star-chart";
import { BoardPreview } from "../previews/board-preview";
import { FeedPreview } from "../previews/feed-preview";
import { ProfilePreview } from "../previews/profile-preview";
import { SpacesPreview } from "../previews/spaces-preview";
import { RegionHeading } from "./region-heading";
import { Stage } from "./stage";

const shell = "mx-auto max-w-[90rem] px-4 md:px-8";

/** Spaces: a teal-lit stage, copy inside on the left, the app on the right. */
export function SpacesSection({ chart }: { chart: StarChart }) {
  return (
    <section id="spaces" aria-labelledby="spaces-title" className="scroll-mt-20 py-12 lg:py-16">
      <div className={`${shell} relative`}>
        <Explorer
          tone="teal"
          waving
          className="absolute -top-16 left-[42%] z-10 w-24 max-lg:right-10 max-lg:left-auto md:-top-20 md:w-32"
        />
        <Art
          name="bubble"
          motion="c"
          className="-top-10 right-8 z-10 w-16 max-lg:hidden md:right-16 md:w-24"
        />
        <Art
          name="heart"
          motion="b"
          delay={1.2}
          className="-bottom-6 right-1/3 z-10 w-14 max-md:hidden md:w-20"
        />
        <Stage tone="spaces" glow="10% 100%">
          <div className="grid grid-cols-1 gap-12 p-7 pt-16 md:p-12 md:pt-20 lg:grid-cols-12 lg:gap-10 lg:p-16 lg:pt-20">
            <div className="lg:col-span-5">
              <RegionHeading
                chart={chart}
                region="spaces"
                id="spaces-title"
                title="Spaces are where your group lives."
              >
                Rooms for every topic, boards for longer threads, and roles that decide who can do
                what. Open it and see who's around and what they're up to.
              </RegionHeading>
              <FeatureList
                className="mt-8"
                items={[
                  { label: "Text rooms and boards", status: "now" },
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

/** Feed: an ice-blue stage, the feed leads on the left. */
export function FeedSection({ chart }: { chart: StarChart }) {
  return (
    <section id="feed" aria-labelledby="feed-title" className="scroll-mt-20 py-12 lg:py-16">
      <div className={`${shell} relative`}>
        <Explorer
          tone="blue"
          delay={0.5}
          className="absolute -top-16 right-10 z-10 w-24 md:-top-20 md:w-32"
        />
        <Art name="play" motion="spin" className="-bottom-8 left-6 z-10 w-16 md:w-24" />
        <Art
          name="heart"
          motion="a"
          delay={0.6}
          className="-top-8 left-1/3 z-10 w-12 max-md:hidden md:w-16"
        />
        <Stage tone="feed" glow="95% 0%">
          <div className="grid grid-cols-1 items-center gap-12 p-7 md:p-12 lg:grid-cols-12 lg:gap-16 lg:p-16">
            <div className="order-2 min-w-0 lg:order-1 lg:col-span-7">
              <FeedPreview />
            </div>
            <div className="order-1 lg:order-2 lg:col-span-5">
              <RegionHeading
                chart={chart}
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

/** Profiles: open composition (no stage), an annotated specimen like a chart figure. */
export function ProfilesSection({ chart }: { chart: StarChart }) {
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
        <div className="mx-auto max-w-[44rem] text-center [&_p]:mx-auto [&_svg]:mx-auto">
          <RegionHeading
            chart={chart}
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
          <div className="reveal relative min-w-0 lg:order-2">
            <Explorer
              tone="violet"
              waving
              delay={0.3}
              className="absolute -right-24 bottom-16 z-10 w-28 max-lg:hidden"
            />
            <Art
              name="spark"
              motion="spin"
              className="-top-10 -right-2 z-10 w-14 md:-right-8 md:w-20"
            />
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

/** Boards: a pink-lit stage with a reading column, because boards are for reading. */
export function BoardsSection({ chart }: { chart: StarChart }) {
  return (
    <section id="boards" aria-labelledby="boards-title" className="scroll-mt-20 py-12 lg:py-16">
      <div className={`${shell} relative`}>
        <Explorer
          tone="pink"
          delay={1.1}
          className="absolute -top-28 right-8 z-10 w-24 md:-top-36 md:right-16 md:w-32"
        />
        <Art
          name="upvote"
          motion="c"
          className="-bottom-8 right-8 z-10 w-14 md:right-auto md:left-10 md:w-20"
        />
        <Stage tone="boards" glow="0% 0%">
          <div className="grid grid-cols-1 gap-12 p-7 md:p-12 lg:grid-cols-12 lg:gap-10 lg:p-16">
            <div className="lg:col-span-5">
              <RegionHeading
                chart={chart}
                region="boards"
                id="boards-title"
                title="Discussions that don't scroll away."
              >
                Board rooms give every Space threaded posts with nested replies and votes, so good
                answers stay findable.
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
