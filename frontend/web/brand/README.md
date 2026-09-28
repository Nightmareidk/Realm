# Brand assets and where they come from

Every image Realm ships is made for Realm, in this repo or with generation tools on the product
owner's own accounts; nothing is stock or downloaded from anyone else.

## Mark and icons

- **Eclipse mark**: `src/components/brand/eclipse-mark.tsx` (SVG, the source of truth).
  Chosen by the product owner on 2026-09-27 from `concepts.png` (logo 2 "Eclipse", palette "Aurora").
- **`src/app/icon.png`** (512 px) and **`src/app/apple-icon.png`** (180 px, full bleed): the mark's
  `tile` variant rasterised with sharp at high density. Regenerate them whenever the mark changes.
- **`src/app/opengraph-image.jpg`** (1200 x 630, the link preview): a capture of the live night
  hero's title card, with the site header and scroll cue hidden. Recapture it when the hero changes.

## The cast (`public/art/cast/`, `public/models/`)

An astronaut (`astro-teal`), aliens (`alien-zib` three-eyed, `alien-nova` crystal-crowned,
`alien-meshy` the little green one), monsters (`monster-gloop` the pink cyclops, `monster-bruno`
the blue plush) and people (`human-maya`, `human-leo`). The product owner made them in **Meshy**
(image to 3D, textured), each posed with a hand up. The source GLBs go in `models-incoming/` as
`<who>-source.glb` (large, not committed). `node scripts/render-cast.mjs` then, per character:

- renders it in **Blender 5.2** with Cycles on the GPU (`scripts/blender/render_model.py`: stood at
  a fixed height, the cast's studio light of a warm key, cool fill and two coloured rims) into
  `brand/renders/cast/<who>.png` and `<who>-face.png` (masters, kept here);
- writes `public/art/cast/<who>.webp` (the page art) and `<who>-face.webp` (the avatars in every
  product preview);
- makes `public/models/<who>.glb` for the live hero with `scripts/blender/optimize_glb.py`: about
  60k triangles, 1024 px WebP textures, Draco (decoder served from `public/draco/`, copied from
  three), feet on the ground;
- records each figure's size in `src/features/landing/cast.json`.

If a character comes back from Meshy rigged and animated (its Animate step), the live hero plays its
own idle and wave clips (`src/features/landing/three/cast3d.tsx`); posed models rock from the feet
to wave instead.

## Day sky (`public/video/`)

`day-sky.mp4` is a summer day: towering clouds over rolling green hills and an old red-brick
gateway glowing like a portal. Made with Higgsfield for the product owner: a Soul Cinema still,
edited with Nano Banana Pro to light the gateway, animated with Kling 3.0 (pro, locked camera,
everything in motion), then made seamless and web-sized with Blender's sequencer
(`scripts/blender/video_loop.py --width 1920 --fade 1.5 --crf HIGH --sharpen 0.6`: a 1.5 s
crossfade loop, a gentle unsharp mask on every frame, H.264 at high quality). The page plays it at
1.7x so the clouds race. `day-sky.jpg` is its first frame, the poster and CSS fallback.

## Preview media (`public/media/`)

The photos and clips inside the product previews (a chat clip, the feed's clip and post, a profile
banner and media grid) are stills from Higgsfield videos and images the product owner made or had
made for Realm: the day film's glowing gateway and its still variants, a sunset stone arch (their
day videos), crimson monoliths (their dusk video) and a cosmic storm (their reference video).
Cropped and exported to WebP with sharp. Every preview is captioned as illustrative.

## Other 3D renders (`public/art/*.webp`)

All of them are React Three Fiber scenes, the same components the live hero uses:

| Files | Scene |
| --- | --- |
| `lock` | `src/features/landing/three/props3d.tsx` (the other props live on the stage but aren't used on the page) |
| `planet-{spaces,feed,profiles,boards}.webp` | `Planet` (`src/features/landing/three/planets.tsx`): procedural ocean, ringed gas giant, ice and cratered worlds, fixed framing for the star chart and the world cards |
| `hero-poster-night.webp`, `hero-poster-day.webp` | the hero's 3D cast (eclipse or sun, planets, crew, props) as one still frame per edition, shown while the live scene loads and on devices without WebGL |

Each scene is staged on the dev-only route `/render-3d?item=<name>` (`src/app/render-3d/stage.tsx`)
and exported with:

```
pnpm --filter @realm/web dev
node scripts/render-assets.mjs            # all assets
node scripts/render-assets.mjs lock       # one asset
```

The script screenshots each scene on a transparent background into `brand/renders/<name>.png`
(the lossless masters, kept here) and writes the web version to `public/art/<name>.webp`:
planets keep a fixed frame (the star chart sizes them by it), and everything else is trimmed and
fitted to 480 px.

The hero's night sky (aurora, stars) is not an image: it's a shader drawn live
(`src/features/landing/three/sky.tsx`), as are the black hole (`black-hole.tsx`), the sun, its corona
and prominences (`sun.tsx`), the planets' surfaces (`planets.tsx`) and the page's nebula, sky and
grain (`globals.css`).
