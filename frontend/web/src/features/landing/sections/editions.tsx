import {
  AndroidLogo,
  AppleLogo,
  AppStoreLogo,
  DownloadSimple,
  GooglePlayLogo,
  LinuxLogo,
  WindowsLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { Release, ReleasePlatform } from "@realm/contracts";
import type { ComponentType } from "react";
import { Road } from "@/components/availability";
import { ButtonLink } from "@/components/button";
import { RealmLogo } from "@/components/wordmark";
import { cx } from "@/lib/cx";

type IconType = ComponentType<{ size?: number; weight?: "regular" | "fill" | "duotone" }>;

const DESKTOP: { platform: ReleasePlatform; name: string; Icon: IconType }[] = [
  { platform: "windows", name: "Windows", Icon: WindowsLogo },
  { platform: "macos", name: "macOS", Icon: AppleLogo },
  { platform: "linux", name: "Linux", Icon: LinuxLogo },
];

function formatSize(bytes: number | null) {
  return bytes ? `${Math.round(bytes / 1_000_000)} MB` : null;
}

function DesktopRow({ release, name, Icon }: { release: Release; name: string; Icon: IconType }) {
  const available = release.status === "available" && release.url;
  return (
    <li className="flex items-center gap-4 border-t border-rule py-4 first:border-t-0">
      <span className="flex size-10 items-center justify-center rounded-md border border-rule text-ink">
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{name}</p>
        <p className="tabular text-sm text-ink-muted">
          {available
            ? [release.version && `Version ${release.version}`, formatSize(release.sizeBytes)]
                .filter(Boolean)
                .join(", ")
            : "Desktop app"}
        </p>
      </div>
      {available ? (
        <a
          href={release.url ?? undefined}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-rule-strong px-4 text-sm font-semibold text-ink hover:bg-panel"
        >
          <DownloadSimple size={16} /> Download
        </a>
      ) : (
        <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
          <Road status="soon" /> Coming soon
        </span>
      )}
    </li>
  );
}

/**
 * Store buttons in Realm's own style. Swap to the official Google Play / App Store badges
 * (per each store's brand guidelines) once the listings are live.
 */
function StoreButton({
  release,
  kicker,
  store,
  Icon,
}: {
  release: Release;
  kicker: string;
  store: string;
  Icon: IconType;
}) {
  const available = release.status === "available" && release.url;
  const body = (
    <>
      <Icon size={26} weight="fill" />
      <span className="flex flex-col leading-tight">
        <span className="text-[0.68rem] uppercase tracking-[0.08em] text-ink-muted">{kicker}</span>
        <span className="stretch-semi-expanded text-base font-bold">{store}</span>
      </span>
    </>
  );
  return (
    <div className="flex flex-col gap-2">
      {available ? (
        <a
          href={release.url ?? undefined}
          className="inline-flex h-14 items-center gap-3 rounded-md border border-rule-strong bg-panel px-4 text-ink hover:border-ink-soft"
        >
          {body}
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex h-14 items-center gap-3 rounded-md border border-dashed border-rule-strong px-4 text-ink-soft"
        >
          {body}
        </span>
      )}
      {!available && (
        <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
          <Road status="soon" /> Coming soon
        </span>
      )}
    </div>
  );
}

export function EditionsSection({
  releases,
  headingLevel = "h2",
}: {
  releases: Release[];
  headingLevel?: "h1" | "h2";
}) {
  const by = (p: ReleasePlatform) => releases.find((r) => r.platform === p) as Release;
  const Heading = headingLevel;
  return (
    <section id="download" aria-labelledby="download-title" className="scroll-mt-20">
      <div className="mx-auto max-w-[90rem] px-4 py-20 md:px-8 lg:py-28">
        <Heading
          id="download-title"
          className="display-caps max-w-[22ch] text-[clamp(1.9rem,3.2vw,3rem)] text-ink"
        >
          The same Realm on every screen.
        </Heading>
        <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-ink-soft">
          Use it in your browser today. Desktop and phone apps are on the way, and they will appear
          here the moment they are ready.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div
            className="relative isolate flex flex-col justify-between gap-10 overflow-hidden rounded-xl border border-rule p-7 md:p-9 lg:col-span-5"
            style={{
              background:
                "radial-gradient(90% 80% at 0% 0%, color-mix(in oklch, var(--r-overprint-fill) 32%, transparent), transparent 65%), var(--r-panel)",
            }}
          >
            <div>
              <RealmLogo
                size={56}
                className="drop-shadow-[0_10px_30px_color-mix(in_oklch,var(--r-overprint-fill)_60%,transparent)]"
              />
              <p className="stretch-semi-expanded mt-5 text-2xl font-bold text-ink">
                Realm in your browser
              </p>
              <p className="mt-2 text-ink-soft">Available now. Nothing to install.</p>
            </div>
            <div className="flex items-center gap-4">
              <ButtonLink href="/signup" size="lg">
                Open Realm
              </ButtonLink>
              <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
                <Road status="now" /> Available now
              </span>
            </div>
          </div>

          <div
            className={cx(
              "grid grid-cols-1 gap-8 rounded-xl border border-rule bg-panel/60 p-7 md:p-9 lg:col-span-7",
              "md:grid-cols-2",
            )}
          >
            <div>
              <p className="text-sm font-semibold text-ink">Desktop</p>
              <ul className="mt-2">
                {DESKTOP.map((d) => (
                  <DesktopRow
                    key={d.platform}
                    release={by(d.platform)}
                    name={d.name}
                    Icon={d.Icon}
                  />
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Phone and tablet</p>
              <div className="mt-4 grid gap-5">
                <StoreButton
                  release={by("android")}
                  kicker="Get it on"
                  store="Google Play"
                  Icon={GooglePlayLogo}
                />
                <StoreButton
                  release={by("ios")}
                  kicker="Download on the"
                  store="App Store"
                  Icon={AppStoreLogo}
                />
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-ink-muted">
                <AndroidLogo size={14} /> Android
                <AppleLogo size={14} className="ml-2" /> iPhone and iPad
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
