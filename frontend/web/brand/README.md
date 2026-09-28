# Brand assets and where they come from

Every image Realm ships is made in this repo; nothing is stock or downloaded.

## Mark and icons

- **Eclipse mark**: `src/components/brand/eclipse-mark.tsx` (SVG, the source of truth).
  Chosen by the product owner on 2026-09-27 from `concepts.png` (logo 2 "Eclipse", palette "Aurora").
- **`src/app/icon.png`** (512 px) and **`src/app/apple-icon.png`** (180 px, full bleed): the mark's
  `tile` variant rasterised with sharp at high density. Regenerate them whenever the mark changes.

## The cast (`public/art/cast/`, `public/models/`)

Explorers (astronauts), aliens (Zib, Nova), monsters (Gloop, Bruno) and humans (Maya, Leo),
modelled in code and rendered in **Blender 5.2** with Cycles on the GPU
(`scripts/blender/cast.py`): metaball forms, subdivided primitives and physically based
materials (clearcoat plastic, fabric sheen, subsurface skin, jelly transmission, thin-film visors).
`node scripts/render-cast.mjs` renders each one and writes:

- `public/art/cast/<who>.webp` standing, `<who>-body.webp` + `<who>-forearm.webp` the two wave
  layers (one shared crop), `<who>-face.webp` a portrait used as avatars in the product previews;
- `public/models/<who>.glb`, a decimated, Draco-compressed model with named arm joints
  (ShoulderR, ElbowR) for the live hero (decoder served from `public/draco/`, copied from three);
- `src/features/landing/cast.json`, image sizes and the elbow pivot for the page wave.

Masters are kept in `brand/renders/cast/`.

## Day sky

The day sky is drawn live in the hero's sky shader (`src/features/landing/three/sky.tsx`): clouds,
hills, fields and trees are procedural. The one painted piece is the brick gateway on the middle
hill, `public/art/day-gateway.webp`: modelled and rendered in Blender by
`scripts/blender/gateway.py` (Cycles, procedural brick in running bond, stone coping, keystone and
finials, moss, a shadow-catcher ground for its contact shadow), master in `brand/renders/`.

## Other 3D renders (`public/art/*.webp`)

All of them are React Three Fiber scenes, the same components the live hero uses:

| Files | Scene |
| --- | --- |
| `lock` | `src/features/landing/three/props3d.tsx` (the other props live on the stage but aren't used on the page) |
| `planet-{spaces,feed,profiles,boards}.webp` | `Planet` (`src/features/landing/three/planets.tsx`): procedural ocean, ringed gas giant, ice and cratered worlds, fixed framing for the star chart |
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
(`src/features/landing/three/sky.tsx`), as are the sun, its corona and prominences (`sun.tsx`), the
planets' surfaces (`planets.tsx`) and the page's nebula (`globals.css`).

## Illustrative photos

The product previews on the landing page use placeholder photos from picsum.photos, and every
preview is captioned as illustrative. They are replaced by real screenshots once the app ships.
