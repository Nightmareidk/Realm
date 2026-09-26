// biome-ignore-all lint/a11y/noAriaHiddenOnFocusable: the flagged elements are SVG <g> layers, which are never focusable; they are decorative map artwork.
"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { type CSSProperties, type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { REGIONS } from "../regions";
import styles from "./atlas-map.module.css";
import type { MapGeometry, RegionId } from "./geometry";

const ink = (id: RegionId, role: "fill" | "line" | "solid" | "text") => `var(--r-${id}-${role})`;

/** Each preview folds out in the quadrant opposite its region, so the region stays visible. */
const PANEL_POSITION: Record<RegionId, CSSProperties> = {
  spaces: { right: "2%", bottom: "5%", transformOrigin: "top left" },
  feed: { left: "2%", bottom: "5%", transformOrigin: "top right" },
  profiles: { left: "2%", top: "6%", transformOrigin: "bottom right" },
  boards: { right: "2%", top: "6%", transformOrigin: "bottom left" },
};

const COURSE_MS = 1600;
const COURSE_DELAY_MS = 350;

export function AtlasMap({
  geometry: g,
  previews,
}: {
  geometry: MapGeometry;
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

  const onRegionKey = (e: KeyboardEvent, id: RegionId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(id);
    }
  };

  const courseStart = (i: number) => (i === 0 ? 0 : (g.legs[i - 1]?.at ?? 0));
  const activeRegion = REGIONS.find((r) => r.id === active);

  return (
    <div
      className={styles.atlas}
      data-active={active ?? undefined}
      onPointerLeave={() => {
        if (!pinned) setActive(null);
      }}
    >
      <div className="relative">
        {/* biome-ignore lint/a11y/useSemanticElements: an SVG map can't be a <fieldset>; role="group" names the interactive region set. */}
        <svg
          viewBox={`0 0 ${g.width} ${g.height}`}
          className="block h-auto w-full select-none"
          role="group"
          aria-label="Map of Realm: Spaces, Feed, Profiles and Boards are four regions that meet at one hub"
        >
          <defs>
            <clipPath id="atlas-continent">
              <path d={g.continent} />
            </clipPath>
            {g.regions.map((r) => (
              <clipPath key={r.id} id={`atlas-region-${r.id}`}>
                <path d={r.area} />
              </clipPath>
            ))}
            <filter id="atlas-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          {/* Frame, grid and grid references */}
          <rect
            x={g.frame.x}
            y={g.frame.y}
            width={g.frame.w}
            height={g.frame.h}
            fill="none"
            stroke="var(--r-rule)"
            strokeWidth="1"
          />
          <path d={g.gridLines} stroke="var(--r-rule)" strokeWidth="1" opacity="0.7" />
          <g
            fill="var(--r-ink-muted)"
            fontSize="13"
            fontWeight="600"
            className="tabular stretch-condensed"
            aria-hidden="true"
          >
            {g.columns.map((c) => (
              <text key={c.label} x={c.x} y={g.frame.y - 12} textAnchor="middle">
                {c.label}
              </text>
            ))}
            {g.rows.map((r) => (
              <text key={r.label} x={g.frame.x - 16} y={r.y + 4} textAnchor="middle">
                {r.label}
              </text>
            ))}
          </g>

          {/* Coast echoes and islands */}
          <g fill="none" stroke="var(--r-rule-strong)" aria-hidden="true">
            <path d={g.coastEchoes[0]} strokeWidth="1" opacity="0.45" />
            <path d={g.coastEchoes[1]} strokeWidth="1" opacity="0.22" />
          </g>
          {g.islands.map((d) => (
            <path
              key={d}
              d={d}
              fill="var(--r-land)"
              stroke="var(--r-rule-strong)"
              strokeWidth="1"
            />
          ))}

          {/* The continent: four regions clipped to one coastline */}
          <g clipPath="url(#atlas-continent)">
            <path d={g.continent} fill="var(--r-land)" />
            {g.regions.map((r) => {
              const meta = REGIONS.find((m) => m.id === r.id);
              const on = active === r.id;
              return (
                // biome-ignore lint/a11y/useSemanticElements: map regions are SVG shapes; <button> can't be used inside SVG.
                <path
                  key={r.id}
                  d={r.area}
                  fill={ink(r.id, "fill")}
                  className={styles.region}
                  data-on={on || undefined}
                  tabIndex={0}
                  role="button"
                  aria-pressed={on}
                  aria-label={`${meta?.name}: ${meta?.tagline}. Show preview`}
                  onPointerEnter={() => {
                    if (canHover && !pinned) setActive(r.id);
                  }}
                  onClick={() => select(r.id)}
                  onKeyDown={(e) => onRegionKey(e, r.id)}
                />
              );
            })}
            {g.regions.map((r) => (
              <g
                key={r.id}
                className={styles.regionGroup}
                data-on={active === r.id || undefined}
                clipPath={`url(#atlas-region-${r.id})`}
                fill="none"
                stroke={ink(r.id, "line")}
                strokeWidth="1.1"
                pointerEvents="none"
                aria-hidden="true"
              >
                <g className={styles.contours}>
                  {r.contours.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </g>
                <g className={styles.activeContours}>
                  {r.activeContours.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </g>
              </g>
            ))}
            <g
              fill="none"
              stroke="var(--r-ground)"
              strokeWidth="3"
              pointerEvents="none"
              aria-hidden="true"
            >
              {g.borders.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          </g>
          <path
            d={g.continent}
            fill="none"
            stroke="var(--r-rule-strong)"
            strokeWidth="1.4"
            pointerEvents="none"
          />

          {/* Map lettering */}
          {g.regions.map((r) => {
            const meta = REGIONS.find((m) => m.id === r.id);
            return (
              <g
                key={r.id}
                className={styles.label}
                data-on={active === r.id || undefined}
                aria-hidden="true"
              >
                <text
                  x={r.label.x}
                  y={r.label.y}
                  textAnchor="middle"
                  fill={ink(r.id, "text")}
                  fontSize="21"
                  className="map-lettering"
                >
                  {meta?.name}
                </text>
                <text
                  x={r.label.x}
                  y={r.label.y + 22}
                  textAnchor="middle"
                  fill="var(--r-ink-soft)"
                  fontSize="12.5"
                  className="stretch-condensed tabular"
                  fontWeight="600"
                  letterSpacing="0.06em"
                >
                  {r.gridRef}
                </text>
              </g>
            );
          })}

          {/* The course: start, one control per region, finish at the hub */}
          <g
            fill="none"
            stroke="var(--r-overprint)"
            strokeLinecap="round"
            pointerEvents="none"
            aria-hidden="true"
          >
            <g filter="url(#atlas-glow)" opacity="0.55" strokeWidth="7">
              {g.legs.map((leg, i) => (
                <path
                  key={`glow-${leg.d}`}
                  d={leg.d}
                  className={styles.leg}
                  style={legStyle(leg.length, courseStart(i), leg.at)}
                />
              ))}
            </g>
            <g strokeWidth="3">
              {g.legs.map((leg, i) => (
                <path
                  key={leg.d}
                  d={leg.d}
                  className={styles.leg}
                  style={legStyle(leg.length, courseStart(i), leg.at)}
                />
              ))}
            </g>
            <polygon points={g.start.points} strokeWidth="3" strokeLinejoin="round" />
            {g.regions.map((r, i) => (
              <g
                key={r.id}
                className={styles.control}
                style={
                  {
                    "--delay": `${COURSE_DELAY_MS + (g.legs[i]?.at ?? 0) * COURSE_MS}ms`,
                  } as CSSProperties
                }
              >
                <circle cx={r.control.x} cy={r.control.y} r="15" strokeWidth="3" />
                <text
                  x={r.control.x + 20}
                  y={r.control.y - 14}
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
              className={styles.control}
              style={{ "--delay": `${COURSE_DELAY_MS + COURSE_MS}ms` } as CSSProperties}
            >
              <circle cx={g.hub.x} cy={g.hub.y} r="11" strokeWidth="3" />
              <circle cx={g.hub.x} cy={g.hub.y} r="18" strokeWidth="3" />
            </g>
          </g>
        </svg>

        {/* Fold-out previews (desktop: floating over the far quadrant; mobile: below the map) */}
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

      <MapLegend active={active} onSelect={select} />
      <p className="sr-only" aria-live="polite">
        {activeRegion ? `Showing a preview of ${activeRegion.name}` : ""}
      </p>
    </div>
  );
}

function legStyle(length: number, startAt: number, endAt: number): CSSProperties {
  return {
    "--len": `${length}`,
    "--dur": `${Math.max(1, (endAt - startAt) * COURSE_MS)}ms`,
    "--delay": `${COURSE_DELAY_MS + startAt * COURSE_MS}ms`,
  } as CSSProperties;
}

function MapLegend({
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
                "flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-[border-color,background-color,color] duration-160 ease-out",
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
        <span className="hidden md:inline">Hover or select a region to preview it. </span>
        <span className="md:hidden">Tap a region to preview it. </span>
        <a href="#download" className="text-ink-soft underline hover:text-ink">
          Browser now, apps soon
        </a>
      </p>
    </div>
  );
}
