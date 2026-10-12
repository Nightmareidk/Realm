# Scroll animation techniques for the Realm landing page

Research date: 2026-10-02. Stack: Next.js 16, React 19, Tailwind 4, GSAP 3.15 + ScrollTrigger, React Three Fiber 9, drei 10, three 0.186.
Target floor: AMD Radeon 610M iGPU, Chrome on Windows (ANGLE D3D11), 2560x1600 at 175% (device pixel ratio 1.75, CSS viewport about 1463x914).
Hard constraints: prefers-reduced-motion and the site "Pause motion" switch; WCAG 2.2 AA; dyslexia/ADHD-friendly; content visible without JavaScript.

Status: complete (2026-10-02).

**Bottom line.** Native scroll, not Lenis, as the default (Lenis moves scrolling onto the main thread, which is the riskiest thing on this iGPU; `scrub: 0.6-1` gives most of the softness). CSS scroll-driven animations for the long tail of simple reveals (compositor-threaded in Chrome and Safari 26.4+, static in Firefox, which still hasn't shipped them in stable). GSAP for 3-4 choreographed set pieces only. WebGL reads scroll progress from refs and renders on demand. Every effect has a designed static state that is also the no-JS and reduced-motion layout.

## 1. Mental model

### 1.1 Two kinds of scroll animation

| | Scroll-triggered | Scroll-linked (scrubbed) |
|---|---|---|
| What drives time | The clock. Scroll only decides *when* it starts (or reverses). | The scrollbar. Progress 0 to 1 maps to a scroll range. |
| GSAP | `scrollTrigger: { trigger, start, toggleActions }` | `scrollTrigger: { trigger, start, end, scrub: true or a number }` |
| CSS | `IntersectionObserver` + class, or CSS `animation-trigger` (Chrome only, see section 3) | `animation-timeline: view()` / `scroll()` |
| Feel | Reveals, entrances, counters. Duration and easing are yours. | Parallax, pinned stories, image sequences, progress bars. Easing should mostly be `none`; the user's finger is the easing. |
| Reduced motion | Easy: snap to the end state or a short opacity fade. | Harder: the effect *is* the motion. Usually replace with a static end-state layout. |

Rule of thumb for Realm: **triggered for content, scrubbed for one or two set pieces.** A page where everything is scrubbed feels like wading through mud and punishes skimmers (ADHD-hostile). A page where nothing is scrubbed feels like a template.

`toggleActions` takes four words for onEnter, onLeave, onEnterBack, onLeaveBack. Default is `"play none none none"` (play once, never undo). `"play none none reverse"` replays when scrolling back up above the start. `once: true` kills the trigger after it fires, which also frees memory. (gsap.com/docs/v3/Plugins/ScrollTrigger, fetched 2026-10-02)

### 1.2 Timelines and progress

- One ScrollTrigger per *timeline*, never on tweens nested inside a timeline. A nested tween's playhead belongs to its parent; giving it its own ScrollTrigger creates a tug-of-war. (gsap.com/resources/st-mistakes, 2026-10-02)
- With scrub, a timeline's *durations become ratios*. A 1-second tween followed by a 3-second tween in a scrubbed timeline uses 25% and 75% of the scroll distance. Use `tl.to({}, {duration: 0.5})` or position parameters to add "dwell" (holds) so content rests long enough to read.
- The scroll distance is `end - start`. "Too fast" scrubs are fixed by increasing `end` (for example `"+=200%"`), not by changing durations.
- `self.progress` (0 to 1), `self.direction` (1 or -1) and `self.getVelocity()` (px/s) are available in `onUpdate`. Velocity drives skew/marquee effects (section 5).
- Starting values are recorded when a tween is created. Two ScrollTriggers animating the same property of the same element will make it jump. Fix: put both in one timeline, or use `fromTo()` / `immediateRender: false` on the later one.
- `start`/`end` strings are `"<trigger edge> <viewport edge>"`, e.g. `"top 80%"`. `"clamp(top bottom)"` (3.12+) keeps a start at or above 0 so the first section's scrub does not jump on load.
- Use function values plus `invalidateOnRefresh: true` for anything that depends on size: `end: () => "+=" + track.scrollWidth`, `x: () => -(track.scrollWidth - innerWidth)`.

### 1.3 Pinning internals

- `pin: true` wraps the pinned element in `<div class="pin-spacer">` sized to the element. While active, the element switches to `position: fixed` with fixed top/left/width/height. After the pin, it goes back in flow and gets a transform offset. (gsap.com/docs/v3/Plugins/ScrollTrigger)
- `pinSpacing` (default `true`) adds padding to the spacer's bottom equal to the pin distance, so the content after it is pushed down and "catches up" when the pin ends. `pinSpacing: false` makes the next section slide *over* the pinned one (the basis of sticky stacking). If the pin's parent is `display: flex`, `pinSpacing` defaults to `false`; wrap the pin in a block element to avoid surprises.
- Do **not** animate the pinned element itself (its transforms are measured). Pin a wrapper and animate its children.
- `pinType`: `"fixed"` is the default for the body scroller, `"transform"` for custom scrollers. Fixed renders more consistently and performs better.
- `anticipatePin: 1` pins slightly early based on velocity, hiding the one-frame flash that happens because the browser composites scroll on another thread before JS applies `position: fixed`. 1 is "typically fine".
- `pinReparent: true` moves the element to `<body>` during the pin. Needed only when an ancestor has `transform`, `filter`, `perspective`, `contain: paint` or `will-change: transform`, any of which creates a containing block that breaks `position: fixed`. It breaks descendant-selector CSS, so prefer removing the ancestor transform.
- `pinnedContainer`: set it on triggers that live *inside* a pinned section so their start/end account for the pin.
- Order matters: create ScrollTriggers top to bottom in page order, so pin spacing is included in later triggers' positions. If components mount out of order (lazy React sections), set `refreshPriority` (higher refreshes first). Docs say you should "VERY" rarely need it if you build top to bottom.
- CSS `position: sticky` is a perfectly good pin when you don't need pin-spacer math (no JS, works without hydration, no flash). Prefer sticky + a tall wrapper for simple stacked cards; use GSAP pins when you need the scroll distance tied to a timeline.

### 1.4 Scrub smoothing

`scrub: true` sets progress directly from scroll. `scrub: 0.5` or `1` makes the playhead take that many seconds to catch up, which smooths wheel "stair steps" on Windows mice (each notch jumps about 100 px). This gives most of Lenis's perceived smoothness without hijacking native scroll. Trade-off: anything with `scrub: 1` lags behind the page, so DOM content moving with scrub 1 next to content moving natively can visibly shear. Recommended: `scrub: true` for things locked to the layout (progress bars, pinned images), `scrub: 0.6` to `1` for atmospheric or 3D things (camera, background, parallax layers).

### 1.5 Snap

`snap: { snapTo: "labels" | 1/(n-1) | [..] | fn, duration: {min: 0.2, max: 0.6}, delay: 0.1, ease: "power3", directional: true, inertia: true }`. Defaults: ease `power3`, directional true, inertia true, delay is half the scrub value or 0.1 s. Snap fights the user if overused; only use it for a pinned "slides" section, keep `duration.max` low, and disable it under reduced motion and on touch if it fights momentum.

### 1.6 Horizontal sections (containerAnimation)

Pin a section, tween its track's `x` from 0 to `-(scrollWidth - innerWidth)` with `ease: "none"` and `scrub: true`. Child triggers that should fire as panels enter horizontally pass `containerAnimation: thatTween`. Requirements: the container tween must be linear (`ease: "none"`), and child triggers cannot pin or snap. (gsap.com/docs/v3/Plugins/ScrollTrigger)

### 1.7 batch

`ScrollTrigger.batch(".card", { onEnter: els => gsap.to(els, {autoAlpha: 1, y: 0, stagger: 0.08}), interval: 0.1, batchMax: 6 })` groups elements that enter in the same short window and gives the callback an array, so a grid row reveals as a stagger instead of 30 separate triggers firing individually. Callbacks receive `(targets[], scrollTriggers[])`. Use `once: true` or `onLeaveBack` reset as needed. (gsap.com/docs/v3/Plugins/ScrollTrigger/static.batch(), 2026-10-02)

### 1.8 matchMedia (breakpoints and reduced motion)

`ScrollTrigger.matchMedia()` is deprecated; use `gsap.matchMedia()`. One `mm.add({...conditions}, ctx => {...})` call can branch on `isDesktop`, `isMobile`, `reduceMotion`. When any condition toggles, everything created inside is reverted (inline styles removed, pins unwrapped) and the handler re-runs. A returned function runs as extra cleanup. (gsap.com/docs/v3/GSAP/gsap.matchMedia(), 2026-10-02)

For Realm's "Pause motion" switch, add a custom condition via a class: since matchMedia only takes media queries, wrap it as `mm.add({ reduce: "(prefers-reduced-motion: reduce)", ... })` and separately re-create the context when the site switch changes (useGSAP `dependencies: [paused]`, `revertOnUpdate: true`).

### 1.9 React cleanup (useGSAP / gsap.context)

- `"use client"` component; `gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)` once at module scope.
- `useGSAP(fn, { scope: ref, dependencies: [...], revertOnUpdate })` wraps `gsap.context()`. On unmount it reverts every tween, ScrollTrigger, Draggable and SplitText created inside, which matters because React Strict Mode runs effects twice in dev (two sets of pins and spacers otherwise). It uses `useLayoutEffect` on the client (no flash) and `useEffect` on the server.
- Anything created later (click handlers, timeouts, R3F callbacks) must be wrapped in `contextSafe()` or it leaks.
- Next.js App Router route changes do not reload the page. Each page's ScrollTriggers must be killed on unmount (useGSAP does this) and `ScrollTrigger.refresh()` should run after the new page's layout settles.
(gsap.com/resources/React and github.com/greensock/react, 2026-10-02)

### 1.10 Refresh (resize, fonts, images)

- ScrollTrigger auto-refreshes on `visibilitychange, DOMContentLoaded, load, resize` (resize debounced about 200 ms). Configure with `ScrollTrigger.config({ autoRefreshEvents })`.
- Anything that changes layout after `load` invalidates positions: lazy images without dimensions, web fonts swapping in, client-rendered sections, `<details>` opening, cookie banners. Fixes: give every `<img>`/`next/image` explicit width/height (or `aspect-ratio`), call `document.fonts.ready.then(() => ScrollTrigger.refresh())`, and call `ScrollTrigger.refresh()` from `onLoad` of late images or a `ResizeObserver` on the main content wrapper (debounced).
- `html { scroll-behavior: smooth }` breaks refresh calculations; ScrollTrigger docs recommend `scroll-behavior: auto` on `html` (smooth anchors can be done per-click instead).
- `ScrollTrigger.config({ ignoreMobileResize: true })`: on touch-only devices, vertical resizes under 25% of viewport height (the address bar) do not trigger a refresh, which stops pinned sections from jumping. (gsap.com/docs/v3/Plugins/ScrollTrigger/static.config(), 2026-10-02)

### 1.11 GSAP version notes

- 3.13 (2025-04-29): all plugins free incl. commercial use (SplitText, ScrollSmoother, MorphSVG, DrawSVG). SplitText rewritten, 50% smaller, adds `autoSplit` + `onSplit()`, `mask: "lines"|"words"|"chars"`, `deepSlice`, `propIndex`, and automatic `aria-label`/`aria-hidden`. CSS-variable tweening (`color: "var(--x)"`). (gsap.com/blog/3-13)
- 3.14 (2025-12-08): MorphSVG `smooth`; demo hub at demos.gsap.com. (gsap.com/blog/3-14)
- 3.15 (2026-04-13): `easeReverse` for directional easing (useful with `toggleActions: "play none none reverse"` so the reverse is not a slow ease-in); `yoyoEase` deprecated. (gsap.com/blog/3-15)

### 1.12 Timing and easing for triggered motion

- Emil Kowalski: UI animation should usually be under 300 ms, entering/exiting uses ease-out ("starts fast… quick response"), only transform/opacity, interruptible, purposeful, and CSS/WAAPI beats rAF libraries when the main thread is busy (emilkowal.ski/ui/great-animations, fetched 2026-10-02). Landing-page reveals can run longer (600-900 ms for a headline line stagger) because they are presentational, but each element's own motion should still feel quick: `expo.out` / `power3.out`, never `bounce`/`elastic` (the "cartoony" look the owner rejected).
- Scrubbed motion: `ease: "none"` on the timeline segments that track the finger; use easing only *inside* a segment for deliberate acceleration (e.g. the final push of a zoom).
- Reversal: with `toggleActions: "play none none reverse"`, set `easeReverse: true` (GSAP 3.15) so going back up reuses an ease-out rather than a sluggish ease-in.

### 1.13 No-JS and first paint

Never put hidden initial states (`opacity: 0`, `translateY`) in plain CSS: without JS, or before hydration, the content stays invisible (and crawlers/print/reader mode see nothing). Pattern:

1. A tiny blocking inline script in `<head>` sets `document.documentElement.dataset.motion = "on"` unless reduced motion or the saved "Pause motion" preference is set.
2. CSS hides reveal targets only under `[data-motion="on"] [data-reveal]`.
3. A safety timeout (e.g. 3 s) or a `<noscript>` style removes the attribute if GSAP never loads.
4. Animate with `gsap.to` from the CSS-hidden state. `gsap.from` inside `useGSAP` (a layout effect) is fine for below-the-fold elements, but with SSR the server HTML has *already painted* before hydration runs, so an above-the-fold `from()` shows a visible-hidden-visible flash. Above the fold, use the CSS gate from step 2.

## 2. Smooth scroll (Lenis vs native)

### 2.1 How Lenis works (v1.3.26, README fetched 2026-10-02)

1. Listens to `wheel` (and optionally `touch`) with a **non-passive** listener and calls `preventDefault()`, so the browser does not scroll by itself.
2. Accumulates the deltas into `targetScroll`.
3. Every frame (`lenis.raf(time)`), moves `animatedScroll` toward the target with `lerp` (default `0.1`) or `duration`/`easing` (default 1.2 s; ignored if `lerp` is set).
4. Calls `window.scrollTo(animatedScroll)`. The page *really* scrolls, so the scrollbar, `position: sticky`, find-in-page, focus scrolling, screen readers and keyboard keep working. When something else scrolls natively (keyboard, scrollbar drag, Ctrl+F, focus), Lenis just syncs to it.
5. Emits `scroll` events with `velocity`, `direction`, `progress`.

(github.com/darkroomengineering/lenis; edoardolunardi.dev/blog/building-smooth-scroll-in-2025-with-lenis, 2025-09-28)

Key options: `lerp`, `duration`, `smoothWheel` (true), `syncTouch` (false: phones keep native momentum), `wheelMultiplier`, `touchMultiplier`, `autoRaf` (false), `anchors` (false; set true or `{offset}`), `allowNestedScroll` (false; costs a DOM walk per event, prefer `data-lenis-prevent` on scrollable panes, modals and code blocks), `autoResize` (ResizeObserver), `stopInertiaOnNavigate`, `respectReducedMotion` (**true by default** in 1.3.x: lerp forced to 1 and programmatic scrolls jump; preference is picked up live).

Limitations from the README: no CSS scroll-snap (use `lenis/snap`); Safari capped at 60 fps (30 in Low Power Mode); smoothing stops over iframes; fixed elements lag on pre-M1 Safari; `syncTouch` unreliable on iOS < 16.

### 2.2 Sync with ScrollTrigger

```js
const lenis = new Lenis({ autoRaf: false, anchors: { offset: -80 } });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```

One RAF loop (GSAP's ticker) drives both, so ScrollTrigger always reads the position Lenis just wrote. `lagSmoothing(0)` stops GSAP from "pausing time" after a long frame, which would otherwise make the scroll stall and jump. In React use `lenis/react`'s `<ReactLenis root options={{ autoRaf: false }} ref={lenisRef}>` and add the ticker in an effect; remove it on unmount (`gsap.ticker.remove(fn)`).

If R3F also renders, do not run three RAF loops. Either drive R3F from the GSAP ticker (`frameloop="never"` + `advance(t)`), or keep R3F's loop and call `lenis.raf` from `useFrame` at a negative priority. Pick one master clock.

### 2.3 What Lenis costs (and why it matters on the 610M)

- **Scrolling moves to the main thread.** Native wheel scrolling is handled by the compositor thread and stays smooth even while JS is busy. With Lenis, each frame of scroll needs a free main thread. React hydration, a shader compile, a long `useFrame`, or a GC pause becomes a visible scroll freeze, not just a late animation. On an iGPU where the WebGL frame already eats most of the 16.7 ms, this is the single biggest risk.
- **Non-passive wheel listener** means the compositor must wait for JS on every wheel event (Chrome's "scroll-blocking listener").
- **Double inertia on precision touchpads and Magic Trackpads.** The OS already applies momentum; Lenis lerps on top, which reads as floaty or "drunk". Many users dislike it; some get motion-sick.
- **Users can't opt out** except through `prefers-reduced-motion`, which most people who dislike floaty scroll have not set.
- **Chrome on Windows already smooths wheel steps** natively (default since Chrome 49; developer.chrome.com/blog/smooth-scrolling-in-chrome-49). The "stepped" wheel problem Lenis solved in 2016 is mostly gone on Chromium.

### 2.4 GSAP ScrollSmoother (free since 3.13)

Different mechanism: content sits in a fixed wrapper and is moved with `matrix3d` transforms that "catch up" to the native scroll position. Consequences: `position: fixed` inside the content is fixed to the content (must live outside the wrapper), pins use transform pins, and every frame moves one giant layer. Offers `data-speed` / `data-lag` parallax. Touch smoothing off by default. (gsap.com/docs/v3/Plugins/ScrollSmoother, 2026-10-02). For Realm, Lenis is the better of the two if smoothing is used at all.

### 2.5 Recommendation for Realm

**Default: native scroll + `scrub: 0.6`-`1` on the effects that need softness.** This gets most of the "expensive feel" (the animations glide even when the wheel steps) with none of the main-thread or accessibility risk. Concretely:

- No Lenis on touch devices (phones and tablets keep native momentum; the address bar keeps working).
- If the owner insists on Lenis on desktop after seeing both: enable only for `(pointer: fine) and (prefers-reduced-motion: no-preference)`, only when the site "Pause motion" switch is off, with `lerp: 0.12` or higher (snappier, less float), `wheelMultiplier: 1`, `anchors: true`, `stopInertiaOnNavigate: true`, `data-lenis-prevent` on every inner scroller. `lenis.destroy()` when Pause motion turns on.
- Test with a Windows precision touchpad, not only a mouse. If it feels floaty on the touchpad, ship native.

### 2.6 Anchors, keyboard, focus

- Native: `scroll-margin-top` on targets handles the fixed header offset for anchors, focus and find-in-page. Keep `html { scroll-behavior: auto }` (ScrollTrigger needs it) and do smooth anchor jumps per click with `gsap.to(window, { scrollTo: { y: target, offsetY: 80 } })` (ScrollToPlugin) or `lenis.scrollTo`, then move focus to the target (`tabindex="-1"` + `focus({ preventScroll: true })`) so keyboard and screen-reader users land there too.
- Under reduced motion, anchor jumps must be instant (`duration: 0`).
- Keyboard scrolling (Space, PageDown, arrows, Home/End) is native in both modes. Never intercept these keys for "section snapping".
- Pinned sections and keyboard focus: see section 7.

### 2.7 iOS and Android notes

- Native touch momentum is what users expect. Don't smooth touch (`syncTouch: false`, ScrollSmoother `smoothTouch: false`).
- The address bar collapses and expands while scrolling, changing `innerHeight`. Use `ScrollTrigger.config({ ignoreMobileResize: true })` and size pinned/hero sections with `svh` (stable small viewport) rather than `vh`/`dvh` (see section 7).
- `ScrollTrigger.normalizeScroll(true)` moves touch scrolling to JS to stop the address bar from resizing the viewport and to fix pin jitter on fast flicks. GSAP's own docs list long-standing iOS bugs (misreported positions, address bar still forced in portrait, bounce persisting), disable it when the page is pinch-zoomed, and note mobile scrollbars stop auto-hiding. Treat it as a last resort for one problematic pin, not a default. (gsap.com/docs/v3/Plugins/ScrollTrigger/static.normalizeScroll(), 2026-10-02)

## 3. CSS scroll-driven animations

### 3.1 Syntax in one screen

```css
@keyframes rise { from { opacity: 0; translate: 0 24px; } to { opacity: 1; translate: 0 0; } }

.reveal {
  animation: rise linear both;          /* shorthand first: it resets animation-timeline */
  animation-timeline: view();           /* this element's position in its scrollport */
  animation-range: entry 10% cover 35%; /* start when 10% has entered, done at 35% of the full pass */
}
.progress { animation: grow linear both; animation-timeline: scroll(root block); }
```

- `scroll(<scroller> <axis>)`: scroller `nearest` (default), `root`, `self`; axis `block` (default), `inline`, `x`, `y`.
- `view(<axis> <inset>)`: tracks the subject crossing its scrollport; inset shrinks the "viewport" (e.g. `view(block 20% 0%)` ignores the top 20%, useful under a fixed header).
- Named timelines: `scroll-timeline: --t block`, `view-timeline: --card block`, and `timeline-scope: --card` on a common ancestor lets an element animate from a timeline defined on a non-ancestor (e.g. a sticky element driven by its tall wrapper).
- Ranges: `cover` (first pixel in to last pixel out), `contain` (fully inside, or fully covering), `entry`, `exit`, `entry-crossing`, `exit-crossing`. Range keywords also work inside keyframes (`entry 0% { … }`).
- Duration must be `auto` (or omitted); declare `animation-timeline` after the `animation` shorthand.
(developer.chrome.com/docs/css-ui/scroll-driven-animations, fetched 2026-10-02)

### 3.2 Support as of 2026-10-02

From MDN browser-compat-data (main branch, fetched 2026-10-02):

| Feature | Chrome/Edge | Safari (macOS + iOS) | Firefox |
|---|---|---|---|
| `animation-timeline`, `scroll()`, `view()`, `animation-range`, `scroll-timeline`, `view-timeline` | 115 (Jul 2023) | 26 (Sep 2025) | **"preview" only** (Nightly; not in stable as of Firefox 157, released 2026-09-29) |
| `timeline-scope` | 116 | 26 | preview |
| `animation-trigger` / `timeline-trigger` (scroll-*triggered*, not scrubbed) | 146 (2026-03-10) | no | no |
| `trigger-scope` | 147 | no | no |

Notes:
- Safari 26.4 (2026-03-24) made scroll-driven animations **threaded** (run on the compositor) for `opacity`, `transform`, `translate`, `scale`, `rotate`, `filter`, `backdrop-filter` and motion-path properties; they stay smooth while the main thread is busy and update with the scroll on ProMotion displays. (webkit.org/blog/17862, 2026-03-24)
- Chrome runs `transform`/`opacity` (and some `filter`) scroll-driven animations on the compositor; layout properties (`width`, `height`, `top`) force main-thread work. Tokopedia measured CPU while scrolling dropping from 50% to 2% after switching from JS scroll handlers. (developer.chrome.com/blog/css-ui-ecommerce-sda, 2024-05-07)
- Scroll-driven animations are an **Interop 2026** focus area (webkit.org/blog/17818, 2026-02-12), so Firefox shipping is expected but not guaranteed by the time Realm launches. Treat Firefox as "no support" and design for it.
- Third-party roundups disagree on Firefox status; trust MDN BCD and Firefox release notes, not blog posts.

### 3.3 Scroll-triggered CSS (Chrome 146+)

```css
.card { timeline-trigger: --in view() entry 20% / exit 0%; }
.card { animation: rise 600ms cubic-bezier(.2,.7,.2,1) both; animation-trigger: --in play-forwards play-backwards; }
```

Actions: `play-forwards`, `play-backwards`, `play`, `play-once`, `pause`, `reset`, `replay`, `none`. It's IntersectionObserver-in-CSS with a fixed duration, potentially run off-thread. Chrome-only, so only usable as an enhancement on top of a JS or no-animation baseline. (utilitybend.com, 2026-02-12; developer.chrome.com/release-notes/146)

### 3.4 When to prefer CSS over GSAP

Prefer CSS scroll-driven animations for:
- Per-element reveals (opacity + translate), image parallax inside a frame, reading-progress bars, header shrink/blur on scroll, simple clip-path wipes.
- Anything above the fold or early in the page, because it works **before hydration** and with JavaScript disabled, and keeps running smoothly while React hydrates and the WebGL scene compiles shaders. On the 610M this matters most during the first 2 seconds.
- Many small things: 40 CSS view timelines cost far less than 40 ScrollTriggers each running `onUpdate` on the main thread.

Prefer GSAP for:
- Pinned, choreographed sequences (a timeline with holds, labels, snap).
- Anything whose output is not a CSS property: canvas image sequences, WebGL uniforms and camera, counters, SplitText line staggers, velocity effects.
- Effects that must look identical in Firefox.
- Things that need callbacks (analytics, lazy-mounting the 3D scene, pausing video).

Mixing is fine: CSS for the long tail, GSAP for 2 to 4 set pieces. Never drive the same property of the same element from both.

### 3.5 Progressive enhancement pattern

```css
/* Baseline: everything visible and static. No hidden states anywhere outside these guards. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    :root:not([data-motion="off"]) .reveal {
      animation: rise linear both;
      animation-timeline: view();
      animation-range: entry 10% cover 30%;
    }
  }
}
```

- Firefox and older browsers get the static, fully visible layout. Optionally add an IntersectionObserver class toggle for them, but do not ship the scroll-timeline polyfill (it is main-thread JS and Chrome's own case-study page warns it needs extra testing with frameworks).
- `[data-motion="off"]` is the site-level "Pause motion" switch, set on `<html>` by the inline head script from `localStorage` so it applies before first paint.
- JS feature detection: `CSS.supports("animation-timeline: view()")`. The JS equivalent is `new ScrollTimeline({ source: document.documentElement })` / `new ViewTimeline({ subject })` with `el.animate(keyframes, { timeline, rangeStart: "entry 10%", rangeEnd: "cover 30%" })`.
- Gotchas: `view()` measures the subject's layout box, not its transformed box, so animating `transform` on the subject does not feed back into its own timeline (good). A `position: sticky` subject has a weird view timeline (it stops moving); put the `view-timeline` on its tall wrapper and use `timeline-scope`. `overflow: hidden` makes an element a scroll container, so `view()` / `scroll(nearest)` inside it binds to that box and never progresses; use `overflow: clip` for decorative cropping (it does not create a scroll container). The same `overflow: hidden` trap breaks `position: sticky`.

## 4. WebGL + scroll (R3F)

### 4.1 Two ways to get scroll into a scene

**A. drei `ScrollControls` (do not use for Realm's landing).** It creates its own HTML scroll container *over* the canvas (`pages`, `damping` default 0.2 s, `distance`, `horizontal`, `maxSpeed`) and exposes `useScroll()` with `offset`, `delta`, `range(from, len)`, `curve(from, len)`, `visible(from, len)`. Content goes in `<Scroll>` (3D) or `<Scroll html>` (DOM). It is great for a one-screen 3D story, but the page's real document does not scroll, so native scrollbar, find-in-page, anchors, SEO structure and no-JS content all suffer. drei's own docs note it uses a custom overlay rather than native scroll. (drei.docs.pmnd.rs/controls/scroll-controls, 2026-10-02)

**B. Native page scroll → plain object/ref → read in `useFrame` (recommended).** The DOM document is the source of truth. GSAP (or a CSS-free scroll read) writes numbers into a mutable object; the render loop reads them. No React state per frame.

```tsx
const rig = useRef({ p: 0, vel: 0 });               // shared, mutable, never setState
useGSAP(() => {
  ScrollTrigger.create({
    trigger: "#story", start: "top top", end: "bottom bottom",
    onUpdate: (st) => { rig.current.p = st.progress; rig.current.vel = st.getVelocity(); },
  });
});
// inside <Canvas>
useFrame((_, dt) => {
  easing.damp(mesh.current.rotation, "y", rig.current.p * Math.PI * 2, 0.25, dt); // maath
});
```

Alternatively animate the proxy with a scrubbed timeline (`tl.to(cam, {x, y, z, ease: "none"})`) and copy it to the camera each frame; this is how the Codrops "Cinematic 3D scroll" tutorial structures it, with `scrub: 1` and custom eases per shot. (tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap, 2025-11-19)

Rules (r3f.docs.pmnd.rs/advanced/pitfalls, 2026-10-02): never `setState` in `useFrame`; mutate refs; use `delta` so speed is refresh-rate independent (the owner's display runs about 240 Hz, see memory notes); don't allocate `Vector3`s per frame; prefer `visible={false}` over unmounting (unmount = recompile shaders, which on this iGPU is a multi-second freeze).

### 4.2 Render only when something changed

- `frameloop="always"` (R3F default) renders at the display rate. On a 240 Hz panel that is 240 full renders a second at idle. Realm already hit this (idle main thread 68-85% busy).
- `frameloop="demand"` renders only after `invalidate()`. With scroll-linked scenes: call `invalidate()` from the ScrollTrigger `onUpdate`, and from `useFrame` while a damped value is still settling (`if (Math.abs(target - current) > 1e-4) invalidate()`).
- `frameloop="never"` + `advance(time)` lets GSAP's ticker be the single clock: `gsap.ticker.add((t) => advance(t * 1000))` (inside a component using `useThree((s) => s.advance)`). Combine with a frame cap: skip `advance` unless 1/60 s has passed, which halves or quarters GPU work on high-refresh panels.
- Offscreen pausing: when the canvas's section is out of view, set `frameloop` to `"never"` via `useThree((s) => s.setFrameloop)`. Derive visibility from ScrollTrigger `onToggle` (it already computes it) rather than an IntersectionObserver over animated subtrees, which Realm measured as forcing per-frame intersection work. Also pause on `document.visibilityState === "hidden"` (rAF already throttles, but GSAP tweens that write uniforms keep running).
- `dpr={[1, 1.5]}` cap, start at 1, and use `<PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.25)}>` with bounds so it does not ping-pong. `regress()` + `performance={{ min: 0.5 }}` drops resolution during fast scroll and restores it at rest; on this iGPU this is the single most effective lever because fill rate (pixels shaded) is the bottleneck. (r3f.docs.pmnd.rs/advanced/scaling-performance, 2026-10-02)

### 4.3 Camera paths on scroll

```tsx
const curve = useMemo(() => new CatmullRomCurve3(points, false, "catmullrom", 0.5), []);
const look = useMemo(() => new Vector3(), []);
useFrame((_, dt) => {
  const t = rig.current.p;                       // 0..1 from ScrollTrigger
  curve.getPointAt(t, tmp); easing.damp3(camera.position, tmp, 0.3, dt);
  curve.getPointAt(Math.min(t + 0.02, 1), look); camera.lookAt(look);
});
```

- `getPointAt` (arc-length parameterised) gives constant speed; `getPoint` speeds up between far-apart control points.
- Damp position *and* look target, or the view snaps on direction reversal.
- Clamp total rotation; big yaw while the user scrolls is the classic vestibular trigger (section 7). Keep camera motion mostly dolly/truck, small angular change.
- Reduced motion: no camera path. Render the end-state composition (or 3 static "shots" crossfaded on section entry).

### 4.4 Scroll-driven uniforms

- Feed `uProgress` (0-1) and `uVelocity` (signed, clamped, damped) as uniforms. Reveal, dissolve, RGB-shift or wave amplitude read them in the shader. Damp velocity in JS (`v += (target - v) * 0.1`) and clamp to, say, ±1 so a fast flick doesn't produce a strobe.
- `gsap.to(material.uniforms.uReveal, { value: 1, scrollTrigger: {...} })` works directly because GSAP can tween any object's `value`.
- Keep shaders cheap on the iGPU: noise at half resolution into a render target, upscale (Realm's existing rule).

### 4.5 DOM + canvas mixing

| Approach | What it is | Cost on the 610M | Use for |
|---|---|---|---|
| **In-flow canvas** per section | A normal `<Canvas>` inside a section, sized by CSS, scrolls with the page | Lowest. Only paints when on screen; browser scrolls it like an image. A second WebGL context per extra canvas though. | One hero object, one device mockup |
| **Fixed full-screen canvas behind the DOM** | `position: fixed; inset: 0; z-index: -1`, scene reacts to scroll | Full-viewport fill every frame (about 1463x914 CSS px x 1.75^2 = 4.1 M device px at DPR 1.75). Composited under everything. | Ambient background that persists across sections (sky, particles). Must be cheap and DPR-capped. |
| **drei `View` + one fixed canvas** | One canvas, `gl.scissor` per tracked DOM element; `<View>` in the DOM, `<View.Port />` in the Canvas, `eventSource` on a shared parent | One context, renders only scissored areas, but positions are read from the DOM each frame and the canvas is still full-screen and fixed | Several 3D "cards" in a grid, product panels (drei.docs.pmnd.rs/portals/view) |
| **r3f-scroll-rig** (14islands) | `GlobalCanvas` behind the DOM, `UseCanvas` tunnel, `ScrollScene` tracks DOM proxies via `useTracker` (IntersectionObserver + ResizeObserver, rect measured once), Lenis-based `SmoothScrollbar`; `frameloop="demand"` renders only in-view meshes | Same as fixed canvas; relies on Lenis to keep DOM and WebGL in lock-step | Image-to-WebGL galleries where the DOM `<img>` stays as the accessible, no-JS fallback (github.com/14islands/r3f-scroll-rig) |
| **drei `Html` (`transform`)** | DOM nodes positioned by CSS 3D matrices from the 3D scene | Main-thread DOM writes every frame; `occlude` adds raycasts per frame | Small labels, not paragraphs. Never put real copy only inside `Html`. |

Sync gotcha: a fixed canvas reading `scrollY` updates one frame after the compositor has already scrolled the DOM, so 3D objects that must line up with DOM elements visibly "swim" by a few pixels during fast native scroll. That is exactly why Lenis-plus-fixed-canvas setups exist (both moved on the main thread in the same frame). Avoid the need: don't pixel-align WebGL to DOM boxes. Let 3D be atmospheric (background, a hero object in its own in-flow canvas) and keep text in the DOM.

### 4.6 Recommendation for Realm

- Hero: one in-flow canvas (or the existing hero canvas) with `frameloop="demand"`, DPR [1, 1.5] adaptive, paused when its ScrollTrigger is inactive. Scroll progress through the hero (0-1) drives camera dolly + one uniform, `scrub: 0.8` for softness.
- Any later 3D (device rotation) gets its own in-flow canvas that mounts *idle* (warmed, `frameloop="never"`) near the viewport and only renders while its pin is active. Do not unmount/remount it.
- All text, headings and CTAs are DOM, server-rendered, readable without JS and without WebGL.

## 5. Effect catalogue

Each entry: how to build it, what goes wrong, what reduced motion / "Pause motion" gets. "RM" = reduced motion.

### 5.1 SplitText reveals (free since 3.13)

- Build: `SplitText.create(el, { type: "lines", mask: "lines", autoSplit: true, onSplit: (s) => gsap.from(s.lines, { yPercent: 110, duration: 0.9, stagger: 0.08, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } }) })`. `mask` wraps each line in an overflow-clip parent so lines slide up from behind an invisible edge. `autoSplit` re-splits on font load and width changes; return the animation from `onSplit` so SplitText can clean it up and keep its time on re-split. `propIndex` adds `--line: n` / `--word: n` for CSS-driven staggers. Split only after `document.fonts.ready` (or use `autoSplit`). Split as little as possible: `type: "lines"` or `"words, lines"`, not chars. (gsap.com/docs/v3/Plugins/SplitText, 2026-10-02)
- **Accessibility is the big pitfall.** SplitText's default `aria: "auto"` puts `aria-label` on the container and `aria-hidden` on the pieces. Adrian Roselli tested 8 screen reader/browser pairs and it only worked in 2 (NVDA/Firefox, TalkBack/Chrome); JAWS/Chrome, Narrator/Edge, VoiceOver on macOS and iPadOS all failed. `aria-label` is prohibited on generic `div`/`span`/`p`, may not be auto-translated, and creates WCAG 2.5.3 Label-in-Name risk. Letter splitting is the worst case. (adrianroselli.com/2026/02/you-know-what-just-dont-split-words-into-letters.html, 2026-02-05, updated 2026-04-01)
- Realm rule: split **lines (or words) only, never chars**, for display headings only, never body copy. Use `aria: "none"` and render the heading text twice: a visually hidden real copy (`.sr-only`) and the split copy with `aria-hidden="true"`. Or `s.revert()` in the animation's `onComplete` so the final DOM is plain text again (also fixes browser translation and copy-paste). Both is best.
- RM: no split at all, heading is static; or a 200 ms opacity fade.
- Dyslexia: animating per-line keeps word shapes intact; per-char animation scrambles word shape while it moves. Keep reveal under about 900 ms total so text is readable quickly.

### 5.2 clip-path and mask reveals

- Build: `gsap.fromTo(img, { clipPath: "inset(12% 12% 12% 12% round 24px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: img, start: "top 80%", end: "top 20%", scrub: true } })`. Same number and type of points in from/to or GSAP can't interpolate. Polygons for diagonal wipes; `circle(0% at 50% 50%)` to `circle(75% ...)` for iris reveals.
- Cost: in Chrome, `clip-path` animations still repaint (clip-path and background-color compositing has been "coming" since developer.chrome.com/blog/hardware-accelerated-animations, 2021-02-22). A full-width image re-rastered every scroll frame is expensive at 1.75 DPR. Cheaper equivalent: an outer wrapper with `overflow: clip` animated with `scale`, and the inner image counter-scaled (`scale: 1/s`) so it appears uncropped; both are transforms.
- `mask-image` gradient wipes (animating `mask-position` / `mask-size`) also repaint; use for small elements only.
- RM: show final state.

### 5.3 Sticky stacking cards

- Build (no JS baseline): each card `position: sticky; top: calc(10svh + var(--i) * 16px)` inside a tall list. Enhancement: as card N+1 arrives, card N scales to 0.94 and dims; drive with CSS `view()` on the *next* card via `timeline-scope`, or GSAP `scrub` per card. Fade the dim with an overlay's `opacity`, not `filter: brightness()` (filter forces a repaint per frame on large layers).
- Pitfalls: any ancestor with `overflow: hidden` kills sticky (use `clip`); cards must have opaque backgrounds; last card needs bottom spacing; heavy shadows under each card cost raster memory (Realm already measured drop-shadow costs; use one pre-blurred shadow image or none).
- RM: keep the sticky stacking (it is plain scrolling, not animated motion) but drop the scale/dim.

### 5.4 Horizontal galleries

- Build: pin the section, scrub the track's `x` to `() => -(track.scrollWidth - innerWidth)` with `ease: "none"`, `end: () => "+=" + (track.scrollWidth - innerWidth)`, `invalidateOnRefresh: true`. Child effects use `containerAnimation`. (section 1.6)
- Pitfalls: vertical-scroll-to-horizontal-motion mapping is a known disorientation trigger; keyboard/screen-reader users tabbing into off-screen panels jump unpredictably (section 7); on phones a long pin feels like a dead page. Precision touchpads send horizontal deltas too; don't fight them.
- Alternative for Realm: a **native horizontal scroller** (`overflow-x: auto; scroll-snap-type: x mandatory`) with visible prev/next buttons. Accessible by default, works without JS, trackpad and touch native. Use the pinned version only on `(min-width: 1024px) and (pointer: fine)` and only if the content is short (3-5 panels).
- RM: render panels as a vertical stack or the native scroller.

### 5.5 Apple-style image sequences

- How Apple does it: a `<canvas>` flipbook. AirPods Pro used 148 JPG frames; CSS-Tricks' rebuild weighed 55.8 MB over 1,609 requests, and Apple served a single still on slow connections (about 347 KB). (css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages, 2020-05-22). GSAP publishes an `imageSequenceScrub` helper that tweens a frame index and draws to a canvas (gsap.com/docs/v3/HelperFunctions/helpers/imageSequenceScrub).
- Frame budget for Realm: 60-90 frames is enough for a 1-1.5 viewport scrub (people don't perceive a missing frame when scrubbing). Size frames to the canvas's *device* pixels at DPR 1 to 1.25, not 1.75 (e.g. 1280x800). AVIF or WebP at quality ~60: roughly 40-90 KB each, so 3-7 MB total.
- Memory: a decoded frame costs width x height x 4 bytes. 1280x800 = 4.1 MB, so 90 decoded frames = 370 MB. Keep encoded blobs in memory and decode a sliding window (current ±10) with `createImageBitmap()` (decodes off the main thread), `bitmap.close()` the rest. Never `drawImage` an undecoded `<img>` on scroll: it triggers a synchronous decode, the classic sequence stutter.
- Draw only when the frame index changes; skip if the same as last time. Sequence canvas: `{ alpha: false }` context if the frames are opaque.
- Preload strategy: load frame 0 eagerly (it is also the `poster`/no-JS image), load the rest only after the hero is interactive and when the section is within ~2 viewports, keyframe-first order (0, 45, 90, 22, 67, ...) so a fast scroller sees a coarse version instead of blanks.
- Video alternative: scrubbing `video.currentTime` stutters unless every frame is a keyframe (`ffmpeg -g 1`, roughly 2x file size; `-g 2` is a compromise), and decoding a keyframe per scroll tick is expensive. Canvas sequences are frame-accurate by construction. (muffinman.io/blog/scrubbing-videos-using-javascript; gist jeffpamer "Smooth Scrubbing Web Video FFMPEG Mega Command")
- RM / Save-Data / slow connection (`navigator.connection.saveData`, `effectiveType`): show the single best still.

### 5.6 3D device rotations

- Options, cheapest first: (1) CSS 3D on a screenshot: `perspective: 1200px` on a parent, scrub `rotateX` 18deg to 0 and `scale` 0.9 to 1 (the "tilted phone/laptop flattens as it arrives" Linear/Stripe move). Keep angles small: Realm measured a 30deg tilt creating a 125k px wide layer; 14deg fixed it. (2) Pre-rendered image sequence of the device turning (5.5). (3) R3F GLB in an in-flow canvas: Draco/meshopt geometry, KTX2 or 512 px textures (Realm cap), one environment map, `frameloop="never"` until its pin is active, rotation from scroll progress damped in `useFrame`.
- Screen content: a static texture per step, swapped on step change. Avoid `VideoTexture` on the iGPU (uploads a full frame every frame).
- Pitfalls: warm-compile the model's shaders before the section is reached (Realm's `warmScene`), or the first scroll into it freezes 0.5-2 s. Rotation more than about 90deg tied to scroll is a vestibular trigger; prefer 20-40deg total.
- RM: static render at the "hero angle".

### 5.7 Parallax

- Build: CSS `view()` is ideal (`translate: 0 var(--from) → 0 var(--to)` with `animation-range: cover`), or GSAP `yPercent` with `scrub: true`. Image parallax inside a frame: image 115% tall, translate within an `overflow: clip` frame.
- Pitfalls: keep displacement small (10-15% of the element height); several layers moving at different speeds is the textbook vestibular trigger (WCAG 2.3.3 cites parallax). Large parallax layers with `will-change` all at once = layer explosion.
- RM: no parallax.

### 5.8 Zoom-through transitions

- Build: pin a section, scrub `scale` from 1 to about 12-20 on an SVG/text mask (e.g. "zoom into the Realm logo's portal"), crossfade into the next scene at the end. Use an SVG `<mask>` with `transform-origin` set to the focal point, or a big element scaled with `transformOrigin: "50% 42%"`.
- Pitfalls: scaling a *rasterized* layer 20x is blurry if `will-change: transform` is set (Chrome rasterizes at the starting scale), and very expensive if not (re-raster at every scale step; huge tiles; memory spikes, cf. Realm's 700 MB tile-cache growth note). Prefer: scale a small vector (SVG) or a WebGL plane, or fake it with two images (zoom the first by 1.5x while crossfading to a pre-zoomed second). Keep it short (one viewport) and centered (no lateral swing).
- RM: replace with a quick crossfade.

### 5.9 Counters

- Build: `gsap.to(obj, { val: 1200000, duration: 1.4, ease: "power2.out", snap: { val: 1 }, onUpdate: () => el.textContent = fmt.format(obj.val), scrollTrigger: { trigger: el, start: "top 85%", once: true } })`. `font-variant-numeric: tabular-nums` so digits don't jitter width. `Intl.NumberFormat` for locales.
- Pitfalls: the SSR HTML must contain the **final** number (no-JS, crawlers, screen readers). Animate from 0 only visually: put the real number in a `.sr-only` span and the animated one `aria-hidden`. Never `aria-live` a counter. Only count real, meaningful numbers (a fake "users online" counter is the kind of thing the owner calls slop).
- RM: final number, no count.

### 5.10 Velocity marquee / skew

- Build: an infinite marquee via GSAP's `horizontalLoop` helper (or two copies of the row, `xPercent: -50`, `repeat: -1`, `ease: "none"`). On `ScrollTrigger.create({ onUpdate: s => ... })` read `s.getVelocity()`, set `loop.timeScale(1 + clamp(-3, 3, v / 300))` via `gsap.to(loop, { timeScale: ..., overwrite: true })`, ease back to 1 at rest. Skew: `const skewTo = gsap.quickTo(el, "skewY", { duration: 0.4, ease: "power3" }); skewTo(clamp(-6, 6, v / -400))`. (gsap.com forum "Skew on scroll velocity", ScrollTrigger demos)
- Pitfalls: pause the marquee when off-screen and when Pause motion is on (WCAG 2.2.2 requires a pause mechanism for auto-moving content that lasts more than 5 s). Skew on text hurts readability, especially for dyslexic readers; skew images or decorative rows only, max about 4-6deg. A marquee of logos/"as seen on" claims Realm doesn't have is slop.
- RM: static row (wrapping or horizontally scrollable).

### 5.11 Section colour transitions (dark to light, mood shifts)

- Build: trigger, don't scrub. `ScrollTrigger.create({ trigger: sec, start: "top 50%", end: "bottom 50%", onToggle: s => s.isActive && gsap.to(root, { "--bg": sec.dataset.bg, "--fg": sec.dataset.fg, duration: 0.6 }) })` (CSS-variable tweening is supported since 3.13).
- Cost: animating `background-color` on `<body>` repaints the whole viewport every frame of the tween. Cheaper: a fixed full-screen backdrop stack where each colour is its own layer and you crossfade `opacity` (compositor-only).
- Pitfalls: intermediate colours can fail contrast for a few hundred ms; keep it short (400-600 ms) and make both endpoints AA-compliant (4.5:1 body, 3:1 large text/UI). Don't flash between very bright and very dark (photosensitivity; WCAG 2.3.1 is about flashes, but big luminance swings are uncomfortable for many).
- RM: instant colour change (it is information, not decoration) or 150 ms fade.

### 5.12 SVG path drawing

- Build: `gsap.fromTo(path, { drawSVG: "0%" }, { drawSVG: "100%", ease: "none", scrollTrigger: { trigger, start: "top 70%", end: "bottom 60%", scrub: true } })`. DrawSVGPlugin animates `stroke-dasharray`/`stroke-dashoffset`; stroke must exist; Firefox may miscalc length (use 102%); iOS Safari mis-renders `<rect>` strokes (convert to path); can't animate inside `<use>`. (gsap.com/docs/v3/Plugins/DrawSVGPlugin, 2026-10-02). No-plugin version: `pathLength="1"` + `stroke-dasharray: 1; stroke-dashoffset: 1 → 0` (works with CSS `view()` too).
- Pitfalls: keep the SVG small in screen area (each frame repaints it); `vector-effect: non-scaling-stroke` if the SVG scales. A connecting line that "travels" between sections works as a wayfinding device (good for ADHD) if subtle.
- RM: path fully drawn.

### 5.13 GSAP Flip

- Build: capture `Flip.getState(el)`, change layout (move the hero phone into a grid cell / toggle a class), then `Flip.from(state, { duration: 0.8, ease: "power3.inOut", scale: true, absolute: true })`. Scrubbed version: build the Flip timeline and attach `scrollTrigger: { scrub: true }`, or use `Flip.fit(el, target, { scale: true })` which returns a tween. (gsap.com/docs/v3/Plugins/Flip)
- Pitfalls: no 3D transforms; state must be recaptured on resize (rebuild inside `gsap.matchMedia` or on `ScrollTrigger` refresh); `scale: true` is cheaper than width/height but distorts border-radius and text (counter-scale children or animate a container with no text).
- RM: no Flip; element is just in its final position.

### 5.14 Cursor + scroll

- Build: `gsap.quickTo(spot, "x", { duration: 0.5, ease: "power3" })` for a soft spotlight/gradient following the pointer inside a card; magnetic buttons offset `x/y` by up to 6-8 px. Because content scrolls under a still pointer, recompute pointer-relative effects on scroll too (store last `clientX/Y`, recompute on `ScrollTrigger` update).
- Pitfalls: never hide or replace the system cursor (accessibility, Windows pointer size/colour settings, high contrast). Only `(hover: hover) and (pointer: fine)`. Large blurred spotlights that move every frame are full repaints; use a radial-gradient element moved by `transform`.
- RM: static hover states only.

## 6. Performance

### 6.1 The target machine

AMD Radeon 610M: RDNA 2, 2 compute units (128 shaders), 4 ROPs, up to 2.2 GHz, shared system memory (cpu-monkey.com / nanoreview.net spec listings, 2026-10-02). At 2560x1600 with DPR 1.75 the CSS viewport is about 1463x914 and **every full-viewport layer is about 4.1 M device pixels**. The bottleneck is pixels touched per frame (fill rate and memory bandwidth), not draw calls or JS. Realm's own measurements: a full-screen noise sky cost 22 of 38 ms; idle repaints and an always-on render loop were the next biggest costs (see `memory/realm-performance-lessons.md`).

Budget at 60 Hz: 16.7 ms per frame for everything. web.dev's old guidance aims for 4-5 ms of compositing during scroll. Realistic Realm budget while scrolling a set piece: main thread under 6 ms, WebGL GPU time under 8 ms, no repaint of any layer larger than a quarter viewport per frame.

### 6.2 Compositor-only properties

- Animate only `transform` (`translate`, `scale`, `rotate`), `opacity`, and sparingly `filter`. Those can skip layout and paint (web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count).
- Chrome also composites percentage transforms (since 89) and, from Chrome 144, `width`/`height` animations *only when the values don't actually change* (bram.us, 2025-11-13). `background-color` and `clip-path` compositing were announced as "coming" in 2021 and are still not something to rely on.
- **GSAP is main-thread.** GSAP writes inline `transform` every tick from JS. If the element is already on its own layer, a transform change is still cheap (no paint), but the update only happens when the main thread is free. CSS animations and CSS scroll-driven animations on transform/opacity run *on the compositor* and keep going during main-thread stalls (hydration, shader compiles). So: CSS for anything that must stay smooth during load; GSAP for choreography after load.
- Hidden-but-running animations still cost: Realm found CSS animations inside `visibility: hidden`/`opacity: 0` ancestors cannot composite and tick the main thread every frame. Pause what is not visible.

### 6.3 will-change discipline and layer explosion

- MDN: `will-change` is a "last resort", don't apply it to many elements, add it shortly before and remove after; it creates a stacking context and (for `transform`) a containing block for `position: fixed` descendants (which breaks ScrollTrigger pins inside it). (developer.mozilla.org/en-US/docs/Web/CSS/will-change, 2026-10-02)
- Each promoted layer is a GPU texture: about width x height x 4 bytes at device resolution. A full-viewport layer at DPR 1.75 is about 16 MB. Ten of them, plus Chrome's tile cache, is how a landing page reaches gigabytes (Realm measured about 700 MB tile-cache growth over a full scroll).
- Practical rule: `will-change: transform` only on elements GSAP is actively moving every frame (marquee rows, pinned media), and toggle it with ScrollTrigger `onToggle` for set pieces: `onToggle: s => el.style.willChange = s.isActive ? "transform" : "auto"`.
- Watch for implicit promotion: 3D transforms, `opacity < 1` animations, overlap with a promoted layer below ("layer squashing" failures), `position: fixed` elements. DevTools > Layers shows each layer's reason and memory.
- Big 3D-tilted layers explode in size (the 30deg tilt that produced a 125k px wide layer). Keep 3D angles small and elements small.

### 6.4 No layout reads in scroll handlers

- Measure on refresh/resize (ScrollTrigger already does this: its start/end values are cached). In custom code read only `scrollY` per frame; never `getBoundingClientRect()`, `offsetTop`, `clientHeight` inside `onUpdate`/`useFrame`/`scroll` listeners. Read-then-write interleaving causes forced synchronous layout (layout thrashing).
- Write CSS variables only when the value changes, and on the narrowest element (writing `--p` on `<html>` invalidates style for the whole document).
- `gsap.quickSetter` / `gsap.quickTo` for per-frame writes (no tween allocation per call).
- Passive listeners: if you add any `wheel`/`touchmove` listener, make it `{ passive: true }` unless it must `preventDefault` (and if it must, that is scroll hijacking; see section 7).

### 6.5 Many-trigger cost

- Each ScrollTrigger is checked every scroll tick; with `onUpdate` or `scrub` it also does work per tick. A few dozen is fine; hundreds of individually scrubbed elements is not.
- Use `ScrollTrigger.batch()` for grids, `once: true` for one-shot reveals (killed after firing), CSS `view()` timelines for the long tail of simple reveals.
- Realm already patched ScrollTrigger's `_rafBugFix` (an endless empty rAF loop) to run only around scroll events (`patches/gsap@3.15.0.patch`). Re-check this patch on every GSAP upgrade.
- `ScrollTrigger.config({ limitCallbacks: true })`: callbacks fire only when a trigger's active state actually toggles (fewer spurious calls on refresh). (gsap.com/docs/v3/Plugins/ScrollTrigger/static.config(), 2026-10-02)

### 6.6 Image decoding

- Explicit `width`/`height` (or `aspect-ratio`) on every image so layout never shifts and ScrollTrigger positions stay valid.
- `next/image` with `sizes` set correctly; `priority` (or `fetchPriority="high"`) only for the LCP image; everything below the fold lazy.
- Large images entering the viewport decode on the main thread at first paint unless already decoded. For images that will be revealed by a scrubbed animation, call `img.decode()` once they're within about one viewport, before the reveal starts. For canvas use `createImageBitmap()` (off-thread decode).
- Don't scale big images with transforms beyond 1.0 (zoom-ins) unless the source has the pixels; upscaled rasters are re-rastered per frame without `will-change` and blurry with it.

### 6.7 Blur and backdrop-filter

- `backdrop-filter: blur()` re-samples and blurs everything behind it every frame the content behind it changes, which during scroll is every frame. A Firefox bug report measured about 24 ms GPU time with a backdrop blur versus 2 ms without during gentle scrolling (bugzilla.mozilla.org/show_bug.cgi?id=1809738). The cost scales with area x blur radius x DPR.
- Rules for Realm: at most one backdrop blur on screen (the sticky header), small radius (8-12 px), and never on large cards that scroll. For "glass" cards use a pre-blurred static background image or a solid translucent fill.
- Never animate `filter: blur()` on large elements (Realm already removed a blur fade for this reason). Animated blur = full repaint and a big kernel per frame.

### 6.8 Off-screen work and long pages

- `content-visibility: auto` + `contain-intrinsic-size: auto 900px` on long below-the-fold sections skips their rendering (web.dev measured 232 ms → 30 ms initial render, 2020-08-05). Caveats: placeholder sizes change the document height until rendered, which shifts ScrollTrigger positions. Don't use it on sections that contain or precede pins unless intrinsic sizes are accurate, and call `ScrollTrigger.refresh()` after they first render. Content stays searchable and in the accessibility tree.
- Pause every loop off-screen: R3F `frameloop`, marquees, video, CSS keyframe loops (`animation-play-state: paused` via a class). Use ScrollTrigger `onToggle` (positions already computed) rather than IntersectionObservers over animated subtrees.

### 6.9 Measuring

- Always on a production build (`next build && next start`), dev server stopped, browser preview parked. Run-to-run noise is about ±30%; repeat 3 times.
- Chrome DevTools: Performance panel with "Screenshots" + "Enable advanced paint instrumentation"; Rendering drawer: Frame rendering stats, Paint flashing, Layer borders, Scrolling performance issues; Animations panel (red triangle = not composited); Layers panel (memory per layer). `chrome://gpu` to confirm ANGLE D3D11 and which GPU Chrome uses (the laptop also has an RTX 5060 but Chrome defaults to the 610M unless Windows Graphics settings say otherwise).
- In code: Long Animation Frames API (`PerformanceObserver` type `long-animation-frame`, Chrome 123+) to log frames over 50 ms with script attribution; R3F `<PerformanceMonitor>` / `gl.info.render` for draw calls and triangles.
- Realm's scratchpad tools from earlier sessions (`idletrace.mjs`, `gpuab.mjs`, `scrolltrace.mjs`, `stalls.mjs`) measure idle busy %, real-gesture scroll A/B and shader stalls.

### 6.10 Adaptive quality

- Tiers decided once at startup and refined live:
  - Tier 0: reduced motion, Pause motion on, Save-Data, or no WebGL2: static images, CSS fades only.
  - Tier 1 (iGPU default): WebGL at DPR 1 to 1.25, half-res post/noise, no MSAA (use FXAA/SMAA only if needed), image sequences at 1280 px, no backdrop blur except header.
  - Tier 2 (discrete GPU, steady 60 fps for 3 s): DPR up to 1.5, full-res effects.
- Signals: `PerformanceMonitor` FPS bounds, the GPU renderer string from `WEBGL_debug_renderer_info` (only as a hint; it is not always available), `navigator.hardwareConcurrency`, `deviceMemory`, and `navigator.connection.saveData`.
- `regress()` during fast scroll so the 3D drops resolution while moving (the eye can't see it) and sharpens at rest.
- Cap rendering at 60 fps on high-refresh displays for WebGL (skip frames in a `frameloop="never"` + `advance` loop). DOM/CSS can run at the display rate; the canvas doesn't need to.

## 7. Accessibility and UX

### 7.1 Which WCAG criteria are in play

| SC | Level | What it means for scroll animation |
|---|---|---|
| 2.2.2 Pause, Stop, Hide | A | Anything that moves automatically for more than 5 s alongside other content (marquees, ambient 3D, looping video, auto-advancing carousels) needs a pause control. Realm's "Pause motion" switch satisfies this if it really stops everything. |
| 2.3.1 Three Flashes | A | No colour transitions or shader effects that flash more than 3 times a second. Velocity-driven RGB/strobe shaders on fast flicks are the risk. |
| 2.3.3 Animation from Interactions | AAA | Not required for AA, but its Understanding doc names **parallax scrolling and scroll-triggered animation** as the examples, and its techniques are exactly ours: C39 (CSS `prefers-reduced-motion`), SCR40 (JS), and a site-wide toggle. Cheap to meet; do it. (w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html, 2026-10-02) |
| 2.4.3 Focus Order / 2.4.7 Focus Visible | A / AA | Tabbing through pinned or horizontally-translated content must land on visible elements in a sensible order. |
| 2.4.11 Focus Not Obscured (Minimum) | AA (new in 2.2) | A focused element must not be *entirely* hidden by author content: sticky headers, pinned overlays, stacked cards. Technique C43: `scroll-padding-top` on `html` equal to the header height. (w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |
| 1.4.4 Resize Text / 1.4.10 Reflow | AA | At 200% zoom or 320 CSS px wide, pinned sections sized to `100svh` with lots of text overflow and get clipped. Pins must allow content taller than the viewport (or un-pin under a height media query). |
| 2.5.3 Label in Name | A | Split text with `aria-label` (section 5.1) can break this for links/buttons. Never split interactive text. |

### 7.2 Vestibular triggers (what to avoid or keep small)

Val Head's list (alistapart.com/article/designing-safer-web-animation-for-motion-sensitivity, 2015-09-08): large-scale motion across the screen; parallax (layers at different speeds); scrolljacking (motion speed unrelated to scroll speed); 3D zoom transitions covering large virtual distance; horizontal movement during vertical scroll; full-screen wipes. "The size of the motion relative to the screen space available" matters more than the physical screen. Opacity, colour and blur changes are unlikely to trigger symptoms. Josh Comeau cites up to 35% of adults over 40 experiencing vestibular dysfunction (joshwcomeau.com/react/prefers-reduced-motion, updated 2026-04-29).

Implication for Realm's set pieces: keep camera rotation small, zoom-throughs short and centred, parallax displacement under about 15% of element height, and horizontal pins few and short.

### 7.3 Reduced-motion strategy

- **No-motion first.** Base CSS is the final, static layout. Motion is added inside `@media (prefers-reduced-motion: no-preference)` and `:root:not([data-motion="off"])`. Browsers or users without the preference API get the safe version. (joshwcomeau.com)
- **Reduced does not mean none.** Replace movement with opacity: a 150-250 ms crossfade is fine for reveals; colour changes stay. Remove translate/scale/rotate/parallax/scrub/pins/camera paths/marquees/velocity effects.
- **Scrubbed set pieces** get a designed static alternative (end-state composition or a short series of stills), not a frozen half-way frame.
- **One switch, three inputs.** `prefers-reduced-motion: reduce`, the site's "Pause motion" toggle, and Save-Data all map to one state on `<html data-motion="off">`, set by an inline head script before first paint (no flash of motion). JS reads the same attribute; `gsap.matchMedia` handles the OS query and a React context re-runs `useGSAP` (`dependencies: [motionOff], revertOnUpdate: true`) for the toggle. Lenis is destroyed, R3F switches to `frameloop="never"` after rendering one still frame, marquees pause, video pauses.
- SSR: the server can't know the preference. Render the static version; enhance on the client. In React hooks initialise "reduced" as `true` to avoid hydration mismatch (Comeau's advice).
- Don't freeze with `gsap.globalTimeline.pause()`: it leaves things mid-transition (half-revealed text). Revert and rebuild in the static variant instead.

### 7.4 Never hijack the wheel

- NN/g (Sara Paul, 2023-08-06, nngroup.com/articles/scrolljacking-101): most participants felt at least mild disorientation; some thought the browser was broken and left; text inside scrolljacks was the worst case; horizontal direction changes caused significant confusion; short scrolljacks were tolerated better than long ones; sticky navigation helped people escape. Recommendations: below the fold only, minimal text inside, avoid on mobile, keep normal scrolling sections between them.
- Note that in users' eyes a **long pinned scrub is a scrolljack** even though the scrollbar is native: the page stops moving and the content moves at a different rate.
- Hard rules: no `preventDefault` on wheel/touch/keys; no "one wheel notch = one section" snapping; no slowing the scroll rate; keep the scrollbar; pins total under about 1.5-2 viewports each and at most 2-3 per page; every pin has a visible progress cue.

### 7.5 Focus and pinned content

- Problem: steps inside a pin are often stacked and revealed by the scrub (opacity 0 / translated out). Tabbing lands on invisible links; the browser's "scroll focused element into view" doesn't know about GSAP's transforms, so nothing scrolls and focus is hidden (gsap.com forum threads on tab navigation with pinned pages and focus hidden behind ScrollTrigger elements).
- Fixes:
  1. Prefer no interactive elements inside scrubbed steps. Put the CTA after the pin.
  2. If needed, mark hidden steps `inert` and remove `inert` from the active step in `onUpdate` (by label/progress). Inert content is skipped by Tab and by screen readers' virtual cursor.
  3. Or on `focusin` within the pin, scroll to that step: `gsap.to(window, { scrollTo: st.labelToScroll("step3"), duration: reduced ? 0 : 0.5 })`. `labelToScroll()` converts a timeline label to a scroll position (gsap.com/docs/v3/Plugins/ScrollTrigger/labelToScroll()).
  4. DOM order = visual order = reading order. Screen readers ignore the pin and read the DOM; make sure the DOM reads as a sensible article without the animation.
- Horizontal galleries: when a panel gets focus, scroll the page to the position that brings it into view (compute from `containerAnimation` progress), or use the native horizontal scroller, which the browser handles automatically.
- `scroll-padding-top: var(--header-h)` on `html` so focused and anchored elements clear the sticky header (C43).

### 7.6 Mobile address bar and viewport units

- `svh` = viewport with toolbars expanded (smallest, stable). `lvh` = toolbars retracted. `dvh` = live, but the spec allows it to update throttled, not at 60 fps, so sizing to `dvh` causes jank while scrolling. Supported Chrome 108, Firefox 101, Safari 15.4. (web.dev/blog/viewport-units, 2022-11-29)
- Use `100svh` for heroes and pinned stages (never cropped by the toolbar, never resizes). Avoid `100vh` (on iOS equals `lvh`, so the bottom is hidden under the toolbar at load).
- `ScrollTrigger.config({ ignoreMobileResize: true })`: touch-only devices skip refresh on vertical resizes under 25% of the viewport height, so pins don't jump when the toolbar hides. Trade-off: positions may be slightly off.
- `normalizeScroll` only as a last resort (section 2.7).

### 7.7 Long pins on phones

- On phones every pin is proportionally longer (more swipes per pinned distance), momentum flicks overshoot, and the toolbar dance makes pins jump. NN/g recommends avoiding scrolljacking on mobile.
- Realm rule: under `(max-width: 767px)` or `(pointer: coarse)`, no horizontal pins (native swipe carousel instead), at most one vertical pin under one viewport long, and image sequences replaced by a short muted `<video>` with controls or a still.

### 7.8 ADHD- and dyslexia-friendly motion

- Text never moves once it has been revealed and while it's being read: no scrubbed text drift, no parallax on paragraphs, no skew on text.
- Reveals finish fast (under about 600-900 ms) and early (start at `top 85%`), so a fast skimmer never waits for content or reads half-faded text.
- Only one thing moves at a time in the reading area. Ambient motion (3D, marquee) lives away from body copy and stops with Pause motion.
- Nothing essential lives only inside an animation or only in WebGL. Every step's text is real DOM text.
- Progress cues for long sections (a thin progress bar or step counter) help people keep their place; the "Pause motion" switch should be easy to find (header or footer, labelled with text, persisted).

## 8. Preloader to hero hand-off

The loader itself (real-progress weighting, time budgets, LCP, six concepts) is covered in the sibling doc `2026-10-loaders-3d-backgrounds.md` §1. This section covers what is specific to **scroll**: how the intro hands over to ScrollTrigger without fighting it.

### 8.1 Principles

1. **The page underneath is already the real page.** The SSR hero (`<h1>`, subcopy, CTA, poster image) is painted, opaque and in the DOM from the first byte. The loader is a decorative `aria-hidden` overlay added only when JS runs and only on a first visit (`html[data-intro]` set by the inline head script). No JS = no loader, full content.
2. **Progress is real or absent.** Under about 400 ms show nothing; between that and the 3 s cap show progress driven by actual stages (fonts, poster decode, network items via drei `useProgress`, `compileAsync` / `warmScene`, first real frame). Display value eases toward the real value, never ahead and never backwards. NN/g: under 1 s no indicator; 2-10 s looped indicator; over 10 s percent-done; speed changes are noticed (nngroup.com/articles/progress-indicators, Katie Sherwin, 2014-10-26). A Realm first visit should land in the "no indicator or a short looped mark" band, so a numeric 0-100% counter is the wrong tool; a mark that assembles per completed stage is honest and fits.
3. **The loader's last frame is the hero's first frame.** Shared element (GSAP Flip or a same-document View Transition) or camera continuation in the already-warm scene. Never a cut to a different composition.

### 8.2 Scroll-specific hand-off rules

- **Build all ScrollTriggers before the loader lifts**, while the overlay is up (the layout is final; the overlay is `position: fixed` so it doesn't affect positions). Then `ScrollTrigger.refresh()` once after `document.fonts.ready` and the poster decode. When the overlay leaves, nothing needs measuring, so no jump.
- **Don't lock scroll with `overflow: hidden` on `<body>`.** Removing it changes the scrollbar width on Windows (about 15-17 px) and therefore the layout, so every trigger is off until the next refresh. If a lock is unavoidable, use `scrollbar-gutter: stable` on `html` and lock by preventing nothing; better still, let the user scroll and treat the first scroll as "skip intro".
- **User scrolls during the intro:** finish the intro instantly (`introTl.progress(1)`) and let the scroll timelines take over. GSAP will otherwise have two tweens on the same element: the intro's and the hero's scrubbed exit.
- **Separate wrappers for intro and scroll.** The intro animates an inner element (`.hero-inner`), the scrubbed hero exit animates an outer one (`.hero-stage`). Same element + two animations of the same property = jump (ScrollTrigger mistake #2).
- **Scroll restoration.** A reload mid-page restores the scroll position (browser and Next.js), so the "intro at the top" assumption breaks. If `scrollY > 0` at startup, skip the intro entirely. Don't force `history.scrollRestoration = "manual"` to drag people back to the top. `ScrollTrigger.clearScrollMemory()` exists for frameworks with unusual routing (gsap.com/docs/v3/Plugins/ScrollTrigger/static.clearScrollMemory()).
- **Hero scrub starts at `top top` with `clamp()`**, so a user who loads at the top and starts scrolling sees the hero exit begin from exactly the intro's end state, no initial jump (mistake #7).
- **WebGL hand-off:** warm the hero scene (Realm's `warmScene`, `holdWarmup`) behind the overlay; crossfade canvas over the SSR poster only after the first real frame (≤150 ms opacity). Under reduced motion, keep the poster and fade the canvas in, or skip the canvas on tier 0.
- **Scroll cue:** a "scroll" hint appears only after the intro completes and the user hasn't scrolled for about 2 s; it disappears on first scroll and never returns. Don't animate it in a bounce loop forever (2.2.2 and ADHD distraction): 2-3 gentle cycles then stop.
- **Focus during the intro:** either `inert` on `<main>` for the ≤1.5 s intro with a focusable "Skip intro" button in the overlay, or keep the overlay `pointer-events: none` and gone before anything can be focused (SC 2.4.11).
- **Repeat visits** in the same session skip the overlay before first paint (sessionStorage flag read by the inline head script); Realm's `intro.tsx` already does this.

### 8.3 Minimal timeline shape

```ts
const intro = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } })
  .to(".loader-mark", { scale: 0.6, duration: 0.5 })
  .add(Flip.fit(".loader-mark", ".hero-mark", { duration: 0.8, scale: true }), "<0.1")
  .to(".loader", { autoAlpha: 0, duration: 0.3 }, "-=0.3")
  .from(".hero-inner > *", { yPercent: 30, opacity: 0.1, stagger: 0.06, duration: 0.7 }, "-=0.4");
await ready;                                   // real stages, capped at 3 s
const skip = () => intro.progress(1);
addEventListener("wheel", skip, { once: true, passive: true });
addEventListener("touchstart", skip, { once: true, passive: true });
intro.play();
```

(The SSR hero has already painted opaque under the overlay, which is when LCP is recorded. The entrance starts from `opacity: 0.1`, not 0, and moves with `transform`, following the sibling doc's LCP notes: Chrome ignores opacity-0 paints and, since M130, transparent text.)

## 9. Recipes: 12 effects for Realm

Mapped to the section plan in `2026-10-scroll-sites-survey.md` §6.4 (phones in motion, Spaces, Feed, Profile canvas, holo card, "who's here now" lobby, Boards, close). Restraint rule from that survey: **one signature moment per section, calm sections between**, and never the same fade-up on everything.

### 9.0 Shared setup

```tsx
// app/layout.tsx <head>: runs before first paint. <html suppressHydrationWarning>.
<script dangerouslySetInnerHTML={{ __html: `(()=>{const d=document.documentElement;let off=false;
try{off=localStorage.getItem("realm:motion")==="off"}catch(e){}
off=off||matchMedia("(prefers-reduced-motion: reduce)").matches;
d.dataset.motion=off?"off":"on";
setTimeout(()=>{if(!window.__motionReady)d.dataset.motion="off"},3000)})()` }} />

// lib/motion.ts ("use client")
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip, ScrollToPlugin);
ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true });
export const motionOn = () => document.documentElement.dataset.motion === "on";
// Components: useGSAP(fn, { scope, dependencies: [motionOff], revertOnUpdate: true })
// so flipping "Pause motion" reverts everything to the static layout and rebuilds.
```

Hidden start states exist only under `[data-motion="on"]` in CSS; set `window.__motionReady = true` once GSAP has initialised so the 3 s safety net never fires on a healthy page.

### 9.1 Masked line reveal for 2-3 key headlines (not every heading)

```tsx
// <h2><span className="sr-only">{t}</span><span aria-hidden ref={vis}>{t}</span></h2>
useGSAP(() => {
  if (!motionOn()) return;
  SplitText.create(vis.current, {
    type: "lines", mask: "lines", aria: "none", autoSplit: true,
    onSplit: (s) => gsap.from(s.lines, {
      yPercent: 105, duration: 0.8, stagger: 0.07, ease: "expo.out",
      scrollTrigger: { trigger: vis.current, start: "top 85%", once: true },
      onComplete: () => s.revert(),           // plain text again: translation, find, copy
    }),
  });
}, { scope: root, dependencies: [motionOff], revertOnUpdate: true });
```
RM: static heading. Never chars, never body copy, never links.

### 9.2 Zero-JS reveal for the long tail (CSS `view()`)

```css
@keyframes lift { from { opacity: .25; translate: 0 1.25rem; } }
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    :root:not([data-motion="off"]) [data-reveal] {
      animation: lift linear both;
      animation-timeline: view();
      animation-range: entry 5% cover 22%;
    }
  }
}
```
Runs on the compositor in Chrome and Safari 26.4+, works before hydration, Firefox gets static content. Use on secondary items (captions, small cards), with small distance; vary the treatment per section so it doesn't become the "fade-up everywhere" tell.

### 9.3 Hero phones turn with scroll (R3F, demand rendering)

```tsx
const rig = { p: 0 };                                   // module-level, mutated only
// in a component rendered inside <Canvas>, so useThree gives setFrameloop/invalidate
// (or import { invalidate } from "@react-three/fiber", which invalidates every root)
useGSAP(() => ScrollTrigger.create({
  trigger: "#hero", start: "top top", end: "bottom top",
  onUpdate: (s) => { rig.p = s.progress; invalidate(); },
  onToggle: (s) => setFrameloop(s.isActive ? "demand" : "never"),
}));
// same component, inside <Canvas frameloop="demand" dpr={[1, 1.5]}>
useFrame((_, dt) => {
  const target = motionOn() ? rig.p : 0;
  const a = easing.damp(group.current.rotation, "y", target * 0.7, 0.35, dt); // maath, returns true while moving
  const b = easing.damp(group.current.position, "z", -target * 1.2, 0.35, dt);
  if (a || b) invalidate();                             // keep rendering only while settling
});
```
Small total rotation (about 40deg). Each section boundary should land on a composed still. RM: fixed hero pose, one frame rendered.

### 9.4 Phone screen dives to fill the viewport (Spaces)

```tsx
mm.add({ ok: "(prefers-reduced-motion: no-preference) and (min-width: 1024px)" }, () => {
  if (!motionOn()) return;
  const fill = () => Math.max(innerWidth / glass.current.offsetWidth, innerHeight / glass.current.offsetHeight);
  gsap.timeline({ scrollTrigger: { trigger: stage.current, pin: true, anticipatePin: 1,
      start: "top top", end: "+=110%", scrub: true, invalidateOnRefresh: true } })
    .fromTo(phone.current, { rotateX: 12, scale: 0.86 }, { rotateX: 0, scale: 1, ease: "none" })
    .to(phone.current, { scale: fill, ease: "power2.in" })
    .to(fullUi.current, { autoAlpha: 1, duration: 0.25 }, ">-0.25")   // swap to a native-res UI layer
    .to({}, { duration: 0.4 });                                        // dwell so it can be read
});
```
Swapping to a full-size, natively rendered UI layer at the end avoids reading a 4x-upscaled raster (blurry with `will-change`, expensive without). Phones/tablets: no pin, show the full UI image in flow.

### 9.5 Pinned stage with cycling chat steps (Spaces, Profile)

```tsx
const steps = gsap.utils.toArray<HTMLElement>(".step");    // stage is aria-hidden; an sr-only <ol> outside has every step
const tl = gsap.timeline({ scrollTrigger: {
  trigger: stage.current, pin: true, start: "top top", end: () => `+=${steps.length * 55}%`, scrub: 0.5,
  snap: isFinePointer ? { snapTo: "labels", duration: { min: 0.15, max: 0.4 }, delay: 0.1 } : false,
  onUpdate: (s) => setStep(Math.round(s.progress * (steps.length - 1))),   // drives the "2 / 5" rail, writes only on change
} });
steps.forEach((s, i) => {
  tl.addLabel(`s${i}`);
  if (i) tl.fromTo(s, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.3 })
           .to(steps[i - 1], { autoAlpha: 0, duration: 0.2 }, "<");
  tl.to({}, { duration: 0.7 });                                         // dwell per step
});
```
Keep no focusable elements inside the stage; CTA after the pin. Total pin under about 2 viewports. RM: steps as a normal vertical list.

### 9.6 Window that opens on the pinned clip (Feed)

```tsx
gsap.timeline({ scrollTrigger: { trigger: win.current, start: "top 80%", end: "center 55%", scrub: true } })
  .fromTo(win.current, { clipPath: "inset(14% 18% round 28px)" },
                       { clipPath: "inset(0% 0% round 16px)", ease: "none" })
  .fromTo(media.current, { scale: 1.18 }, { scale: 1, ease: "none" }, 0);  // inner settles: depth without parallax drift
```
clip-path repaints the element each frame in Chrome, so keep the window under about 70% of the viewport and the scrub short. `<video>` inside plays only while visible and is paused by Pause motion. RM: final frame.

### 9.7 Profile theme swap: directional curtain (compositor-only)

```tsx
themes.forEach((t, i) => ScrollTrigger.create({
  trigger: `#theme-${i}`, start: "top 55%", end: "bottom 55%",
  onToggle: (s) => s.isActive && swap(t, s.direction),
}));
function swap(t, dir) {
  root.dataset.theme = t.id;                       // fonts, frame, accent: instant CSS var swap
  const layer = layers[t.id];                      // fixed full-viewport bg layer, overflow: clip
  layer.style.zIndex = String(++z);
  gsap.timeline({ defaults: { duration: motionOn() ? 0.7 : 0, ease: "power3.inOut" } })
    .fromTo(layer, { yPercent: 100 * dir }, { yPercent: 0 })
    .fromTo(layer.firstElementChild, { yPercent: -100 * dir }, { yPercent: 0 }, 0);   // counter-move: the bg looks static as it's revealed
}
```
Translate + counter-translate gives a wipe without animating `clip-path` or `background-color`. Both theme endpoints must pass AA contrast. RM: instant swap (duration 0).

### 9.8 Sticky stacking cards (Boards)

```css
.stack > li { position: sticky; top: calc(12svh + var(--i) * 14px); }   /* works with no JS */
```
```tsx
const cards = gsap.utils.toArray<HTMLElement>(".stack .card");
cards.forEach((card, i) => {
  const next = cards[i + 1]; if (!next || !motionOn()) return;
  gsap.timeline({ scrollTrigger: { trigger: next, start: "top bottom",
      end: () => `top ${innerHeight * 0.12 + (i + 1) * 14}px`, scrub: true, invalidateOnRefresh: true } })
    .to(card, { scale: 0.94, ease: "none" })
    .to(card.querySelector(".shade"), { opacity: 0.45, ease: "none" }, 0);  // dim via overlay opacity, not filter
});
```
No `overflow: hidden` ancestors (kills sticky); opaque card backgrounds; one cheap shadow. RM: sticky stays, scale/dim go.

### 9.9 Holo card glare sweep tied to scroll (CSS only)

```css
.holo { position: relative; overflow: clip; view-timeline: --holo; }
.holo::after { content: ""; position: absolute; inset: -40% -60%;
  background: linear-gradient(110deg, transparent 42%, rgb(255 255 255 / .16) 50%, transparent 58%);
  translate: -55% 0; pointer-events: none; }
@supports (animation-timeline: view()) { @media (prefers-reduced-motion: no-preference) {
  :root:not([data-motion="off"]) .holo::after {
    animation: glare linear both; animation-timeline: --holo; animation-range: cover 25% cover 75%; } } }
@keyframes glare { to { translate: 55% 0; } }
```
Transform-only, so it is threaded in Chrome and Safari 26.4+. Pointer tilt (desktop) and gyro (phones) are separate, opt-in layers. Exactly one iridescent moment on the page. RM: static subtle sheen.

### 9.10 "Who's here now" presence row with velocity response

```tsx
useGSAP(() => {
  if (!motionOn()) return;
  const loop = gsap.to(track.current, { xPercent: -50, ease: "none", duration: 45, repeat: -1 });  // 2 copies of the row
  const st = ScrollTrigger.create({
    trigger: root.current, start: "top bottom", end: "bottom top",
    onToggle: (s) => (s.isActive ? loop.play() : loop.pause()),             // never runs off-screen
    onUpdate: (s) => gsap.to(loop, { timeScale: 1 + Math.min(Math.abs(s.getVelocity()) / 800, 1.5), duration: 0.3, overwrite: true }),
  });
  const rest = () => gsap.to(loop, { timeScale: 1, duration: 0.8, overwrite: true });
  ScrollTrigger.addEventListener("scrollEnd", rest);
  return () => ScrollTrigger.removeEventListener("scrollEnd", rest);
}, { scope: root, dependencies: [motionOff], revertOnUpdate: true });
```
`will-change: transform` on the track only. A local pause button next to the row (WCAG 2.2.2), plus the global switch. No skew on text. RM: a static, wrapping row of real presence chips.

### 9.11 Wayfinding rail for pins and the page

```css
.read-progress { transform-origin: 0 50%; scale: 0 1; }
@supports (animation-timeline: scroll()) {
  .read-progress { animation: fill linear both; animation-timeline: scroll(root); }   /* not motion: keep under RM too */
}
@keyframes fill { to { scale: 1 1; } }
```
```tsx
const setRail = gsap.quickSetter(rail.current, "scaleX");   // per pinned section
ScrollTrigger.create({ trigger: stage.current, start: "top top", end: "+=200%", onUpdate: (s) => setRail(s.progress) });
```
Progress cues are what NN/g found makes scroll-linked sections tolerable, and they help ADHD readers keep their place. Hide the rail from AT (`aria-hidden`); step text "2 of 5" is updated only on change.

### 9.12 Feed: card cloud settles into the grid (Flip, scrubbed)

```tsx
mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
  if (!motionOn()) return;
  const cards = gsap.utils.toArray<HTMLElement>(".feed-card");
  grid.current.classList.add("is-cloud");            // scattered layout (CSS), never shown without JS
  const cloud = Flip.getState(cards);
  grid.current.classList.remove("is-cloud");         // the real grid = SSR / no-JS layout
  const tl = Flip.from(cloud, { absolute: true, scale: true, ease: "none", stagger: 0.015 });
  ScrollTrigger.create({ animation: tl, trigger: grid.current, start: "top 75%", end: "center 55%", scrub: 0.6 });
});
```
Flip captures pixel positions, so rebuild on resize (wrap in a function and re-run on `ScrollTrigger.addEventListener("refreshInit", ...)`, or put it in `gsap.matchMedia` breakpoints). 2D only (Flip doesn't do 3D); fake depth with `scale` and a shade overlay. RM: the grid, no flight.

## Sources

All fetched 2026-10-02 unless a publication date is given.

GSAP
- ScrollTrigger docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- ScrollTrigger.config(): https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.config()/
- ScrollTrigger.normalizeScroll(): https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.normalizeScroll()/
- ScrollTrigger.batch(): https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.batch()/
- ScrollTrigger.clearScrollMemory(): https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.clearScrollMemory()/
- labelToScroll(): https://gsap.com/docs/v3/Plugins/ScrollTrigger/labelToScroll()/
- ScrollTrigger tips & mistakes: https://gsap.com/resources/st-mistakes/
- gsap.matchMedia(): https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
- React / useGSAP: https://gsap.com/resources/React/ and https://github.com/greensock/react
- SplitText: https://gsap.com/docs/v3/Plugins/SplitText/
- Flip: https://gsap.com/docs/v3/Plugins/Flip/
- DrawSVG: https://gsap.com/docs/v3/Plugins/DrawSVGPlugin/
- ScrollSmoother: https://gsap.com/docs/v3/Plugins/ScrollSmoother/
- imageSequenceScrub helper: https://gsap.com/docs/v3/HelperFunctions/helpers/imageSequenceScrub/
- Release posts: 3.13 (2025-04-29) https://gsap.com/blog/3-13/ ; 3.14 (2025-12-08) https://gsap.com/blog/3-14/ ; 3.15 (2026-04-13) https://gsap.com/blog/3-15/
- Forum, skew on scroll velocity: https://gsap.com/community/forums/topic/25971-skew-on-scroll-velocity/
- Forum, tab navigation with pinned pages: https://gsap.com/community/forums/topic/45010-how-to-fix-tab-navigation-for-accessibility-when-using-scrolltrigger-to-pin-a-whole-page/

Smooth scroll
- Lenis README (v1.3.26): https://github.com/darkroomengineering/lenis
- Edoardo Lunardi, "Building Smooth Scroll in 2025 with Lenis" (2025-09-28): https://www.edoardolunardi.dev/blog/building-smooth-scroll-in-2025-with-lenis
- Chrome 49 smooth scrolling: https://developer.chrome.com/blog/smooth-scrolling-in-chrome-49

CSS scroll-driven / triggered animations
- Chrome guide: https://developer.chrome.com/docs/css-ui/scroll-driven-animations
- Case studies (2024-05-07): https://developer.chrome.com/blog/css-ui-ecommerce-sda
- Performance case study (2023-07-12): https://developer.chrome.com/blog/scroll-animation-performance-case-study
- MDN browser-compat-data, animation-timeline etc. (main branch): https://github.com/mdn/browser-compat-data/blob/main/css/properties/animation-timeline.json
- Firefox 157 release notes (2026-09-29): https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/157
- Safari 26.4 features (2026-03-24): https://webkit.org/blog/17862/webkit-features-for-safari-26-4/
- Interop 2026 (2026-02-12): https://webkit.org/blog/17818/announcing-interop-2026/
- Chrome 146 release notes (2026-03-10): https://developer.chrome.com/release-notes/146
- Utilitybend, CSS animation triggers (2026-02-12): https://utilitybend.com/blog/css-animation-triggers-playing-animations-on-scroll-without-scrubbing-its-a-match

WebGL / R3F
- drei ScrollControls: https://drei.docs.pmnd.rs/controls/scroll-controls
- drei View: https://drei.docs.pmnd.rs/portals/view
- drei useProgress: https://drei.docs.pmnd.rs/loaders/progress-use-progress
- R3F scaling performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- R3F pitfalls: https://r3f.docs.pmnd.rs/advanced/pitfalls
- R3F Canvas API: https://r3f.docs.pmnd.rs/api/canvas
- r3f-scroll-rig: https://github.com/14islands/r3f-scroll-rig
- maath `easing.damp` (returns true while moving, false when settled; checked in installed maath 0.10.8 source)
- Codrops, "How to Build Cinematic 3D Scroll Experiences with GSAP" (2025-11-19): https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/

Effects
- CSS-Tricks, Apple-style image sequence (2020-05-22): https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/
- Video scrubbing: https://muffinman.io/blog/scrubbing-videos-using-javascript/ ; https://gist.github.com/jeffpamer/f3134c5145238d0fd4752221b2d75eb7
- Adrian Roselli, "You Know What? Just Don't Split Words into Letters" (2026-02-05, updated 2026-04-01): https://adrianroselli.com/2026/02/you-know-what-just-dont-split-words-into-letters.html

Performance
- web.dev, compositor-only properties and layer count: https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count
- MDN will-change: https://developer.mozilla.org/en-US/docs/Web/CSS/will-change
- Chrome hardware-accelerated animations (2021-02-22): https://developer.chrome.com/blog/hardware-accelerated-animations
- Bramus, composited width/height in Chrome 144 (2025-11-13): https://www.bram.us/2025/11/13/animating-css-width-or-height-no-longer-force-a-main-thread-animation-in-chrome-under-the-right-conditions/
- web.dev content-visibility (2020-08-05): https://web.dev/articles/content-visibility
- Firefox backdrop-filter bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1809738
- Radeon 610M specs: https://www.cpu-monkey.com/en/igpu-amd_radeon_610m ; https://nanoreview.net/en/gpu/radeon-610m
- Emil Kowalski, Great animations: https://emilkowal.ski/ui/great-animations
- Realm's own measurements: `memory/realm-performance-lessons.md` (2026-09-30 to 2026-10-01)

Accessibility / UX
- WCAG 2.2 Understanding 2.3.3: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- WCAG 2.2 Understanding 2.4.11: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- Val Head, A List Apart (2015-09-08): https://alistapart.com/article/designing-safer-web-animation-for-motion-sensitivity/
- Josh Comeau, prefers-reduced-motion (2020-05-04, updated 2026-04-29): https://www.joshwcomeau.com/react/prefers-reduced-motion/
- NN/g, Scrolljacking 101 (Sara Paul, 2023-08-06): https://www.nngroup.com/articles/scrolljacking-101/
- NN/g, Progress indicators (Katie Sherwin, 2014-10-26): https://www.nngroup.com/articles/progress-indicators/
- web.dev viewport units (2022-11-29): https://web.dev/blog/viewport-units

Related Realm docs
- `2026-10-scroll-sites-survey.md` (what premium vs cheap looks like, section plan)
- `2026-10-loaders-3d-backgrounds.md` (loader progress, LCP, hand-off concepts, 3D phones, holo card)
