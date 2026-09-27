# Brand assets and where they come from

Every image Realm ships is made in this repo; nothing is stock or downloaded.

## Mark and icons

- **Eclipse mark**: `src/components/brand/eclipse-mark.tsx` (SVG, the source of truth).
  Chosen by the product owner on 2026-09-27 from `concepts.png` (logo 2 "Eclipse", palette "Aurora").
- **`src/app/icon.png`** (512 px) and **`src/app/apple-icon.png`** (180 px, full bleed): the mark's
  `tile` variant rasterised with sharp at high density. Regenerate them whenever the mark changes.

## 3D renders (`public/art/*.webp`)

All of them are React Three Fiber scenes, the same components the live hero uses:

| Files | Scene |
| --- | --- |
| `astro-{teal,blue,violet,pink}.webp` | `Astronaut3D` (`src/features/landing/three/astronaut3d.tsx`), standing |
| `astro-{tone}-body.webp`, `astro-{tone}-forearm.webp` | the waving pose split into two layers: the page rotates the forearm about the elbow, whose position is written to `src/features/landing/explorer-pivots.json` |
| `heart`, `bubble`, `spark`, `lock`, `controller`, `play`, `upvote` | `src/features/landing/three/props3d.tsx` |
| `planet-{spaces,feed,profiles,boards}.webp` | `Planet` (`src/features/landing/three/universe.tsx`), fixed framing for the star chart |
| `hero-poster-night.webp`, `hero-poster-day.webp` | the hero's 3D cast (eclipse or sun, planets, crew, props) as one still frame per edition, shown while the live scene loads and on devices without WebGL |

Each scene is staged on the dev-only route `/render-3d?item=<name>` (`src/app/render-3d/stage.tsx`)
and exported with:

```
pnpm --filter @realm/web dev
node scripts/render-assets.mjs            # all assets
node scripts/render-assets.mjs heart      # one asset
```

The script screenshots each scene on a transparent background into `brand/renders/<name>.png`
(the lossless masters, kept here) and writes the web version to `public/art/<name>.webp`:
an explorer's body and forearm layers share one crop so they line up exactly, planets keep a fixed
frame (the star chart sizes them by it), and everything else is trimmed and fitted to 480 px.

The hero's sky (aurora, stars, the day sky) is not an image: it's a shader drawn live
(`src/features/landing/three/sky.tsx`), as are the sun and its corona (`sun.tsx`).

## Illustrative photos

The product previews on the landing page use placeholder photos from picsum.photos, and every
preview is captioned as illustrative. They are replaced by real screenshots once the app ships.
