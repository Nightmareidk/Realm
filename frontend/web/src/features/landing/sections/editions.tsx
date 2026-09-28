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
import { Explorer } from "../art";

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
      <span className="flex size-11 items-center justify-center rounded-2xl border border-rule bg-panel-raised text-ink">
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
          className="inline-flex h-10 items-center gap-2 rounded-full border border-rule-strong px-4 text-sm font-semibold text-ink hover:bg-panel"
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
          className="inline-flex h-14 items-center gap-3 rounded-2xl border border-rule-strong bg-panel px-4 text-ink hover:border-ink-soft"
        >
          {body}
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex h-14 items-center gap-3 rounded-2xl border border-dashed border-rule-strong px-4 text-ink-soft"
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
      <div className="mx-auto max-w-[80rem] px-4 py-24 md:px-8 lg:py-32">
        <Heading
          id="download-title"
          className="display max-w-[18ch] text-[clamp(2.4rem,4.2vw,4rem)] text-ink"
        >
          The same Realm on every screen.
        </Heading>
        <p className="lead mt-6 max-w-[50ch]">
          Use it in your browser today. Desktop and phone apps are on the way, and they will appear
          here the moment they are ready.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div
            className="surface reveal relative isolate flex min-h-[22rem] flex-col justify-between gap-10 overflow-clip p-7 md:p-10 lg:col-span-7 lg:row-span-2"
            style={{
              background:
                "radial-gradient(80% 90% at 0% 0%, color-mix(in oklch, var(--r-spaces-solid) 24%, transparent), transparent 62%), radial-gradient(60% 70% at 100% 100%, color-mix(in oklch, var(--r-profiles-solid) 20%, transparent), transparent 65%), linear-gradient(180deg, color-mix(in oklch, var(--r-panel-raised) 94%, transparent), color-mix(in oklch, var(--r-panel) 94%, transparent))",
            }}
          >
            <div>
              <RealmLogo size={64} />
              <p className="display mt-6 text-[clamp(1.9rem,2.6vw,2.6rem)] text-ink">
                Realm in your browser
              </p>
              <p className="lead mt-2">Available now. Nothing to install.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink href="/signup" size="lg">
                Open Realm
              </ButtonLink>
              <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
                <Road status="now" /> Available now
              </span>
            </div>
            <div
              aria-hidden="true"
              className="absolute right-6 -bottom-6 flex items-end gap-1 max-sm:hidden md:right-10"
            >
              <Explorer who="alien-meshy" waving delay={0.4} className="w-20 md:w-24" />
              <Explorer who="human-leo" waving delay={1.3} className="w-14 md:w-16" />
            </div>
          </div>

          <div className="surface reveal p-7 md:p-9 lg:col-span-5">
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
          </div>
          <div className="surface reveal p-7 md:p-9 lg:col-span-5">
            <div>
              <p className="text-sm font-semibold text-ink">Phone and tablet</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
