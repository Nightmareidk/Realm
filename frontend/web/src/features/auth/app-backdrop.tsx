import {
  ChatCircle,
  Compass,
  House,
  MagnifyingGlass,
  Rows,
  SquaresFour,
} from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "../home/chrome";

/**
 * Sign-in happens over the app itself: a still, dimmed sketch of Realm's frame (top bar,
 * sidebar, Spaces, who's here) behind the panel, so the first thing you see is where you're
 * going. Decorative only: hidden from assistive tech, not focusable, and dropped on small
 * screens where it would only push the form down. The Spaces and people named here are examples.
 */
const DESTINATIONS = [
  ["Home", House],
  ["Spaces", SquaresFour],
  ["Messages", ChatCircle],
  ["Feed", Rows],
  ["Explore", Compass],
] as const;

const SPACES = [
  "Late Night Lobby",
  "Clip club",
  "Sunday builds",
  "Lo-fi study hall",
  "Speedrun garage",
  "Board game table",
  "Photo walk",
  "Indie dev nights",
];

const PEOPLE = [
  ["Kenji", "cutting a clip"],
  ["Maya", "in a match"],
  ["Sam", "around for a chat"],
  ["Ines", "in Lo-fi study hall"],
  ["Theo", "in a match"],
] as const;

const LIGHTS = ["--r-light-1", "--r-light-2", "--r-light-3"];

export function AppBackdrop() {
  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none fixed inset-0 -z-[1] hidden select-none lg:block"
    >
      <div className="flex h-16 items-center gap-6 px-6">
        <Wordmark className="text-fg" />
        <div className="flex gap-2">
          {DESTINATIONS.map(([label, Icon], i) => (
            <span
              key={label}
              className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-[0.95rem] font-bold ${i === 4 ? "bg-fg/10 text-fg" : "text-fg-soft"}`}
            >
              <Icon size={17} />
              {label}
            </span>
          ))}
        </div>
        <span className="ml-auto flex h-10 w-80 items-center gap-2 rounded-full bg-base/70 px-4 text-fg-soft shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]">
          <MagnifyingGlass size={16} />
          Search or jump to…
        </span>
      </div>
      <div className="absolute inset-x-2.5 top-16 bottom-2.5 grid grid-cols-[15.75rem_1fr_18.75rem] gap-2.5">
        <div className="rounded-[1.25rem] bg-surface p-4">
          <span className="text-[0.8rem] font-bold text-fg-soft">Spaces</span>
          <div className="mt-2 space-y-1.5">
            {SPACES.slice(0, 5).map((name, i) => (
              <div
                key={name}
                className="flex h-10 items-center gap-2.5 px-2 text-[0.95rem] font-bold text-fg-soft"
              >
                <span
                  className="size-6.5 rounded-lg"
                  style={{ background: `var(${LIGHTS[i % 3]})` }}
                />
                {name}
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-[1.25rem] bg-surface p-6">
          <span className="font-display text-[2rem] font-extrabold tracking-[-0.035em] text-fg">
            Explore
          </span>
          <div className="mt-5 grid grid-cols-3 gap-3.5">
            {SPACES.map((name, i) => (
              <div key={name} className="overflow-hidden rounded-[1.1rem] bg-surface-sunken">
                <div
                  className="h-32"
                  style={{
                    background: `radial-gradient(100% 120% at 0% 0%, var(${LIGHTS[i % 3]}), transparent 65%), radial-gradient(100% 120% at 100% 100%, var(${LIGHTS[(i + 1) % 3]}), var(--r-surface-sunken) 80%)`,
                  }}
                />
                <div className="px-3.5 py-3 font-bold text-fg">{name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[1.25rem] bg-surface p-4">
          <span className="font-display text-[1.25rem] font-extrabold tracking-[-0.025em] text-fg">
            Here now
          </span>
          <div className="mt-3 space-y-3">
            {PEOPLE.map(([name, doing], i) => (
              <div key={name} className="flex items-center gap-3">
                <span
                  className="relative grid size-10 place-items-center rounded-full font-display font-extrabold text-[var(--r-bg)]"
                  style={{ background: `var(${LIGHTS[i % 3]})` }}
                >
                  {name.slice(0, 1)}
                  <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-presence ring-[2.5px] ring-surface" />
                </span>
                <span>
                  <span className="block font-bold text-fg">{name}</span>
                  <span className="block text-[0.88rem] text-fg-soft">{doing}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-base/70" />
    </div>
  );
}
