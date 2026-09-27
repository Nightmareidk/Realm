// biome-ignore-all lint/a11y/noAriaHiddenOnFocusable: the flagged elements are SVG <g> layers, which are never focusable; they are decorative chart artwork.
"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { type CSSProperties, type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { AURORA } from "@/components/brand/eclipse-mark";
import { cx } from "@/lib/cx";
import { REGIONS } from "../regions";
import type { RegionId, StarChart } from "./star-chart";
import styles from "./star-chart.module.css";

const ink = (id: RegionId, role: "fill" | "line" | "solid" | "text") => `var(--r-${id}-${role})`;

/** Each preview folds out on the side of the chart away from its planet, so the planet stays visible. */
const PANEL_POSITION: Record<RegionId, CSSProperties> = {
  spaces: { right: "2%", bottom: "4%", transformOrigin: "top left" },
  feed: { left: "2%", bottom: "4%", transformOrigin: "top right" },
  profiles: { left: "2%", top: "4%", transformOrigin: "bottom right" },
  boards: { right: "2%", top: "4%", transformOrigin: "bottom left" },
};

const FLIGHT_MS = 1800;
const FLIGHT_DELAY_MS = 350;
const WAYPOINT = 14;
/**
 * The planet renders (scripts/render-assets.mjs, planet-*) share one fixed framing: the sphere's
 * radius is 1 / 2.72 of the image's half-width (room for Feed's rings), so a planet of radius r gets an image 5.44r wide.
 */
const PLANET_FRAME = 2.72;

export function StarChartMap({
  chart: g,
  previews,
}: {
  chart: StarChart;
  previews: Record<RegionId, ReactNode>;
}) {
  const [active, setActive] = useState<RegionId | null>(null);
  const [pinned, setPinned] = useState(false);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setActive(null);
        setPinned(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const select = (id: RegionId) => {
    if (active === id && pinned) {
      setActive(null);
      setPinned(false);
    } else {
      setActive(id);
      setPinned(true);
    }
  };

  const onPlanetKey = (e: KeyboardEvent, id: RegionId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(id);
    }
  };

  const legStart = (i: number) => (i === 0 ? 0 : (g.legs[i - 1]?.at ?? 0));
  const activeRegion = REGIONS.find((r) => r.id === active);
  const activeOrbit = g.planets.find((p) => p.id === active)?.orbit;
  const first = g.planets[0];
  const heading = first ? Math.atan2(first.y - g.launch.y, first.x - g.launch.x) : 0;
  const { x: cx0, y: cy0 } = g.center;

  return (
    <div
      className={styles.chart}
      data-active={active ?? undefined}
      onPointerLeave={() => {
        if (!pinned) setActive(null);
      }}
    >
      <div className="relative">
        {/* biome-ignore lint/a11y/useSemanticElements: an SVG chart can't be a <fieldset>; role="group" names the interactive planet set. */}
        <svg
          viewBox={`0 0 ${g.width} ${g.height}`}
          className="block h-auto w-full select-none"
          role="group"
          aria-label="Star chart of Realm: Spaces, Feed, Profiles and Boards are four planets orbiting one eclipse"
        >
          <defs>
            <radialGradient id="chart-sun" cx="0.42" cy="0.4" r="0.62">
              <stop offset="0" stopColor="#fff7dc" />
              <stop offset="0.45" stopColor="#ffd35c" />
              <stop offset="1" stopColor="#ff8a1f" />
            </radialGradient>
            <radialGradient id="chart-sun-glow">
              <stop offset="0.45" stopColor="#ffb84a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ffb84a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="chart-corona">
              <stop offset="0.5" stopColor={AURORA.lime} stopOpacity="0" />
              <stop offset="0.6" stopColor={AURORA.lime} stopOpacity="0.9" />
              <stop offset="0.68" stopColor={AURORA.teal} stopOpacity="0.55" />
              <stop offset="0.82" stopColor={AURORA.blue} stopOpacity="0.16" />
              <stop offset="1" stopColor={AURORA.blue} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="chart-rim" x1="0.1" y1="0.9" x2="0.9" y2="0.1">
              <stop offset="0" stopColor={AURORA.lime} />
              <stop offset="0.45" stopColor={AURORA.teal} />
              <stop offset="1" stopColor={AURORA.blue} />
            </linearGradient>
            {g.planets.map((p) => (
              <radialGradient key={p.id} id={`chart-halo-${p.id}`}>
                <stop offset="0.4" style={{ stopColor: ink(p.id, "solid") }} stopOpacity="0.45" />
                <stop offset="1" style={{ stopColor: ink(p.id, "solid") }} stopOpacity="0" />
              </radialGradient>
            ))}
            <filter id="chart-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          {/* Stars */}
          <g fill="#dbe8ff" className={styles.stars} aria-hidden="true">
            {g.stars.map((s) => (
              <circle
                key={`${s.x},${s.y}`}
                cx={s.x}
                cy={s.y}
                r={s.r}
                opacity={s.twinkle ? 1 : 0.5}
                className={s.twinkle ? "twinkle" : undefined}
                style={
                  s.twinkle
                    ? ({
                        "--twinkle-delay": `${(s.x % 40) / 10}s`,
                        "--twinkle-dur": `${3 + (s.y % 30) / 10}s`,
                      } as CSSProperties)
                    : undefined
                }
              />
            ))}
          </g>

          {/* Orbits */}
          <g fill="none" transform={`rotate(${g.tilt} ${cx0} ${cy0})`} aria-hidden="true">
            {g.orbits.map((o, i) => (
              <ellipse
                key={o.rx}
                cx={cx0}
                cy={cy0}
                rx={o.rx}
                ry={o.ry}
                className={styles.orbit}
                data-on={activeOrbit === i || undefined}
                stroke={activeOrbit === i && active ? ink(active, "line") : "var(--r-rule-strong)"}
                strokeWidth={activeOrbit === i ? 1.6 : 1}
                strokeDasharray={i === 0 ? "2 7" : undefined}
              />
            ))}
          </g>

          {/* By day the centre is the sun itself */}
          <g className={styles.dayOnly} aria-hidden="true">
            <circle cx={cx0} cy={cy0} r={g.eclipse * 2.1} fill="url(#chart-sun-glow)" />
            <circle cx={cx0} cy={cy0} r={g.eclipse} fill="url(#chart-sun)" />
          </g>

          {/* The eclipse at the centre: the logo, as the sun this system turns around */}
          <g className={styles.nightOnly} aria-hidden="true">
            <circle cx={cx0} cy={cy0} r={g.eclipse * 1.9} fill="url(#chart-corona)" />
            <circle
              cx={cx0 - 5}
              cy={cy0 + 5}
              r={g.eclipse}
              fill="none"
              stroke="url(#chart-rim)"
              strokeWidth="12"
              filter="url(#chart-glow)"
              opacity="0.8"
            />
            <circle
              cx={cx0 - 5}
              cy={cy0 + 5}
              r={g.eclipse}
              fill="none"
              stroke="url(#chart-rim)"
              strokeWidth="6"
            />
            <circle cx={cx0 + 5} cy={cy0 - 5} r={g.eclipse - 1} fill="var(--r-ground)" />
          </g>

          {/* Planets */}
          {g.planets.map((p) => {
            const meta = REGIONS.find((m) => m.id === p.id);
            const on = active === p.id;
            return (
              <g key={p.id} className={styles.planet} data-on={on || undefined}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.r * 2.3}
                  fill={`url(#chart-halo-${p.id})`}
                  className={styles.halo}
                />
                <image
                  href={`/art/planet-${p.id}.webp`}
                  x={p.x - p.r * PLANET_FRAME}
                  y={p.y - p.r * PLANET_FRAME}
                  width={p.r * PLANET_FRAME * 2}
                  height={p.r * PLANET_FRAME * 2}
                />

                {/* biome-ignore lint/a11y/useSemanticElements: planets are SVG shapes; <button> can't be used inside SVG. */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.r + 30}
                  fill="transparent"
                  className={styles.hit}
                  tabIndex={0}
                  role="button"
                  aria-pressed={on}
                  aria-label={`${meta?.name}: ${meta?.tagline}. Show preview`}
                  onPointerEnter={() => {
                    if (canHover && !pinned) setActive(p.id);
                  }}
                  onClick={() => select(p.id)}
                  onKeyDown={(e) => onPlanetKey(e, p.id)}
                />
                <text
                  x={p.label.x}
                  y={p.label.y}
                  textAnchor={p.label.anchor}
                  fill={ink(p.id, "text")}
                  fontSize="21"
                  className={cx("map-lettering", styles.label)}
                  aria-hidden="true"
                >
                  {meta?.name}
                </text>
              </g>
            );
          })}

          {/* The flight: launch, one waypoint per planet, landing at the eclipse */}
          <g
            fill="none"
            stroke="var(--r-overprint)"
            strokeLinecap="round"
            pointerEvents="none"
            aria-hidden="true"
          >
            <g filter="url(#chart-glow)" opacity="0.5" strokeWidth="7">
              {g.legs.map((leg, i) => (
                <path
                  key={`glow-${leg.d}`}
                  d={leg.d}
                  className={styles.leg}
                  style={legStyle(leg.length, legStart(i), leg.at)}
                />
              ))}
            </g>
            <g strokeWidth="2.5">
              {g.legs.map((leg, i) => (
                <path
                  key={leg.d}
                  d={leg.d}
                  className={styles.leg}
                  style={legStyle(leg.length, legStart(i), leg.at)}
                />
              ))}
            </g>
            <polygon
              points={ship(g.launch.x, g.launch.y, heading)}
              fill="var(--r-overprint)"
              stroke="none"
            />
            {g.planets.map((p, i) => (
              <g
                key={p.id}
                className={styles.waypoint}
                style={
                  {
                    "--delay": `${FLIGHT_DELAY_MS + (g.legs[i]?.at ?? 0) * FLIGHT_MS}ms`,
                  } as CSSProperties
                }
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.r + WAYPOINT}
                  strokeWidth="2"
                  strokeDasharray="4 6"
                />
                <text
                  x={p.x + (p.r + WAYPOINT) * 0.78}
                  y={p.y - (p.r + WAYPOINT) * 0.78}
                  fill="var(--r-overprint)"
                  stroke="none"
                  fontSize="15"
                  fontWeight="700"
                  className="tabular"
                >
                  {i + 1}
                </text>
              </g>
            ))}
            <g
              className={styles.waypoint}
              style={{ "--delay": `${FLIGHT_DELAY_MS + FLIGHT_MS}ms` } as CSSProperties}
            >
              <circle cx={cx0} cy={cy0} r={g.eclipse + 22} strokeWidth="2.5" />
            </g>
          </g>
        </svg>

        {/* Fold-out previews (desktop: floating on the far side; mobile: below the chart) */}
        {REGIONS.map((r) => (
          <div
            key={r.id}
            className={styles.panel}
            style={PANEL_POSITION[r.id]}
            data-open={active === r.id || undefined}
            aria-hidden={active !== r.id}
          >
            <div className="mb-2 flex items-center justify-between gap-3 max-md:mt-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: ink(r.id, "solid") }}
                />
                {r.name}
              </p>
              <a
                href={r.href}
                tabIndex={active === r.id ? 0 : -1}
                className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
              >
                Explore {r.name} <ArrowRight size={14} />
              </a>
            </div>
            {previews[r.id]}
          </div>
        ))}
      </div>

      <ChartLegend active={active} onSelect={select} />
      <p className="sr-only" aria-live="polite">
        {activeRegion ? `Showing a preview of ${activeRegion.name}` : ""}
      </p>
    </div>
  );
}

/** A small arrowhead ship at the launch point, pointed along the first leg. */
function ship(x: number, y: number, a: number) {
  const p = (d: number, side: number) =>
    `${(x + Math.cos(a) * d - Math.sin(a) * side).toFixed(1)},${(y + Math.sin(a) * d + Math.cos(a) * side).toFixed(1)}`;
  return [p(16, 0), p(-9, 10), p(-3, 0), p(-9, -10)].join(" ");
}

function legStyle(length: number, startAt: number, endAt: number): CSSProperties {
  return {
    "--len": `${length}`,
    "--dur": `${Math.max(1, (endAt - startAt) * FLIGHT_MS)}ms`,
    "--delay": `${FLIGHT_DELAY_MS + startAt * FLIGHT_MS}ms`,
  } as CSSProperties;
}

function ChartLegend({
  active,
  onSelect,
}: {
  active: RegionId | null;
  onSelect: (id: RegionId) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-rule pt-4">
      <ul className="flex flex-wrap gap-1.5" aria-label="Regions">
        {REGIONS.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              aria-pressed={active === r.id}
              onClick={() => onSelect(r.id)}
              className={cx(
                "flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-[border-color,background-color,color] duration-160 ease-out",
                active === r.id
                  ? "border-ink-soft bg-panel text-ink"
                  : "border-rule text-ink-soft hover:border-rule-strong hover:text-ink",
              )}
            >
              <span className="size-2.5 rounded-full" style={{ background: ink(r.id, "solid") }} />
              {r.name}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-muted">
        <span className="hidden md:inline">Hover or select a planet to preview it. </span>
        <span className="md:hidden">Tap a planet to preview it. </span>
        <a href="#download" className="text-ink-soft underline hover:text-ink">
          Browser now, apps soon
        </a>
      </p>
    </div>
  );
}
