# Loaders, 3D phones, holo cards, atmospheric backgrounds, Meshy

Research date: 2026-10-02. Stack: Next.js 16, React 19, R3F 9, drei 10, three 0.186, GSAP 3.15.
Target floor: AMD Radeon 610M iGPU, Chrome on Windows. Reduced motion respected. WCAG 2.2 AA.

Status: complete (2026-10-02). Web research only; nothing here has been benchmarked on the 610M yet. Measure each recommendation on a production build (`next build && next start --port 3100`) before adopting it.

## 1. Loading pages

### What the best ones do (and why)

- **The very best "loader" is none.** Linear, Vercel, Arc and Apple's product pages ship real content in the first HTML and animate it on arrival. Heavy 3D (iPhone pages) streams in after first paint behind a still poster. Lesson for Realm: the loader is a *first-visit intro* that hides GPU warm-up, not a gate on reading the page.
- **WebGL showcase sites that do gate** (Igloo Inc by abeto, Awwwards SOTY 2024; Lusion; Bruno Simon) gate because the whole page *is* one canvas. Abeto says it cut load time with custom geometry exporters and "compiling shaders, both during the initial load and in the background" (Awwwards case study, https://www.awwwards.com/igloo-inc-case-study.html, read 2026-10-02). The loader covers real work (download, decode, compile), and the scene behind it is already live when it lifts. That is why they feel seamless: **the loader is the first frame of the scene, not a separate page.**
- **Bad loaders** show a fake 0-100 counter on a timer, show it on every visit, and cut hard to the hero. A fake counter that stalls at 99 is exactly the uneven-progress problem NN/g warns about (https://www.nngroup.com/articles/progress-indicators/, 2014, still the reference).

### Real progress vs fake timers

What actually blocks a good first frame on Realm, by stage. Weight them, then sum into one 0-1 value:

| Stage | Signal | Notes |
|---|---|---|
| Network (GLB, textures) | `THREE.DefaultLoadingManager` via drei `useProgress` (`loaded/total`, `item`, `errors`) | Counts **items, not bytes**. `total` grows as new loaders queue, so progress can jump backwards. drei docs: it "wraps `THREE.DefaultLoadingManager`" and can be used outside Suspense, e.g. for DOM overlays (http://drei.docs.pmnd.rs/loaders/progress-use-progress). Use a selector (`useProgress(s => s.progress)`) to avoid re-renders. |
| Fonts | `document.fonts.load('600 1em "Realm Sans"')` then `document.fonts.ready` | Essential before drawing text into a `CanvasTexture` (phone screens, §2). Otherwise the canvas bakes the fallback font. |
| Images | `await img.decode()` / `createImageBitmap()` | Decodes off the main thread, so no jank when the poster or texture first shows. |
| GPU compile | `await gl.compileAsync(scene, camera)` (three r158+, uses `KHR_parallel_shader_compile`, not in Firefox) | This is the stage that froze Realm before. Keep the existing `three/warm.ts`. Compile off-screen passes with their render target bound. |
| First real frame | a `useFrame` flag after compile | Only then crossfade the live canvas over the poster. |

Pattern: `progress = 0.15*fonts + 0.15*poster + 0.45*network + 0.25*compile`. **Ease the displayed value toward the real value** (lerp ≈ 0.08/frame), never past it, and never let it go backwards. Start slow and finish fast (NN/g). Hard cap: at 3.0 s, lift the loader anyway; the hero is already readable and 3D swaps in when warm.

```ts
// features/landing/intro/readiness.ts (sketch)
export async function ready(scene, camera, gl, report: (k: string, v: number) => void) {
  const fonts = document.fonts.load('600 1em "Realm Sans"').then(() => document.fonts.ready).then(() => report('fonts', 1));
  const poster = (document.querySelector('img[data-hero-poster]') as HTMLImageElement)?.decode().then(() => report('poster', 1));
  // network: subscribe to useProgress store outside React
  const unsub = useProgress.subscribe(s => report('net', s.total ? s.loaded / s.total : 0));
  await Promise.all([fonts, poster]);
  await gl.compileAsync(scene, camera);           // + warmScene() for RT passes
  report('compile', 1); unsub();
}
```

### Time budgets and first vs return visits

- **Under 400 ms: show nothing.** A loader that flashes in and out is worse than none. Gate the overlay with a 400 ms delay before it appears.
- **Once shown, keep it at least ~700 ms** so the choreography finishes cleanly. **Cap it at 3 s**, then lift regardless.
- **Choreography after ready: 0.8-1.4 s**, then the page is fully interactive.
- **Same session (`sessionStorage`):** skip completely. Realm already does this in `intro.tsx` (`sessionStorage.setItem(SEEN, …)`). Set the flag in an inline `<head>` script so the overlay never paints (`html[data-intro=done]` hides it via CSS before hydration).
- **Returning on another day (`localStorage` last-seen > 24 h):** a 400 ms "short form" (logo resolve only).
- LCP measurement stops at first input or scroll (Chrome 83), so a skip click ends LCP measurement too.

### Seamless hand-off into the hero

1. **Shared element (DOM):** never unmount the loader's hero element; *move* it. GSAP `Flip` (free since GSAP 3.13) or the View Transitions API: give the same `view-transition-name` to the loader mark and the hero mark, then call `document.startViewTransition()`. Same-document view transitions have shipped in Chrome since 111 and became Baseline in Oct 2025 (https://developer.chrome.com/blog/view-transitions-in-2025). Caveat: the *old* state is a static snapshot, so a WebGL canvas freezes in it. Keep the canvas out of the transition (`view-transition-name: none`).
2. **Camera continuation (3D):** the loader *is* the 3D scene at a different camera pose (macro close-up on a phone's dark glass, screen emissive at 0). Progress drives `screenEmissive` and exposure. On ready, GSAP tweens the camera to the hero framing: no cut, no second canvas.
3. **Poster → live swap:** SSR an `<img>` pre-rendered at the *exact* hero camera framing. Crossfade to the canvas only after the first real frame (≤150 ms opacity). On an iGPU this hides the 0.5 s PMREM stall Realm already accepts.

### Accessibility

- The overlay is decorative: `aria-hidden="true"`, no live-region chatter. Screen-reader users get the SSR hero immediately.
- **WCAG 2.2 SC 2.4.11 Focus Not Obscured (AA):** if keyboard focus can reach elements under an opaque overlay, that is a failure. Either make `<main>` `inert` for the ≤1.5 s intro and put a focusable **"Skip intro"** button in the overlay, or make the overlay `pointer-events:none` and fade it before anything is focusable.
- `aria-busy="true"` goes only on the 3D figure wrapper while it warms. It is not for the whole page, and support is patchy.
- **Reduced motion:** no choreography. Show the poster with a 150 ms opacity crossfade to the canvas, or keep the static poster permanently if the GPU tier is low.
- SC 2.2.2 (Pause, Stop, Hide) applies only to motion longer than 5 s. Stay well under that.

### Next.js 16: LCP and SEO

- **Render the hero under the loader, fully opaque.** The LCP spec measures the visible area within the viewport and **does not consider occlusion** by other elements (https://w3c.github.io/largest-contentful-paint/). So an opaque `<h1>` or poster under the overlay is the LCP candidate at its first paint.
- **Do not hide the hero with `opacity:0`.** Chrome ignores opacity-0 paints (M86). Since M130 it also excludes transparent text. A fade-in from 0 makes LCP the moment of the next repaint (https://web.dev/articles/lcp; https://chromium.googlesource.com/chromium/src.git/+/master/docs/speed/metrics_changelog/lcp.md; https://www.debugbear.com/blog/opacity-animation-poor-lcp). Animate entrances with `transform`/`clip-path`, or start opacity at ≥0.1.
- Full-viewport elements are treated as background and excluded, so a full-screen loader rarely becomes the LCP itself. Keep the loader's logo small.
- Load the poster with `next/image` `priority` (or `fetchPriority="high"`). Use `next/font` with `adjustFontFallback` so text paints instantly.
- Crawlers get the SSR hero text regardless of the overlay. Never `display:none` the hero.

### Six loader concepts for Realm

1. **"The crew arrives":** 5 avatar dots drift in one by one, one per real stage (fonts, poster, models, compile, first frame). Together they form the Realm mark. Hand-off: GSAP Flip moves the cluster into the group-chat header on the hero phone's screen.
2. **"Phone wakes":** the camera sits in macro on a dark phone's glass. Progress raises the backlight; a lock-screen notification stack ("3 new in The Crew") lands at 100%. Then the camera pulls back to the hero pose. Pure camera continuation, with the canvas pre-warmed.
3. **"Deal the cards":** profile cards are dealt into a fan, one per stage. The last card flips to show its holo foil (§3) and flies to its slot in the hero. It shares the card component with the page.
4. **"Typing…":** the three-dot typing bubble, the most social-native loading idiom there is, with "your friends are typing". On ready it resolves into the hero headline as a sent message. CSS-only, almost free on an iGPU, and gracefully static under reduced motion.
5. **"Theme shuffle":** real profile-theme palettes (from the theme system) cycle as a thin bar that fills with progress. The final palette *is* the hero's starting theme, which sets up the scroll theme-swap section.
6. **"Invite link":** the wordmark draws as an SVG stroke tied to progress. Then it opens as a mask/portal (`clip-path: circle()` expanding from the "R") onto the already-rendered hero. Cheap, and it suits an invite-only friend-group product.

Recommendation: **#4 or #1 for first visits, capped at 1.5 s of choreography, and skipped in-session.** Use #2 only if the hero is 3D-first; it gives the best hand-off but costs the most GPU time at start.

## 2. 3D phones with real app UI

### The body: procedural vs glTF vs Meshy

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Procedural** (`ExtrudeGeometry` of a rounded-rect `Shape` with a small bevel) | ~3-6k tris, zero download, exact proportions, the screen is a separate mesh with clean 0-1 UVs, any colourway | Detail (buttons, camera) is hand-modelled | **Use this.** |
| `RoundedBoxGeometry` (three addons) / drei `<RoundedBox>` | One line | Radius is clamped to `min(w/2, h/2, depth/2)` (source: `examples/jsm/geometries/RoundedBoxGeometry.js`). A 0.08-deep phone can't have big screen corners, so it reads as a "soap bar" | Only for distant or background phones |
| glTF from Sketchfab, CGTrader, OpenGameArt | Detail for free | Most "phones" are fan-made iPhones/Galaxies (trade dress). CC-BY needs attribution. Unknown topology and UVs, so the screen UVs are usually wrong | Only a CC0 generic, re-UV'd |
| Meshy-generated | Fast concepting | Hard-surface output has wobbly bevels and baked lighting, and no clean screen UV island | Not for the hero phone (see §5) |

**Avoid Apple trade dress.** Apple's own bezels can't be used: the Marketing Guidelines forbid "adding reflections, shadows, highlights", "tilting", "animating, flipping, or spinning" product images (https://developer.apple.com/app-store/marketing/guidelines, read 2026-10-02). Design a *Realm phone* instead:
- a centred punch-hole, not a Dynamic Island pill
- uniform, slightly thicker bezels
- a single pill camera window, or show the front only
- a soft-satin frame in a Realm colour, not titanium/steel with an Apple-style button layout

### Putting live UI on the screen

| Technique | Crispness | Cost on a 610M | Occlusion / lighting | Notes |
|---|---|---|---|---|
| **drei `<Html transform occlude="blending">`** | DOM-crisp when facing the camera. drei notes it "may appear blurry" on some devices; the fix is to scale down the parent and up the children (https://drei.docs.pmnd.rs/misc/html) | A `matrix3d` style write every frame, plus a composited layer. Fine for 1-3 phones, but drei Html is known to collapse past ~50 elements (r3f discussion #3130) | `blending` punches a hole in the canvas, so glass glare and bloom can't sit *over* the UI the same way. No env reflections. | **Realm's own lesson:** a 30° CSS 3D tilt made a 125k-px-wide layer. A phone turning edge-on on scroll is the worst case for CSS 3D. Avoid it for rotation, OK for a flat "zoom into the screen" end-state. |
| **Pre-rendered screenshots → texture** (Playwright captures of real app screens at 2x, KTX2/UASTC or AVIF) | Excellent, if texel ≈ pixel at hero size | One upload, then free. KTX2 stays compressed in VRAM | Full 3D: glare, reflections and tone mapping all apply | **The default.** Swap textures to "navigate" the phone on scroll. |
| **`CanvasTexture`** (Canvas2D draws bubbles, avatars, text) | Good. Must `await document.fonts.load()` first or it bakes the fallback font | Each `needsUpdate` re-uploads the whole texture (1024×2048 RGBA = 8 MB, a few ms on an iGPU) | Full 3D | For the *live* bits (typing dots, a new message, a reaction counter) as a small 512×512 overlay mesh. Not the whole screen at 60 fps. |
| **`VideoTexture`** (H.264/VP9 screen recording) | Text softened by compression | Hardware decode plus one upload per frame. OK at 720×1560 | Full 3D | Good for a "real usage" clip in one phone. Can't theme-swap. Pause on the poster frame under reduced motion. |
| drei `<Text>` (troika SDF) and rounded-rect meshes | Resolution-independent | SDF built in a worker, then cheap | Full 3D | Good for a *stylised* UI that must stay sharp under extreme zoom. More work to look like the real app. |
| **`HTMLTexture` (three r184+)** on HTML-in-Canvas | Live DOM, crisp, accessible, interactive | Browser paints the DOM straight into the texture | Full 3D | Merged in three.js PR #31233 (milestone r184, 2026-04-10), so it is in Realm's 0.186. Chrome only: origin trial in M148-150. **Intent to Ship posted 2026-09-30 for M157** (blink-dev). WebKit is positive; Mozilla has no signal. **Use as progressive enhancement** with a screenshot-texture fallback. |

### Crisp screen text on an iGPU at 1.75-2x DPR

- **Size the texture to the on-screen footprint.** A hero phone ~360 CSS px tall × DPR 1.75 needs ~630 device px for its screen height, so 1024×2048 (or 768×1664, the 9:19.5 aspect) gives ~1.5 texels per pixel at rest.
- **Filtering:** `minFilter = LinearMipmapLinearFilter`, mipmaps on, `anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())`. Anisotropy is what keeps text legible when the phone turns 40-70°.
- **Colour:** `colorSpace = SRGBColorSpace` and `toneMapped={false}` on the screen material, so UI colours match the CSS exactly. Use `MeshBasicMaterial` for the screen: it is emissive by nature and needs no lighting cost.
- **Don't drop the whole page canvas to DPR 1** (Realm's current hero trick) when phones are the subject; the text will blur. Instead make the phone canvas **small**: a pinned stage of ~600×800 CSS px is 1.5 MP at 1.75x versus 4 MP full-screen. Or use drei `<View>` to scissor several phone stages into one canvas. Keep `PerformanceMonitor` + `AdaptiveDpr` to step down while scrolling fast (`regress()`), and back up at rest.
- `frameloop="demand"` plus `invalidate()` from the scroll timeline: when scroll stops, the GPU idles at 0 fps (r3f docs, https://r3f.docs.pmnd.rs/advanced/scaling-performance).

### How Apple and others do device rotations

- **Apple uses pre-rendered video or image sequences, not realtime 3D.** Realm's own survey of the AirPods Pro 3 page found 16 scroll-scrubbed `<video>` elements, CSS scroll timelines and **no WebGL** (`docs/research/2026-10-scroll-sites-survey.md`). The classic image-sequence-on-canvas technique is described at https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/.
  - **Pros:** photoreal, constant GPU cost.
  - **Cons:** 5-15 MB per sequence, decoded-frame memory (draw on demand, never pre-decode all frames), and the screen content is baked in.
- **For Realm, realtime wins**, because the screens must show the *current* theme and swap on scroll. Re-rendering a sequence per theme is a non-starter. Use pre-rendered video only for a one-off cinematic, such as the loader's macro shot.

### Recommendation for Realm

1. A procedural phone of 3 meshes:
   - **frame/back**: extruded rounded rect, `MeshPhysicalMaterial` with metalness 0.6, roughness 0.35, clearcoat 0.6
   - **screen**: `MeshBasicMaterial` with a KTX2 screenshot, `toneMapped={false}`
   - **glass**: a thin plane with a cheap custom fresnel and moving glare band; **not** `transmission`, which costs an extra full scene pass
2. Reflections come from a **Lightformer environment rendered once** (`<Environment resolution={256} frames={1}>` with 3-4 `<Lightformer>` strips). No HDR download, and PMREM is built once (Realm already pre-warms it).
3. Screens are pre-captured with Playwright from the real app per theme. A small `CanvasTexture` overlay handles the 1-2 live elements. `HTMLTexture` is behind feature detection for Chrome 157+.
4. GSAP ScrollTrigger drives `rotation.y`, `position` and the texture swap index (scrub, `ease: "none"`), with `invalidate()` per update.
5. Reduced motion: no scrub rotation. Phones sit at a fixed 3/4 angle and screens crossfade between states on section enter.

```tsx
// phone.tsx (sketch) — R3F 9 / three 0.186
const W = 0.72, H = 1.52, D = 0.075, R = 0.11, BEZEL = 0.028;
function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function useScreenGeometry() {
  return useMemo(() => {
    const g = new THREE.ShapeGeometry(roundedRect(W - BEZEL * 2, H - BEZEL * 2, R - BEZEL), 12);
    // ShapeGeometry UVs are raw x/y: remap to 0..1
    g.computeBoundingBox(); const b = g.boundingBox!, uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
    return g;
  }, []);
}
export function Phone({ screen }: { screen: THREE.Texture }) {
  const body = useMemo(() => new THREE.ExtrudeGeometry(roundedRect(W, H, R),
    { depth: D - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 4, curveSegments: 16 })
    .translate(0, 0, -(D - 0.02) / 2), []);
  const screenGeo = useScreenGeometry();
  const gl = useThree(s => s.gl);
  useLayoutEffect(() => { screen.colorSpace = THREE.SRGBColorSpace; screen.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy()); screen.needsUpdate = true; }, [screen]);
  return (
    <group>
      <mesh geometry={body}><meshPhysicalMaterial color="#1b1a22" metalness={0.6} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.2} /></mesh>
      <mesh geometry={screenGeo} position-z={D / 2 + 0.0005}><meshBasicMaterial map={screen} toneMapped={false} /></mesh>
      <mesh geometry={screenGeo} position-z={D / 2 + 0.001}><GlassGlareMaterial /></mesh>{/* additive fresnel band */}
    </group>
  );
}
// Scroll: one timeline, scrub, ease none; invalidate() in onUpdate. Swap `screen` by index from a preloaded KTX2 array.
// Progressive enhancement: if ('texElementImage2D' in WebGL2RenderingContext.prototype) use HTMLTexture(element).
```

## 3. Holographic / foil profile card

### References and what to take from each

- **simeydotme/pokemon-cards-css** (poke-holo.simey.me): the benchmark. It layers CSS gradients, `mix-blend-mode` (color-dodge, overlay, soft-light), filters, and texture masks (glitter, foil patterns). Pointer position drives custom properties; Svelte springs smooth the motion. **License: GPL-3.0** (https://github.com/simeydotme/pokemon-cards-css, read 2026-10-02), so **study it, don't copy it** into Realm's codebase.
  - Its spin-off **`hover-tilt`** (tilt + glare, Svelte or Web Component) is **MPL-2.0**. That is file-level copyleft: usable as a dependency, but changes to its files must stay open (https://www.npmjs.com/package/hover-tilt).
  - There is a React 19 / Next 16 port at https://github.com/twickstrom/hover-tilt (check its license before use).
- **"Building a holographic card"** (Suhail Razzak, Jan 2025, https://www.suhailrazzak.com/writing/holographic-cards): CSS only, three layers. Foil goes only on the border (SVG mask) and the art. The author applies gradients "tactically… in areas I thought made sense". That restraint is the right lesson.
- **Foil sticker shader** (Nikos Papadopoulos, 2025-08-30, https://www.4rknova.com/blog/2025/08/30/foil-sticker):
  - Thin-film is approximated as `thickness = min + range*(1-cosθ)`, then three phase-shifted sines give the colour.
  - Flakes come from a hash on scaled UVs that perturbs the normal before the env-map lookup.
  - Cheap, and works on an iGPU.
- **three.js `MeshPhysicalMaterial` iridescence** (physically based thin film, glTF `KHR_materials_iridescence`):
  - `iridescence` (0-1)
  - `iridescenceIOR` (1.0-2.333, default 1.3)
  - `iridescenceThicknessRange` (default `[100, 400]` nm)
  - `iridescenceMap` (R channel) and `iridescenceThicknessMap` (G channel), both `NoColorSpace`
  - Docs warn MeshPhysical has a "higher performance cost, per pixel" and should always have an env map (https://threejs.org/docs/pages/MeshPhysicalMaterial.html).
- **Apple AirPods Pro 3's iridescent ring**: Realm's own survey calls it the best real-world reference for a premium, not-rainbow iridescence (`2026-10-scroll-sites-survey.md`).

### CSS or WebGL?

- **CSS for the profile card on the page:** the text stays real DOM (crisp, selectable, accessible), it needs no canvas, and it is the cheapest on an iGPU. Pick this for the landing card and the in-app card.
- **WebGL (`MeshPhysicalMaterial` + masks) only when the card lives inside the 3D scene**, e.g. dealt in loader concept #3, or floating beside the phones. One plane at ~400×560 px with iridescence is affordable. Do not stack `transmission` or `clearcoat` on top.

### Keeping it premium, not rainbow "AI gradient"

1. **Narrow the hue range.** Real foils shift within a band: champagne-gold→rose, teal→violet, silver→ice. In WebGL, narrow `iridescenceThicknessRange` (e.g. `[280, 420]`) and lower `iridescenceIOR` to ~1.2. In CSS, use 2-3 stops in one hue family, **derived from the user's theme accent (±25° hue)**, not a full spectrum.
2. **Mask it.** Foil goes on the border, the name or badge, and a fine pattern (the user's chosen motif). Never the whole face. Text sits *above* the foil and must keep 4.5:1 contrast at the **worst** tilt angle (test the extremes).
3. **Texture, not bands.** Fine brushed lines or micro-glitter (a tiled 256-px flake normal map, `normalScale` 0.1-0.2) read as material. Smooth gradients read as "AI".
4. **Fresnel-gated.** Barely visible face-on, blooming at the tilt extremes. Glare is one soft white highlight at ≤0.35 opacity in `soft-light`/`overlay`.
5. **Small angles.** Max tilt 8-12° (Realm learned that big CSS 3D tilts explode layer sizes), with a spring (stiffness ~150, damping ~18) and a slow return on leave.

### Pointer and gyro

- Pointer: `pointermove` on the card maps to normalised `x,y ∈ [-1,1]`, which feeds a spring in one rAF. **Stop the rAF once the spring settles** (Realm's idle-CPU rule).
- Gyro (phones only): `DeviceOrientationEvent`. On iOS 13+ it needs `DeviceOrientationEvent.requestPermission()` from a tap, over HTTPS (https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static). Use an explicit "Tilt with your phone" toggle and never prompt on load. Android Chrome fires without a prompt. Clamp beta/gamma to ±20° and subtract the angle at start, so whatever posture the user holds is "neutral".
- **Reduced motion:** no tilt, no gyro. The foil is frozen at a flattering fixed angle, so it still looks premium. Keyboard focus may show the glare at a fixed position.

### Performance (CSS path)

- Per frame, change **only `transform` and `opacity`**.
- Don't animate `background-position` on gradients: it repaints every frame. Make the foil a 200%-size pseudo-element and **translate** it, so it stays composited.
- Scope the custom properties to the card element to keep style recalc local. `will-change: transform` only while it is hovered.
- `mix-blend-mode` composites on the GPU. Keep it to **≤3 blended layers** on an iGPU.

```css
.card { --rx: 0deg; --ry: 0deg; --gx: 0%; --gy: 0%; --a: 0;            /* set by JS spring */
  transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)); border-radius: 20px; overflow: hidden; isolation: isolate; }
.card .foil-wrap { position: absolute; inset: 0; overflow: hidden;          /* mask stays fixed to the card */
  mask: url(/foil/mask.svg) center / cover no-repeat;    /* one authored SVG: border ring + motif + badge; face stays clear */
  mix-blend-mode: color-dodge; opacity: calc(0.15 + var(--a) * 0.35); }
.card .foil { position: absolute; inset: -50%;                                /* 200% size, translated not repainted */
  background: linear-gradient(115deg, oklch(0.82 0.06 var(--h1)) 20%, oklch(0.88 0.08 var(--h2)) 45%, oklch(0.80 0.05 var(--h1)) 70%);
  transform: translate(var(--gx), var(--gy)); }
.card .glare { position: absolute; inset: 0; mix-blend-mode: soft-light; opacity: calc(var(--a) * 0.35);
  background: radial-gradient(circle at calc(50% + var(--gx)) calc(50% + var(--gy)), #fff8 0, transparent 45%); }
@media (prefers-reduced-motion: reduce) { .card { --rx: 4deg; --ry: -6deg; --gx: -8%; --gy: 4%; --a: .6; } }
```

(`--h1/--h2` come from the profile theme accent. The `glare` layer's radial centre does repaint, but it is one small layer. Swap it for a translated pseudo-element if profiling shows paint.)

**WebGL variant, if the card is in the scene:**

```tsx
<meshPhysicalMaterial map={cardArt} metalness={0.9} roughness={0.28} metalnessMap={foilMask}
  iridescence={1} iridescenceIOR={1.2} iridescenceThicknessRange={[280, 420]} iridescenceMap={foilMask}
  normalMap={flakes} normalScale={[0.15, 0.15]} envMapIntensity={1.1} />
```

`flakes` is a 256 px tiled normal map with `RepeatWrapping`. The env map is the same Lightformer environment as the phones.

## 4. Rich animated backgrounds (not AI slop)

### Library options (checked 2026-10-02)

| Option | License | Tech | iGPU notes | Look risk |
|---|---|---|---|---|
| **Stripe minigl / Whatamesh** (`whatamesh` 0.2.0) | **No license file.** The code derives from Stripe's site; the README thanks "stripe and kevinhufnagl.com" | Vanilla WebGL plane with noise displacement | Cheap | **High.** This *is* the 2020-22 Stripe gradient everyone cloned. Avoid on legal and taste grounds. |
| **ShaderGradient** (ruucm) | MIT | R3F 9 + three ≥0.158 + camera-controls. Has `pixelDensity`, `animate:'off'` | Medium (a displaced 3D plane). R3F is already in Realm's bundle | High with its presets (glossy purple/pink blobs). OK only with a custom palette. |
| **Paper Shaders** (`@paper-design/shaders-react` 0.0.81) | **Apache-2.0** | Zero-dependency WebGL2, one canvas per component | **Defaults are hostile to a 610M:** `minPixelRatio = 2` and `maxPixelCount = 1920*1080*4` (8.3 MP), read from `shader-mount.js`. On the owner's 2560×1600 @175% screen that is about 5.3 MP per frame. It does **auto-pause when off-screen** (IntersectionObserver) and on a hidden tab, and `speed={0}` cancels the rAF. **No fps cap**, so it runs at the display's 240 Hz. | Low-medium. Includes `grain-gradient`, `warp`, `god-rays`, `smoke-ring`, `neuro-noise`, `perlin-noise`, `paper-texture`, `fluted-glass`, `dithering`, `water`, `static-mesh-gradient`, `static-radial-gradient`. The grain and dither family read as *material*, not AI. |
| **Own shader in the existing R3F canvas** | ours | Domain-warped fbm (Inigo Quilez, `f(p + 4·q)` with `q = fbm offsets`, https://iquilezles.org/articles/warp) | Full control of resolution and fps. Realm already has the half-res render-target pattern (`sky.tsx`) | Depends on palette only. |

**Paper Shaders settings for Realm:**
- `maxPixelCount={960*600}`: renders ~0.58 MP and lets CSS upscale it. Soft fields hide the upscale, and grain on top hides the softness.
- Set `speed={0}` and drive `frame` from a 30 fps ticker, which caps the frame rate.
- Mount at most 1-2 shaders: each one is its own WebGL context.

### Making it rich without the purple-blue AI look

The "purple gradient problem" is a known tell. Adam Wathan's Aug 2025 apology for Tailwind UI's default `bg-indigo-500` is the usual citation (https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p). Rules:

1. **Pick a non-default anchor hue and earn it.** Warm ember/amber, oxblood/apricot, deep moss/teal with one warm accent, or ink/paper. No indigo→violet→pink 3-stop mesh, and no large slow-drifting soft blobs.
2. **Colour comes from content.** Each section's field takes the colour of the *profile theme on screen* (the scroll theme-swap section). The colour then means something; it isn't decoration.
3. **Use OKLCH with low chroma in large areas** (C ≤ 0.05 for fields) and high chroma only in small accents. Tint near-blacks (`oklch(0.15 0.015 h)`); never `#000`.
4. **Photographic and material cues beat vector cues:**
   - **static** film grain (opacity 0.04-0.07, `overlay`)
   - **light leaks** as pre-rendered, pre-blurred AVIF blobs moved by `transform`
   - halation around bright UI
   - paper or fluted-glass textures
   - dithering, which also fixes banding in 8-bit dark gradients
5. **Depth-blurred UI** (real app screens out of focus behind the hero) beats abstract shapes. **Bake the blur into the image.** Don't use `backdrop-filter` over an animated canvas: it re-blurs every frame.

### Scroll-tied section colour shifts

- **Cheapest and best:** if a canvas already renders, write the section colour as a **uniform**: lerp toward the target hue from `scrollY`, read per frame only. Realm's scroll rule is to measure on resize and read only `scrollY` per frame.
- **CSS:** scroll-driven animations (`animation-timeline: view()`). Chrome 115+; Safari 26 (WebKit guide, 2025-06-20, https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/). Gate with `@supports (animation-timeline: view())`.
  - **Animate `opacity` of stacked pre-coloured layers**, which stays on the compositor. Don't animate `background-color` of `<body>`: that repaints the whole viewport every scroll frame.

### iGPU cost tactics (Radeon 610M, Chrome/ANGLE D3D11)

| Tactic | How |
|---|---|
| Reduced resolution | Render the field into a render target at 0.25-0.5 scale and upscale with linear filtering. Draw sharp things (stars, text, UI) at full res on top. Realm's sky went from 22 ms to roughly half this way. |
| Frame cap | Accumulate rAF delta and render at 30 fps (24 is fine for slow fields). Without a cap, 240 Hz panels run 4-8× the work. In R3F use `frameloop="demand"` plus a 30 fps `setInterval(invalidate)` while visible. |
| Pause off-screen | Use scroll position against measured section bounds (Realm's `offscreen-still.tsx` pattern). Pause on `document.hidden`. |
| Warm compile | Domain-warp shaders compile slowly on D3D11. Route them through `warmScene` / `compileAsync`. |
| Static fallback | A pre-rendered AVIF of a good frame for `prefers-reduced-motion`, `Save-Data`, a low GPU tier (first-5-s frame times > 25 ms), and as the LCP-safe poster. |
| Fewer contexts | One shared canvas (drei `<View>`) rather than a canvas per section. |
| Banding | Add interleaved-gradient-noise dither in the shader (`+ (ign(gl_FragCoord.xy) - 0.5) / 255.0`). It is cheaper than a grain pass. |

### CSS-only alternatives (≈0 ms/frame when static)

- Layered `radial-gradient`s in OKLCH, **static**, plus a static grain tile (a 128 px PNG or a rasterised SVG `feTurbulence`) on a fixed pseudo-element.
- Motion comes only from `transform` on pre-blurred AVIF light-leak images. Animating gradient colours via `@property` repaints the full layer every frame; don't.
- Section colour changes as cross-fading pre-coloured layers on a scroll timeline.

**Recommendation:** one shared R3F background pass:
- domain-warped fbm, 2 octaves × 3 lookups, at **0.35 scale, 30 fps**, colour uniforms driven by the active profile theme;
- plus static grain and a dither line;
- plus 1-2 pre-blurred light-leak images moved by transform;
- reduced motion: the AVIF still per theme, cross-faded on section enter.

## 5. Meshy API

### Current endpoints (docs.meshy.ai, read 2026-10-02)

Base URL `https://api.meshy.ai`, `Authorization: Bearer <key>`. Every task supports `GET …/:id`, list, `DELETE`, and `GET …/:id/stream` (SSE).

- **Text to 3D: `POST /openapi/v2/text-to-3d`**
  - `mode:"preview"` (geometry): `prompt` ≤800 chars.
  - `ai_model`: `meshy-6-lite` | `meshy-6` | `meshy-7.1` | `latest` (= 7.1 since 2026-09-18).
  - `model_type`: `standard` | `smart-topology` (Meshy T2: "cleaner topology, natively separated parts", 100-15,000 faces) | `lowpoly` (**retires 2026-10-30**).
  - Also: `geometry_resolution` (`standard` | `2k` | `4k`, 7.1 only), `should_remesh`, `topology` (`quad` | `triangle`), `target_polycount` (100-300,000), `pose_mode`, `target_formats` (glb, obj, fbx, stl, usdz, 3mf).
  - `mode:"refine"` (texture): `preview_task_id`, `enable_pbr` (metallic/roughness/normal), `texture_resolution` 2k/4k/8k, `texture_prompt` or `texture_image_url`, `remove_lighting` (Meshy-6 only).
  - **`art_style`** (`realistic` | `sculpture`) is unsupported on Meshy-6+, "no longer documented", and planned for removal. `symmetry_mode`, `ultra_mode` and `is_a_t_pose` are deprecated. **`meshy-5` errors after 2026-10-10.**
- **Image to 3D: `POST /openapi/v1/image-to-3d`**
  - `image_url` (public URL or base64) or `input_task_id`, with the same model and geometry options.
  - Plus `should_texture`, `enable_pbr`, `texture_prompt`, `image_enhancement` (default true), `auto_size`, `decimation_mode` 1-4.
  - Multi-image: `POST /openapi/v1/multi-image-to-3d`.
- **Post-processing:**
  - `POST /openapi/v1/remesh` (`input_task_id` or `model_url`, `topology`, `target_polycount`, `resize_height`, `origin_at`, formats incl. `blend`)
  - Retexture, UV unwrap, rigging and animation (not needed here)

### Credit costs (pricing page, read 2026-10-02)

| Task | meshy-7.1 / 7 | meshy-6 | meshy-6-lite |
|---|---|---|---|
| Text-to-3D preview (mesh only) | 20 | 20 | 5 |
| Text-to-3D refine (texture 2K/4K, 8K) | 10 / 15 | 10 / 15 | 10 / 15 |
| Image-to-3D mesh only | 20 | 20 | 5 |
| Image-to-3D + 2K texture / 4K / 8K | 30 / 30 / 35 | 30 / 30 / 35 | 15 / — / — |
| Ultra geometry (7.1) | +5 | — | — |
| Smart-topology preview (`model_type: smart-topology`, Meshy T2) | 5 (any model) | | |
| Remesh / UV unwrap / convert | 5 / 5 / 1 | | |

- **Plans** (third-party summaries agree; Meshy's page lists only credits): Free 100 credits/mo; **Pro $20/mo, 1,000 credits, API included**; Studio $60/mo, 4,000 credits. So **a fully textured 7.1 model ≈ 30 credits ≈ $0.60**.
- **Ownership:** on paid plans "you own all assets you create". Free-plan output is **CC BY 4.0** (needs attribution) (https://www.meshy.ai/pricing).

### Quality: hard surface vs characters

- Meshy 7/7.1 improved *surface detail* (7.1 "Ultra 4K detail" launch, 2026-09-18). Reviewers note it **does not fix "messy topology and structural melting on hard-surface props"**: more triangles, same edge flow (https://blog.neural4d.com/comparisons/meshy-7-release-date-and-alternative/).
- In practice:
  - Soft, organic and fabric objects (cushions, plants, ceramics, food, characters) come out well.
  - Crisp product shapes (phones, controllers, cameras) come out with wobbly bevels, fused gaps, baked highlights and illegible micro-text.
- **Verdict for Realm:**
  - **Not for the phones or cards.** Procedural is crisper, lighter and theme-able.
  - **Worth it for 3-5 supporting "still-life" props** that would take days to model, *if* you:
    - use **Image-to-3D from an art-directed reference image** (better control than text)
    - remesh to 8-20k tris
    - **replace the materials in three.js** (keep Meshy's geometry and albedo; assign your own `MeshPhysicalMaterial` for metal, glass and ceramic so lighting matches the phones)
    - run gltf-transform (meshopt + KTX2) at **512 px textures**, per `scripts/shrink-glb.mjs`
  - Budget: 5 props × ~4 attempts × 35 credits ≈ 700 credits, so one Pro month.
- **Alternative already connected:** the Higgsfield MCP has `generate_3d` (image → GLB). Same caveats.

### Five props that read premium, not cartoony

Shared material language: matte glazed ceramic, bead-blasted anodised aluminium, frosted glass, bouclé, brass. Studio product photography, unbranded. Every prompt ends with the **suffix**:

> product photography, realistic proportions, unbranded, no text, no logos, clean bevels, matte finish, neutral grey seamless background, soft even studio light, 3/4 view

1. **The hangout sofa** (group spaces): "a low modular two-seat lounge sofa in cream bouclé fabric with deep rounded cushions and a slim walnut plinth base, soft tufted texture" + suffix. Soft goods are Meshy's strength. Use it as the "room" a friend group's phones gather around.
2. **Listening-party headphones** (voice rooms): "minimal over-ear wireless headphones, bead-blasted graphite anodised aluminium yokes, thick memory-foam ear cushions in charcoal knit fabric, seamless headband" + suffix. Override the yoke material with Realm's metal. Avoid any AirPods Max-like mesh canopy (trade dress).
3. **Two ceramic mugs, clinking** (hanging out): "two handmade stoneware mugs with speckled matte glaze, one sage green and one terracotta, slightly irregular hand-thrown rims, unglazed foot ring" + suffix. Organic imperfection reads crafted, not CG.
4. **The gathering lantern** (a group's "campfire"): "a modern camping lantern with a frosted glass cylinder, brushed brass top cap and base, a thin leather carry strap" + suffix. In three, swap the glass for an emissive inner core plus a frosted shell; it can glow in the group's theme colour.
5. **Keys to the realm** (invite-only): "a single brass key on a split ring with three small enamel keychain charms: a rounded star, a speech bubble and a tiny moon, glossy enamel with thin gold edges" + suffix. Charms can be re-coloured from profile themes.

**Backups:** a generic instant camera ejecting a photo (watch Polaroid/Instax trade dress); a vinyl record half out of a fabric sleeve; a houseplant in a ceramic pot.

```ts
// scripts/meshy.mjs (sketch) — image-to-3D, poll, download
const r = await fetch('https://api.meshy.ai/openapi/v1/image-to-3d', { method: 'POST',
  headers: { Authorization: `Bearer ${process.env.MESHY_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ image_url: dataUri, ai_model: 'meshy-7.1', should_texture: true, enable_pbr: true,
    texture_resolution: '2k', should_remesh: true, topology: 'triangle', target_polycount: 15000, target_formats: ['glb'] }) });
const { result: id } = await r.json();
// poll GET /openapi/v1/image-to-3d/:id until status === 'SUCCEEDED' (or use /stream SSE), then fetch model_urls.glb
// then: gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2 --texture-size 512
```

## Sources

All read 2026-10-02 unless a date is given.

**Loading, LCP, accessibility**
- Awwwards, Igloo Inc case study (abeto): https://www.awwwards.com/igloo-inc-case-study.html
- NN/g, Progress indicators (2014-10-26): https://www.nngroup.com/articles/progress-indicators/
- drei `useProgress`: http://drei.docs.pmnd.rs/loaders/progress-use-progress
- three.js `compileAsync` / `KHR_parallel_shader_compile` (r158): https://threejs.org/docs/pages/WebGLRenderer.html
- web.dev LCP: https://web.dev/articles/lcp
- W3C LCP spec: https://w3c.github.io/largest-contentful-paint/
- Chromium LCP changelog (M83 input/scroll stop, M86 opacity 0, M130 transparent text, M144 document opacity): https://chromium.googlesource.com/chromium/src.git/+/master/docs/speed/metrics_changelog/lcp.md
- DebugBear, opacity animations and LCP: https://www.debugbear.com/blog/opacity-animation-poor-lcp
- Chrome, view transitions in 2025: https://developer.chrome.com/blog/view-transitions-in-2025

**Phones and screens**
- three.js `RoundedBoxGeometry` source: https://github.com/mrdoob/three.js/blob/dev/examples/jsm/geometries/RoundedBoxGeometry.js
- drei `Html`: https://drei.docs.pmnd.rs/misc/html
- r3f discussion #3130 (Html at scale): https://github.com/pmndrs/react-three-fiber/discussions/3130
- R3F scaling performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- three.js PR #31233 `HTMLTexture` (merged 2026-04-10, r184): https://github.com/mrdoob/three.js/pull/31233
- blink-dev Intent to Ship HTML-in-canvas (2026-09-30, M157): http://www.mail-archive.com/blink-dev@chromium.org/msg17593.html
- webgpu.com on HTML-in-Canvas (2026-05-23): https://www.webgpu.com/news/google-html-in-canvas-webgl-webgpu/
- Apple Marketing Resources and Identity Guidelines: https://developer.apple.com/app-store/marketing/guidelines
- CSS-Tricks, Apple-style image sequences: https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/
- Realm survey: `docs/research/2026-10-scroll-sites-survey.md`

**Holo cards**
- pokemon-cards-css (GPL-3.0): https://github.com/simeydotme/pokemon-cards-css
- hover-tilt (MPL-2.0): https://www.npmjs.com/package/hover-tilt
- React port: https://github.com/twickstrom/hover-tilt
- Suhail Razzak, holographic cards (Jan 2025): https://www.suhailrazzak.com/writing/holographic-cards
- 4rknova, foil sticker shader (2025-08-30): https://www.4rknova.com/blog/2025/08/30/foil-sticker
- three.js `MeshPhysicalMaterial`: https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- MDN `DeviceOrientationEvent.requestPermission`: https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static

**Backgrounds**
- Paper Shaders (Apache-2.0, 0.0.81; defaults read from `dist/shader-mount.js`): https://github.com/paper-design/shaders
- ShaderGradient (MIT): https://github.com/ruucm/shadergradient
- Whatamesh: https://github.com/jordienr/whatamesh
- Inigo Quilez, domain warping: https://iquilezles.org/articles/warp
- WebKit, scroll-driven animations (2025-06-20): https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/
- DEV, Tailwind indigo / AI purple: https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p

**Meshy**
- Text to 3D: https://docs.meshy.ai/en/api/text-to-3d
- Image to 3D: https://docs.meshy.ai/en/api/image-to-3d
- Remesh: https://docs.meshy.ai/en/api/remesh
- Pricing: https://docs.meshy.ai/en/api/pricing
- Changelog (7.1 on 2026-09-18, T2 on 2026-08-13, meshy-5 retiring 2026-10-10): https://docs.meshy.ai/en/api/changelog
- Plans and licence: https://www.meshy.ai/pricing
- Hard-surface critique: https://blog.neural4d.com/comparisons/meshy-7-release-date-and-alternative/
