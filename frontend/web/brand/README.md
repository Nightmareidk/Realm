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
`<who>-source.glb` (large, not committed). `node scripts/render-cast.mjs` then, per character (the
raised arm's joints for each are listed at the top of that script, read off a front view):

- rigs the raised arm in **Blender 5.2** (`scripts/blender/rig_wave.py`): shoulder, elbow, wrist
  and hand bones; the forearm and hand are found as one connected piece of the mesh (walking it
  from the fingertips back to the elbow), so every finger moves whole and nothing merely near the
  hand (a head, an ear) moves with it; crisp joints; and a baked "Wave" (the forearm swings from
  the elbow as one firm piece, leaning outward, the hand following a touch behind);
- writes `public/models/<who>.<hash>.glb` for the live hero: about 60k triangles, skinned, with the
  Wave animation, 512 px WebP textures, Draco (decoder served from `public/draco/`, copied from
  three);
- renders the wave's 41 frames with Cycles on the GPU, in the cast's studio light (a warm key, cool
  fill and two coloured rims), and packs them: `public/art/cast/<who>.webp` is the pose with the
  arm's area cut out and `<who>-wave.webp` is that area in every frame side by side, which the page
  steps through with CSS; the pose's master goes to `brand/renders/cast/<who>.png`;
- renders a portrait (`scripts/blender/render_model.py --face-only`) into
  `brand/renders/cast/<who>-face.png` and `public/art/cast/<who>-face.webp` (the avatars in every
  product preview);
- records each figure's size and the arm's area in `src/features/landing/cast.json`.

The astronaut moves its whole body in the opening (it floats, swims, flails and tumbles as well as
waving), so its live model is rigged head to toe by `scripts/blender/rig_body.py`. The product
owner rigged it in Meshy (`models-incoming/astro-teal-rigged-source.glb`: Meshy's auto-rig, 29
bones, its own skin weights), and the script keeps that skeleton and those weights, naming the
bones from `scripts/blender/joints/astro-teal-rig.json`, then keys the actions by hand. Meshy's
remesh fused the hanging left arm to the suit down its inner side, and its auto-weights let the
glove, hip and belt pull on each other, so the script tidies the weights first: that side of the
body takes the other side's weights mirrored (the raised arm left it clean), each forearm and hand
is traced as one surface and follows only its own arm, and the helmet follows no arm. The raised
right arm then swings free from the shoulder; the left strokes forward and back more than out.
(Without a Meshy rig, the script builds a skeleton on joints read off a front view instead:
`joints/<who>.json`.)

`scripts/blender/optimize_glb.py` still slims a model on its own (no rig) when needed.

## Day sky

The day hero is drawn live in the sky shader (`src/features/landing/three/sky.tsx`): dawn seen from
orbit over a sea of cloud. Its one asset is `public/art/cloud-tops.webp`, a seamless 1024px
height map of cumulus tops seen from above (white is high), made from scratch by
`scripts/make-cloud-tops.mjs` (round domes at three sizes gathered into fields with gaps, all
tileable noise; no source imagery). The shader lights it with the low sun and streams it toward
the camera.

The sky behind the page (`src/features/landing/sky-life.tsx`) has these:

- `public/art/sky/cloud-*.webp`: cumulus rendered from scratch in Blender
  (`scripts/blender/render_clouds.py`: heaps of spheres turned into volumes, billowed by noise, lit
  by a warm sun with cool sky light in the shade, many volume bounces so they're white), then
  cropped and lifted a little brighter by `scripts/make-sky-sprites.mjs`.
- `public/art/sky/birds.webp`: a gull's wingbeat in eight frames, drawn as vectors by
  `scripts/make-sky-sprites.mjs`.
- `public/art/sky/hill.webp`: the meadow the cast stands on at the end of the page, rendered from
  scratch in Blender (`scripts/blender/render_meadow.py`): the page's own hill curve, grass instanced
  blade by blade over it (tapered, bent blades, each leaning and turning at random, darker at the
  root and gold-green at the tip, translucent against the sun behind the crest), straw-coloured
  patches and a few small flowers, lit like the cast. Packed by `scripts/make-sky-sprites.mjs`.
- `public/art/sky/grass.webp`: the same grass further down the slope, a seamless tile
  (`render_meadow.py --tile 25.6`: the scatter repeated on a wall with eight copies round it).
- `public/art/sky/moon.webp`: the Moon the cast stands on by night, rendered from scratch in
  Blender (`scripts/blender/render_moon.py`): the page's hill curve built as a patch of the
  ellipsoid the camera sees, cratered by geometry nodes (a bowl-and-rim profile on Voronoi cells
  at three sizes, each crater a random size, over regolith noise), the smallest craters and the
  grain in the shading, boulders strewn over it, lit by a low sun from the left with a faint cool
  earthshine. Its foot fades out (`scripts/make-sky-sprites.mjs`) where the footer carries it on.
- `public/art/sky/jet.webp`, `rocket.webp`, and the frame strips `ufo.webp`,
  `ufo-2.webp` and `satellite.webp` (16 frames of a turn each): the product owner's own models,
  made in Meshy (image to 3D) and downloaded from their account into `models-incoming/sky-*.glb`
  (large, not committed), rendered in the cast's studio light by
  `scripts/blender/render_props.py` (the rocket upright, for CSS to lean) and packed by
  `scripts/make-sky-sprites.mjs`.
- `public/art/sky/flame.webp`: the rocket's fire, eight flickering frames of a layered teardrop
  flame drawn as vectors (with a fixed seed) by `scripts/make-sky-sprites.mjs`.

It replaced a filmed summer day (clouds over hills and a glowing brick gateway, made with
Higgsfield for the product owner: a Soul Cinema still, a Nano Banana Pro edit, Kling 3.0
animation, looped with `scripts/blender/video_loop.py`). That film is kept, unused, in
`brand/films/` (`day-sky.mp4` and its first frame `day-sky.jpg`).

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
