import { GlobeHemisphereWest, Info, LockKey } from "@phosphor-icons/react/dist/ssr";
import { Stage } from "./stage";

const E2EE = [
  "Direct messages",
  "Group chats up to 100 people",
  "Photos and files shared in them",
  "Small voice and video calls, later on",
];

const PROTECTED = ["Public Spaces and their channels", "Posts, comments and the feed", "Profiles"];

const CONTROLS = [
  "Choose who can message you",
  "Make your profile private",
  "See every signed-in device and sign any of them out",
  "Turn read receipts off",
];

export function PrivacySection() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-20 py-12 lg:py-16">
      <div className="mx-auto max-w-[90rem] px-4 md:px-8">
        <Stage tone="realm" glow="50% 0%">
          <div className="p-7 md:p-12 lg:p-16">
            <div className="mx-auto max-w-[46rem] text-center">
              <span className="mx-auto flex size-16 items-center justify-center rounded-xl border border-[color-mix(in_oklch,var(--r-overprint)_40%,transparent)] bg-[color-mix(in_oklch,var(--r-overprint-fill)_18%,transparent)] text-overprint">
                <LockKey size={30} weight="duotone" />
              </span>
              <h2
                id="privacy-title"
                className="display-caps mt-7 text-[clamp(1.9rem,3.2vw,3rem)] text-ink"
              >
                Private where it counts. Honest about the rest.
              </h2>
              <p className="mx-auto mt-5 max-w-[50ch] text-lg leading-relaxed text-ink-soft">
                Realm tells you exactly how each part of the app is protected, and never calls
                something end-to-end encrypted unless it is.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-rule bg-rule lg:grid-cols-2">
              <div className="bg-panel/90 p-7 md:p-9">
                <p className="flex items-center gap-2.5 font-semibold text-ink">
                  <LockKey size={20} weight="duotone" className="text-overprint" />
                  End-to-end encrypted, before public launch
                </p>
                <ul className="mt-5 grid gap-2.5 text-ink-soft">
                  {E2EE.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-6 max-w-[48ch] text-sm text-ink-muted">
                  Built on MLS, the IETF standard for secure group messaging. Only the people in the
                  conversation hold the keys, not Realm.
                </p>
              </div>
              <div className="bg-panel/90 p-7 md:p-9">
                <p className="flex items-center gap-2.5 font-semibold text-ink">
                  <GlobeHemisphereWest size={20} weight="duotone" className="text-ink-soft" />
                  Protected, not end-to-end encrypted
                </p>
                <ul className="mt-5 grid gap-2.5 text-ink-soft">
                  {PROTECTED.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-6 max-w-[48ch] text-sm text-ink-muted">
                  Encrypted in transit and at rest. Realm can read these so they can be moderated,
                  searched, and shown to people who join later.
                </p>
              </div>
            </div>

            <p className="mt-6 flex items-start gap-3 rounded-lg border border-rule-strong bg-panel/70 px-5 py-4 text-[0.95rem] text-ink">
              <Info size={20} className="mt-0.5 shrink-0 text-ink-soft" />
              <span>
                During early access, direct messages are not end-to-end encrypted yet. Realm says so
                inside every conversation until they are.
              </span>
            </p>

            <div id="security" className="mt-12 scroll-mt-24">
              <h3 className="font-semibold text-ink">Your controls</h3>
              <ul className="mt-4 grid grid-cols-1 gap-x-10 gap-y-3 text-ink-soft sm:grid-cols-2">
                {CONTROLS.map((c) => (
                  <li key={c} className="border-t border-rule pt-3">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Stage>
      </div>
    </section>
  );
}
