"use client";

import { Crosshair } from "@phosphor-icons/react";
import type { DiscoverSpace } from "@realm/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { pill } from "@/components/pill";
import { EmptyState } from "@/features/app/place";
import { SpaceRows } from "@/features/spaces/space-rows";
import { ApiError, api } from "@/lib/api";
import { MAPS_ON } from "@/lib/public-config";
import { type Found, searchPlaces, whereAmI } from "./geocode";

/** Rounded to about a kilometre before it goes anywhere: Explore needs the area, not the spot. */
const coarse = (n: number) => Math.round(n * 100) / 100;

type Result =
  | { state: "idle" }
  | { state: "loading"; from: string }
  | { state: "done"; from: string; spaces: DiscoverSpace[] }
  | { state: "error"; message: string };

/**
 * "Nearby": where to look from, then the Spaces closest to it. Your location is asked for only
 * when you press the button, rounded, and sent in the request body for this one search, so it
 * never lands in a URL, the browser history or a server log. Or pick a city.
 */
export function NearbyStart() {
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<Found[]>([]);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Result>({ state: "idle" });

  useEffect(() => {
    if (query.trim().length < 2) return setCities([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void searchPlaces(query, { cities: true, signal: ctrl.signal })
        .then(setCities)
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const look = async (lat: number, lng: number, from: string) => {
    setCities([]);
    setResult({ state: "loading", from });
    try {
      const { spaces } = await api<{ spaces: DiscoverSpace[] }>("/discover/nearby", {
        body: { lat: coarse(lat), lng: coarse(lng) },
      });
      setResult({ state: "done", from, spaces });
    } catch (err) {
      setResult({
        state: "error",
        message:
          err instanceof ApiError ? err.message : "Realm didn't answer. Try again in a moment.",
      });
    }
  };

  const from = result.state === "loading" || result.state === "done" ? result.from : null;
  const status =
    result.state === "loading"
      ? `Looking near ${result.from}`
      : result.state === "done"
        ? `${result.spaces.length} ${result.spaces.length === 1 ? "Space" : "Spaces"} near ${result.from}`
        : result.state === "error"
          ? "Nearby couldn't load"
          : "";

  return (
    <div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={pill("ghost", "md")}
            onClick={async () => {
              setNote("");
              try {
                const at = await whereAmI();
                void look(at.lat, at.lng, "you");
              } catch {
                setNote("Your browser didn't share a location. Pick a city instead.");
              }
            }}
          >
            <Crosshair aria-hidden="true" size={18} />
            Use my location
          </button>
          {MAPS_ON && (
            <div className="relative min-w-[14rem] flex-1">
              <label htmlFor="near-city" className="sr-only">
                Or search for a city
              </label>
              <input
                id="near-city"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  from && from !== "you" ? `Near ${from}. Another city?` : "Or search for a city"
                }
                autoComplete="off"
                className="h-11 w-full rounded-full bg-base/70 px-4 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none placeholder:text-fg-muted focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
              />
              {cities.length > 0 && (
                <ul
                  aria-label="Cities"
                  className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-20 rounded-card bg-surface-raised p-1 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1),0_24px_48px_-12px_rgb(0_0_0/0.7)]"
                >
                  {cities.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          void look(c.lat, c.lng, c.name);
                        }}
                        className="flex w-full flex-col items-start rounded-[0.7rem] px-3 py-2 text-left hover:bg-fg/8"
                      >
                        <span className="font-bold text-fg">{c.name}</span>
                        {c.address && (
                          <span className="text-[0.88rem] text-fg-soft">{c.address}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <p className="text-[0.92rem] text-fg-soft">
          {note ||
            "Used for this search only, rounded to about a kilometre. Realm doesn't keep it."}
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {status}
      </p>
      <div className="mt-8">
        {result.state === "loading" ? (
          <p className="text-fg-soft">Looking near {result.from}…</p>
        ) : result.state === "error" ? (
          <EmptyState title="Nearby couldn't load">
            <p>{result.message}</p>
          </EmptyState>
        ) : result.state === "done" && result.spaces.length === 0 ? (
          <EmptyState
            title={`No public Spaces near ${result.from} yet`}
            action={
              <Link href="/spaces?new=1" className={pill("ghost", "md")}>
                Start a public Space
              </Link>
            }
          >
            <p>
              Spaces show up here when their owners add a city, within 150 km. Yours could be the
              first.
            </p>
          </EmptyState>
        ) : result.state === "done" ? (
          <>
            <h2 className="mb-3 text-[0.95rem] font-bold text-fg-soft">{status}</h2>
            <SpaceRows spaces={result.spaces} />
          </>
        ) : null}
      </div>
    </div>
  );
}
