"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";

/**
 * A row that scrolls sideways (Stories, Notes, highlights, chips). Fingers and trackpads swipe it;
 * a mouse can't, so on devices with a fine pointer (a mouse) round arrow buttons appear at the
 * ends while there's more to see that way. Phones and tablets never show them. The items stay
 * reachable with Tab, so the arrows are left out of the tab order and screen readers.
 */
export function ScrollRow({
  children,
  className,
  label,
  /** Where the arrows sit vertically, if the row's visual centre isn't its middle (e.g. labels). */
  arrowTop = "50%",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  arrowTop?: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState({ before: false, after: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // A pixel of slack: fractional widths can leave scrollLeft just short of the end.
    const before = el.scrollLeft > 1;
    const after = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setMore((m) => (m.before === before && m.after === after ? m : { before, after }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Items arriving later (a feed loading) change the width without resizing the row.
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: still ? "auto" : "smooth" });
  };

  const arrow =
    "absolute z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface-raised/95 text-fg shadow-[0_6px_18px_rgb(0_0_0_/_0.35)] backdrop-blur transition-[opacity,transform] duration-150 hover:scale-105 active:scale-95 pointer-fine:grid";

  return (
    <div className="relative min-w-0">
      <ul ref={ref} onScroll={measure} className={className} aria-label={label}>
        {children}
      </ul>
      {more.before && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => go(-1)}
          className={cx(arrow, "left-1")}
          style={{ top: arrowTop }}
        >
          <CaretLeft size={18} weight="bold" />
        </button>
      )}
      {more.after && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => go(1)}
          className={cx(arrow, "right-1")}
          style={{ top: arrowTop }}
        >
          <CaretRight size={18} weight="bold" />
        </button>
      )}
    </div>
  );
}
