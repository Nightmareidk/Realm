"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { Crosshair, MagnifyingGlass, MapPin } from "@phosphor-icons/react";
import type { Place } from "@realm/contracts";
import { useEffect, useId, useRef, useState } from "react";
import { pill } from "@/components/pill";
import { cx } from "@/lib/cx";
import { type Found, nameOf, searchPlaces, whereAmI } from "./geocode";
import { createMap, type MapHandle } from "./map-view";

/**
 * Pick a place to share once: search for it, or tap the map. "Use my location" asks the browser
 * only when pressed. Nothing is tracked and nothing updates later; the card shows this one spot.
 */
export function PlacePicker({ onPick }: { onPick: (place: Place) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapHandle | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [chosen, setChosen] = useState<Found | null>(null);
  const [note, setNote] = useState("");
  const listId = useId();

  // The map loads with the picker (Google's or Mapbox's, only fetched here). It's made once;
  // its tap handler only touches refs and state setters.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuilding the map on every render would reset it.
  useEffect(() => {
    let cancelled = false;
    let made: MapHandle | null = null;
    void (async () => {
      if (!box.current) return;
      made = await createMap(box.current, async (lat, lng) => {
        place({ id: "tap", name: "Dropped pin", address: null, lat, lng }, false);
        const named = await nameOf(lat, lng).catch(() => null);
        if (named) setChosen({ ...named, lat, lng });
      }).catch(() => null);
      if (cancelled) made?.destroy();
      else map.current = made;
    })();
    return () => {
      cancelled = true;
      made?.destroy();
      map.current = null;
    };
  }, []);

  const place = (f: Found, fly = true) => {
    setChosen(f);
    setResults([]);
    map.current?.pin(f.lat, f.lng);
    if (fly) map.current?.fly(f.lat, f.lng);
  };

  // Search as you type, a beat after you stop.
  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const c = map.current?.center();
      void searchPlaces(query, {
        signal: ctrl.signal,
        near: c ? { lat: c.lat, lng: c.lng } : undefined,
      })
        .then(setResults)
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // For keyboards and screen readers: move the map (its arrow keys pan it), then pin its centre.
  const pinCentre = async () => {
    const c = map.current?.center();
    if (!c) return;
    place({ id: "centre", name: "Dropped pin", address: null, lat: c.lat, lng: c.lng }, false);
    const named = await nameOf(c.lat, c.lng).catch(() => null);
    if (named) setChosen({ ...named, lat: c.lat, lng: c.lng });
  };

  const fromMyLocation = async () => {
    setNote("");
    try {
      const at = await whereAmI();
      const named = await nameOf(at.lat, at.lng).catch(() => null);
      place(named ?? { id: "me", name: "My location", address: null, ...at });
    } catch {
      setNote("Your browser didn't share a location. You can still search or tap the map.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass
            aria-hidden="true"
            size={18}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-soft"
          />
          <label htmlFor={`${listId}-q`} className="sr-only">
            Search for a place
          </label>
          <input
            id={`${listId}-q`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a place"
            autoComplete="off"
            className="h-12 w-full rounded-input bg-base/70 pr-3 pl-10 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none placeholder:text-fg-muted focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
          />
        </div>
        <button
          type="button"
          onClick={() => void fromMyLocation()}
          className={pill("ghost", "md", "shrink-0")}
        >
          <Crosshair aria-hidden="true" size={18} />
          <span className="max-sm:sr-only">Use my location</span>
        </button>
      </div>
      {results.length > 0 && (
        <ul
          aria-label="Places found"
          className="max-h-48 overflow-y-auto rounded-card bg-surface p-1 shadow-[inset_0_0_0_1px_var(--r-border)]"
        >
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => place(r)}
                className="flex w-full items-start gap-2.5 rounded-[0.7rem] px-3 py-2 text-left hover:bg-fg/8"
              >
                <MapPin aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-fg-soft" />
                <span className="min-w-0">
                  <span className="block font-bold text-fg">{r.name}</span>
                  {r.address && (
                    <span className="block truncate text-[0.88rem] text-fg-soft">{r.address}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <div
          ref={box}
          className="h-[min(18rem,45vh)] overflow-hidden rounded-card bg-surface-sunken"
        />
        {/* The centre mark, for "Pin the centre". */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 before:absolute before:top-1/2 before:left-0 before:h-px before:w-full before:bg-fg/70 after:absolute after:top-0 after:left-1/2 after:h-full after:w-px after:bg-fg/70"
        />
      </div>
      <button type="button" onClick={() => void pinCentre()} className={pill("ghost", "sm")}>
        <MapPin aria-hidden="true" size={16} />
        Pin the centre of the map
      </button>
      {note && (
        <p role="status" className="text-[0.92rem] text-fg-soft">
          {note}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <p
          aria-live="polite"
          className={cx("min-w-0 flex-1 text-[0.95rem]", chosen ? "text-fg" : "text-fg-soft")}
        >
          {chosen ? (
            <>
              <strong>{chosen.name}</strong>
              {chosen.address ? <span className="text-fg-soft"> · {chosen.address}</span> : null}
            </>
          ) : (
            "Pick a spot. It's sent once, as a card; Realm never tracks where you are."
          )}
        </p>
        <button
          type="button"
          aria-disabled={!chosen || undefined}
          onClick={() =>
            chosen &&
            onPick({
              name: chosen.name.slice(0, 120),
              address: chosen.address?.slice(0, 240) ?? null,
              lat: chosen.lat,
              lng: chosen.lng,
            })
          }
          className={pill("action", "md", "aria-disabled:opacity-50")}
        >
          Add this place
        </button>
      </div>
    </div>
  );
}
