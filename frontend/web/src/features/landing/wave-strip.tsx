"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

/**
 * A character's wave: the strip of frames CSS steps through (see art.tsx). If it can't load (a page
 * left open across a re-render asks for a file that's since been replaced), it hides rather than
 * letting the browser draw a broken image's border, which the arm's box clips to two stray lines.
 */
export function WaveStrip({
  src,
  className,
  style,
  eager,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  eager?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // It may have failed before the page came to life, when no one was listening yet.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0 && el.currentSrc) setBroken(true);
  }, []);
  return (
    // biome-ignore lint/performance/noImgElement: a frame strip stepped through by CSS; next/image would resize it.
    <img
      ref={img}
      src={src}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={broken ? { ...style, visibility: "hidden" } : style}
      onError={() => setBroken(true)}
    />
  );
}
