import Image from "next/image";
import { Avatar } from "@/components/avatar";
import { cx } from "@/lib/cx";
import { profile } from "../demo";
import { PreviewFrame } from "./preview-frame";

const nf = new Intl.NumberFormat("en");

export function ProfilePreview({ variant = "full" }: { variant?: "full" | "compact" }) {
  const compact = variant === "compact";
  const { person } = profile;
  return (
    <PreviewFrame label="A profile with posts, media and Spaces" caption={!compact}>
      <div className={cx("relative bg-land", compact ? "h-20" : "h-32")}>
        <Image
          src={profile.banner}
          alt=""
          fill
          sizes="(min-width: 1024px) 560px, 90vw"
          className="object-cover"
        />
      </div>
      <div className="px-5 pb-5">
        <div className="-mt-9 flex items-end justify-between gap-3">
          <Avatar
            name={person.name}
            ink={person.ink}
            src={person.avatar}
            size={compact ? "lg" : "xl"}
            className="rounded-full ring-4 ring-panel"
          />
          <span className="mb-1 rounded-md border border-rule-strong px-3 py-1.5 text-xs font-semibold text-ink">
            Follow
          </span>
        </div>
        <h3 className="stretch-semi-expanded mt-3 text-lg font-bold text-ink">{person.name}</h3>
        <p className="text-sm text-ink-muted">
          @{person.handle} <span aria-hidden="true">·</span> {profile.pronouns}
        </p>
        <p className="mt-2 text-sm text-ink-soft">{profile.bio}</p>
        <dl className="mt-3 flex gap-5 text-sm">
          {[
            ["Followers", profile.followers],
            ["Following", profile.following],
            ["Spaces", profile.spaces],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-baseline gap-1.5">
              <dt className="order-2 text-ink-muted">{label}</dt>
              <dd className="tabular font-semibold text-ink">{nf.format(value as number)}</dd>
            </div>
          ))}
        </dl>
        {!compact && (
          <>
            <div className="mt-4 flex gap-5 border-b border-rule text-sm">
              <span className="border-b-2 border-ink pb-2 font-semibold text-ink">Media</span>
              <span className="pb-2 text-ink-muted">Posts</span>
              <span className="pb-2 text-ink-muted">Spaces</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {profile.media.map((src) => (
                <div
                  key={src}
                  className="relative aspect-square overflow-hidden rounded-sm bg-land"
                >
                  <Image src={src} alt="" fill sizes="160px" className="object-cover" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PreviewFrame>
  );
}
