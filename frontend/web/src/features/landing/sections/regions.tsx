import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { AvailabilityKey, FeatureList } from "@/components/availability";
import { cx } from "@/lib/cx";
import type { RegionId, StarChart } from "../map/star-chart";
import { BoardPreview } from "../previews/board-preview";
import { FeedPreview } from "../previews/feed-preview";
import { ProfilePreview } from "../previews/profile-preview";
import { SpacesPreview } from "../previews/spaces-preview";
import { RegionHeading } from "./region-heading";
import styles from "./worlds.module.css";

/** Orbit rings sweeping out of the corner where the world's planet sits. */
function Rings({ region, x, y }: { region: RegionId; x: number; y: number }) {
  const cx0 = x * 1000;
  const cy0 = y * 700;
  return (
    <svg
      viewBox="0 0 1000 700"
      preserveAspectRatio="xMidYMid slice"
      className={styles.rings}
      aria-hidden="true"
      data-fx="spin"
      data-turn="10"
      data-origin={`${x * 100}% ${y * 100}%`}
    >
      <g fill="none" stroke={`var(--r-${region}-line)`} transform={`rotate(-14 ${cx0} ${cy0})`}>
        {[240, 390, 560, 760].map((rx, i) => (
          <ellipse
            key={rx}
            cx={cx0}
            cy={cy0}
            rx={rx}
            ry={rx * 0.42}
            strokeWidth="1.3"
            opacity={0.34 - i * 0.07}
            strokeDasharray={i === 1 ? "3 9" : undefined}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * One world's card: lit from one bottom corner by its planet (a real render, inside its orbit
 * rings), the copy on one side and the product on the other.
 */
function World({
  region,
  n,
  flip = false,
  copy,
  preview,
}: {
  region: RegionId;
  n: number;
  /** Put the product on the left and the copy on the right. */
  flip?: boolean;
  copy: ReactNode;
  preview: ReactNode;
}) {
  // The planet and its light sit in the bottom corner on the copy's side.
  const px = flip ? 1 : 0;
  return (
    <section
      id={region}
      aria-labelledby={`${region}-title`}
      data-card=""
      className={cx(styles.world, "scroll-mt-24")}
      style={{ "--n": n } as CSSProperties}
    >
      <div
        data-surface=""
        data-spotlight=""
        className={cx(styles.card, "surface")}
        style={{
          background: `radial-gradient(75% 90% at ${px * 100}% 100%, color-mix(in oklch, var(--r-${region}-solid) 26%, transparent), transparent 62%), radial-gradient(50% 60% at ${(1 - px) * 100}% 0%, color-mix(in oklch, var(--r-${region}-solid) 9%, transparent), transparent 70%), linear-gradient(180deg, color-mix(in oklch, var(--r-panel-raised) 94%, transparent), color-mix(in oklch, var(--r-panel) 94%, transparent))`,
        }}
      >
        <Rings region={region} x={px} y={1} />
        <div
          data-fx="parallax"
          data-speed="0.35"
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute -z-1 max-lg:hidden",
            flip ? "-right-24 -bottom-24" : "-bottom-24 -left-24",
          )}
        >
          <Image
            src={`/art/planet-${region}.webp`}
            alt=""
            width={256}
            height={256}
            className={styles.planet}
          />
        </div>
        <div
          className={cx(
            "grid grid-cols-1 items-center gap-10 p-6 md:p-10 lg:grid-cols-12 lg:gap-12 lg:p-12",
          )}
        >
          <div data-fx="stagger" className={cx("lg:col-span-5", flip && "lg:order-2")}>
            {copy}
          </div>
          <div
            data-fx="rise"
            data-delay="0.15"
            className={cx("relative min-w-0 lg:col-span-7", flip && "lg:order-1")}
          >
            {preview}
          </div>
        </div>
        <div data-dim="" aria-hidden="true" className={styles.dim} />
      </div>
    </section>
  );
}

function Heading({
  chart,
  region,
  title,
  children,
}: {
  chart: StarChart;
  region: RegionId;
  title: string;
  children: ReactNode;
}) {
  return (
    <RegionHeading chart={chart} region={region} id={`${region}-title`} title={title}>
      {children}
    </RegionHeading>
  );
}

const CALLOUTS = [
  { title: "One handle everywhere", body: "The same name in chat, on posts, and in every Space." },
  {
    title: "Friends and followers",
    body: "Friends for chat and presence. Follows for posts and clips.",
  },
  {
    title: "You decide who sees what",
    body: "Private profiles, who can message you, and read receipts.",
  },
];

/** Spaces, the Feed, Profiles and Boards: four cards that stack up as you scroll. */
export function WorldsSection({ chart }: { chart: StarChart }) {
  return (
    <div className="mx-auto max-w-[80rem] px-4 md:px-8">
      <div data-fx="deck" className={styles.deck}>
        <World
          region="spaces"
          n={0}
          copy={
            <>
              <Heading chart={chart} region="spaces" title="Spaces are where your group lives.">
                Rooms for every topic, boards for longer threads, and roles that decide who can do
                what. Open it and see who&apos;s around and what they&apos;re up to.
              </Heading>
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
            </>
          }
          preview={<SpacesPreview appClassName="h-[30rem] xl:h-[32rem]" />}
        />
        <World
          region="feed"
          n={1}
          flip
          copy={
            <>
              <Heading chart={chart} region="feed" title="A feed of people you chose.">
                Posts and clips from friends, creators you follow and your Spaces. The Following tab
                stays in order, newest first.
              </Heading>
              <FeatureList
                className="mt-8"
                items={[
                  { label: "Text and image posts", status: "now" },
                  { label: "Comments, likes and saves", status: "now" },
                  { label: "Clips: short vertical video", status: "soon" },
                ]}
              />
            </>
          }
          preview={<FeedPreview />}
        />
        <World
          region="profiles"
          n={2}
          copy={
            <>
              <Heading chart={chart} region="profiles" title="One profile across all of it.">
                Your posts, media and Spaces in one place, with privacy settings that stay in your
                hands.
              </Heading>
              <ul className="mt-8 grid gap-4">
                {CALLOUTS.map((c) => (
                  <li key={c.title} className="border-t border-rule pt-4 first:border-0 first:pt-0">
                    <p className="font-semibold text-ink">{c.title}</p>
                    <p className="mt-0.5 text-[0.95rem] text-ink-soft">{c.body}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-ink-muted">
                Profiles, friends and privacy controls are available now.
              </p>
            </>
          }
          preview={
            <div className="mx-auto max-w-[27rem]">
              <ProfilePreview />
            </div>
          }
        />
        <World
          region="boards"
          n={3}
          flip
          copy={
            <>
              <Heading chart={chart} region="boards" title="Discussions that don't scroll away.">
                Board rooms give every Space threaded posts with nested replies and votes, so good
                answers stay findable.
              </Heading>
              <FeatureList
                className="mt-8"
                items={[
                  { label: "Threaded posts with nested replies", status: "now" },
                  { label: "Votes, saves and sorting", status: "now" },
                  { label: "Search across boards", status: "soon" },
                ]}
              />
            </>
          }
          preview={<BoardPreview />}
        />
      </div>
    </div>
  );
}
