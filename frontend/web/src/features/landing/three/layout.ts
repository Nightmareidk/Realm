"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
 * Where the hero's DOM pieces sit on its canvas, measured only when the layout changes (resize,
 * fonts loading), never inside the render loop. Reading `getBoundingClientRect` every frame while
 * the same frame writes label transforms forces the browser to redo layout several times a frame,
 * which is what made scrolling through the hero stutter.
 *
 * Offsets are layout positions, so the copy's slide-in transform doesn't move them: the sky's quiet
 * zone sits where the headline ends up.
 */
export interface StageLayout {
  /** Stage (and canvas) size in CSS pixels. */
  cw: number;
  ch: number;
  /** The 3D scene's box (the right column), in canvas pixels. */
  box: { x: number; y: number; w: number; h: number };
  /** The headline column in canvas UV space (0..1, y up): where the sky quietens. */
  text: { x0: number; y0: number; x1: number; y1: number };
  /** Bumped on every measure, so readers can skip work when nothing changed. */
  version: number;
}

export type LayoutRef = RefObject<StageLayout>;

/** `el`'s layout box relative to `root`, ignoring transforms. */
function boxWithin(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== root) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  if (n === root) return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  // `root` isn't in the offset chain (not positioned): fall back to the rendered boxes.
  const r = el.getBoundingClientRect();
  const c = root.getBoundingClientRect();
  return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
}

export function useStageLayout(
  stage: RefObject<HTMLElement | null>,
  box: RefObject<HTMLElement | null>,
  text: RefObject<HTMLElement | null>,
): LayoutRef {
  const layout = useRef<StageLayout>({
    cw: 1,
    ch: 1,
    box: { x: 0, y: 0, w: 0, h: 0 },
    text: { x0: 0, y0: 0, x1: 0, y1: 0 },
    version: 0,
  });

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const s = stage.current;
      if (!s) return;
      const L = layout.current;
      L.cw = Math.max(1, s.clientWidth);
      L.ch = Math.max(1, s.clientHeight);
      if (box.current) L.box = boxWithin(box.current, s);
      if (text.current) {
        const t = boxWithin(text.current, s);
        L.text = {
          x0: t.x / L.cw,
          y0: 1 - (t.y + t.h) / L.ch,
          x1: (t.x + t.w) / L.cw,
          y1: 1 - t.y / L.ch,
        };
      }
      L.version++;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    for (const el of [stage.current, box.current, text.current]) if (el) ro.observe(el);
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [stage, box, text]);

  return layout;
}
