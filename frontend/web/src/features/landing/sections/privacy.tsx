import {
  ChatCircleDots,
  Check,
  Checks,
  Devices,
  EyeSlash,
  GlobeHemisphereWest,
  Info,
  LockKey,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { ComponentType, ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "../fun.module.css";
import { Words } from "../words";

const E2EE = [
  "Direct messages",
  "Group chats up to 100 people",
  "Photos and files shared in them",
  "Small voice and video calls, later on",
];

const PROTECTED = ["Public Spaces and their rooms", "Posts, comments and the feed", "Profiles"];

type Icon = ComponentType<{ size?: number; weight?: "regular" | "bold" | "duotone" | "fill" }>;

const CONTROLS: { label: string; Icon: Icon }[] = [
  { label: "Choose who can message you", Icon: ChatCircleDots },
  { label: "Make your profile private", Icon: EyeSlash },
  { label: "See every signed-in device and sign any of them out", Icon: Devices },
  { label: "Turn read receipts off", Icon: Checks },
];

function Card({
  Icon,
  title,
  tone,
  children,
  className,
}: {
  Icon: Icon;
  title: string;
  /** The icon tile's colour: the action colour marks the stronger promise. */
  tone: "action" | "plain";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-spotlight="" className={cx("surface p-7 md:p-9", className)}>
      <p className="flex items-center gap-3.5 text-lg font-semibold text-ink">
        <span
          className={cx(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            tone === "action"
              ? "bg-overprint-fill text-on-overprint shadow-[inset_0_1px_0_oklch(1_0_0/0.35)]"
              : "border border-rule bg-panel-raised text-ink-soft",
          )}
        >
          <Icon size={22} weight="duotone" />
        </span>
        {title}
      </p>
      {children}
    </div>
  );
}

/** How each part of Realm is protected, said plainly. A pinned statement beside the detail. */
export function PrivacySection() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-24 py-24 lg:py-36">
      <div className="mx-auto grid max-w-[80rem] grid-cols-1 gap-12 px-4 md:px-8 lg:grid-cols-12 lg:gap-16">
        <div className="self-start lg:sticky lg:top-28 lg:col-span-5">
          <div data-fx="spin" aria-hidden="true" className="w-20 md:w-24">
            <span data-fx="pop" className="block">
              <span className={cx(styles.floatA, "block")}>
                <Image
                  src="/art/lock.webp"
                  alt=""
                  width={240}
                  height={340}
                  className="h-auto w-full"
                />
              </span>
            </span>
          </div>
          <h2
            id="privacy-title"
            data-fx="words"
            className="display mt-8 text-[clamp(2.4rem,4.2vw,4rem)] text-ink"
          >
            <Words>Private where it counts. Honest about the rest.</Words>
          </h2>
          <p data-fx="fade" className="lead mt-6 max-w-[42ch]">
            Realm tells you exactly how each part of the app is protected, and never calls something
            end-to-end encrypted unless it is.
          </p>
          <p
            data-fx="fade"
            data-delay="0.3"
            className="mt-8 flex max-w-[46ch] items-start gap-3 text-[0.95rem] text-ink"
          >
            <Info size={20} weight="duotone" className="mt-0.5 shrink-0 text-overprint" />
            <span>
              During early access, direct messages are not end-to-end encrypted yet. Realm says so
              inside every conversation until they are.
            </span>
          </p>
        </div>

        <div data-fx="stagger" data-from="right" className="grid gap-5 lg:col-span-7">
          <Card Icon={LockKey} tone="action" title="End-to-end encrypted, before public launch">
            <ul className="mt-6 grid gap-3 text-ink-soft sm:grid-cols-2">
              {E2EE.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check size={18} weight="bold" className="mt-0.5 shrink-0 text-overprint" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-[52ch] text-sm text-ink-muted">
              Built on MLS, the IETF standard for secure group messaging. Only the people in the
              conversation hold the keys, not Realm.
            </p>
          </Card>

          <Card Icon={GlobeHemisphereWest} tone="plain" title="Protected, not end-to-end encrypted">
            <ul className="mt-6 grid gap-3 text-ink-soft sm:grid-cols-2">
              {PROTECTED.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check size={18} weight="bold" className="mt-0.5 shrink-0 text-ink-muted" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-[52ch] text-sm text-ink-muted">
              Encrypted in transit and at rest. Realm can read these so they can be moderated,
              searched, and shown to people who join later.
            </p>
          </Card>

          <div id="security" data-spotlight="" className="surface scroll-mt-28 p-7 md:p-9">
            <h3 className="text-lg font-semibold text-ink">Your controls</h3>
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CONTROLS.map(({ label, Icon }) => (
                <li key={label} className="flex items-start gap-3 text-ink-soft">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-rule bg-panel-raised text-ink">
                    <Icon size={18} weight="duotone" />
                  </span>
                  <span className="pt-1.5">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
