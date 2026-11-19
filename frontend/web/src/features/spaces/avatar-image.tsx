"use client";

import { useState } from "react";

/**
 * Someone's uploaded picture. If it won't load (deleted, or its link ran out), their initial
 * shows instead of a broken-image icon or an empty circle.
 */
export function AvatarImage({ src, initial }: { src: string; initial: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (broken === src) return <>{initial}</>;
  return (
    // biome-ignore lint/performance/noImgElement: a small uploaded picture behind an access check, not a static asset.
    <img
      src={src}
      alt=""
      className="size-full rounded-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setBroken(src)}
    />
  );
}
