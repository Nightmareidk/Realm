---
name: Realm
description: Another universe your group steps into together. Spaces, a feed, profiles and boards in one app.
colors:
  ink-night-ground: "oklch(0.135 0.036 280)"
  deep-blue-sky: "oklch(0.13 0.042 268)"
  violet-sky: "oklch(0.14 0.05 296)"
  panel: "oklch(0.175 0.04 282)"
  panel-raised: "oklch(0.215 0.045 284)"
  rule: "oklch(0.29 0.04 284)"
  rule-strong: "oklch(0.54 0.045 286)"
  starlight-ink: "oklch(0.975 0.008 285)"
  ink-soft: "oklch(0.86 0.022 285)"
  ink-muted: "oklch(0.745 0.03 285)"
  molten-amber: "oklch(0.8 0.16 68)"
  molten-amber-hover: "oklch(0.86 0.14 76)"
  on-amber: "oklch(0.22 0.06 50)"
  ice-sky: "oklch(0.962 0.018 228)"
  cyan-sky: "oklch(0.948 0.026 205)"
  dawn-gold-sky: "oklch(0.95 0.03 85)"
  cloud-white: "oklch(0.985 0.009 228)"
  navy-ink: "oklch(0.235 0.068 262)"
  sunrise-orange: "oklch(0.645 0.18 50)"
  burnt-orange-ink: "oklch(0.52 0.155 45)"
  on-sunrise: "oklch(0.2 0.06 262)"
  spaces-cyan: "oklch(0.72 0.13 196)"
  feed-electric-blue: "oklch(0.72 0.14 256)"
  profiles-violet: "oklch(0.72 0.14 300)"
  boards-magenta: "oklch(0.72 0.14 350)"
  danger: "oklch(0.72 0.17 22)"
  success: "oklch(0.84 0.14 165)"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.7rem, 5vw, 4.9rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 4.4vw, 4.25rem)"
    fontWeight: 650
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.35
  lead:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 0.95rem + 0.35vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "12px"
  preview: "20px"
  xl: "28px"
  round: "999px"
spacing:
  gutter-mobile: "16px"
  gutter-desktop: "32px"
  section-y: "96-144px"
  container: "80-90rem"
components:
  button-primary:
    backgroundColor: "{colors.molten-amber}"
    textColor: "{colors.on-amber}"
    rounded: "{rounded.round}"
    height: "52px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.molten-amber-hover}"
  button-secondary:
    textColor: "{colors.starlight-ink}"
    rounded: "{rounded.round}"
    height: "52px"
    padding: "0 24px"
  header-capsule:
    rounded: "{rounded.round}"
    height: "56px"
  chip-room:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.round}"
    height: "28px"
    padding: "0 10px"
  surface:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.xl}"
    padding: "48px"
  bubble-mine:
    backgroundColor: "{colors.spaces-cyan}"
    textColor: "{colors.ink-night-ground}"
    rounded: "16px"
    padding: "6px 12px"
  bubble-theirs:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.starlight-ink}"
    rounded: "16px"
    padding: "6px 12px"
---

# Design System: Realm

## Overview

**Creative North Star: "The Eclipse Hour"**

Realm is the moment a dark world lights up at its rim: the Eclipse mark, the instant before you arrive somewhere new. By night the page is deep ink-indigo lit by violet and electric-blue light around a black hole whose accretion disk burns molten amber. By day it is the stratosphere: the hero watches the sun rise over a cloud-wrapped world from orbit, and the page below is the bright high sky you come down into, ice blue turning pale cyan and, at the very end, a trace of dawn gold, with crisp white-blue surfaces, cool navy shadows, deep navy type and a sunrise-orange action colour. Never plain white. Light comes from the edges and gathers where something matters: the primary action, the world you are in, the person who needs you.

The public face is a spectacle and the app is calm. The landing page is a universe: a live 3D black hole with four planets in orbit and the cast floating and waving around it, then a page that keeps moving as you scroll: headlines rise out of masks word by word, a statement lights up as you read it, the product tips up to face you, the four worlds stack up like a deck of cards, the chat stickers race when you scroll fast, and the cast springs up onto a glowing horizon at the end. The two editions are two different skies around the same universe. At night the black hole hangs in an aurora over stars that twinkle in colour. By day the sun takes its place, just clear of the horizon of a world seen from orbit: space and stars above, the atmosphere a thin band of light along the curve of the world (white-gold under the sun, teal away from it) with a razor-bright line on the limb, and below, a sea of cumulus tops lit from the side, glowing orange toward the sun and falling into mauve shadow near you, streaming toward you as you orbit; a starburst, a streak and faint ghosts of the sun in the lens; the worlds still in orbit round the sun and the crew floating over the clouds, lit gold from behind and warm from the clouds below. All of it is drawn live, and it leans away from your pointer. Switching editions plays out an eclipse: the black hole slides off the sun, or back across it. It carries a lot of information, so it leans on motion and imagery to keep dyslexic and short-attention readers moving through it, and every bit of that motion can be paused. Inside the app the same world becomes quiet motifs: orbit rings, a soft glow on the active Space, star-chart locators.

It is premium and a little playful: editorial type, big confident headlines, generous space, and a cast of glossy 3D characters who are cute in form and precise in finish.

**Key Characteristics:**
- A sky, not a flat colour: the page's ground shifts as you scroll (ink, deep blue, violet by night; ice blue, pale cyan, dawn gold by day), under a slow nebula and a fine grain.
- One action colour (molten amber by night, sunrise orange by day); four identity inks for the four worlds.
- Surfaces float: white-blue or ink-glass panels with a lit top edge, a hairline and a soft shadow tinted by the page.
- Bricolage Grotesque for headlines, Atkinson Hyperlegible Next for everything you read.
- Real 3D, rendered live or pre-rendered to transparent WebP; real imagery from Realm's own films in the product previews.
- Lots of scroll motion (GSAP ScrollTrigger, in every browser), all of it pausable, none of it required to understand anything.

## Colors

Two skies, one set of roles. All values are OKLCH, generated and contrast-tested in `frontend/design-tokens` (every ink is tested against the top, middle and end of the sky).

### Primary
- **Molten Amber** (night): the core of the storm and the black hole's disk. It marks the primary action (Open Realm, send), "needs you" counts, focus rings, the flight path on the star chart, and nothing else. Text on it is the deep brown **On Amber**, never white.
- **Sunrise Orange** (day): the same role by day, taken from the sun on the horizon. Buttons are Sunrise Orange with deep navy text; text links and focus rings use the deeper **Burnt Orange Ink**. The mark follows: by day its disc glows gold and its rim burns gold, orange and rose.

### Secondary
- **Spaces Teal**: the Spaces world and your own chat bubbles.
- **Feed Ice Blue**: the Feed world.
- **Profiles Violet**: the Profiles world.
- **Boards Pink**: the Boards world, votes and hearts.

Each world ink has four roles in the token set: `fill` (a tinted surface), `line` (strokes and orbit rings), `solid` (planets, dots, badges) and `text` (lettering on the ground).

### Neutral
- **The sky** (`ground`, `groundMid`, `groundEnd`): the page ground at the top, part-way down and at the end. By night Ink Night, Deep Blue, Violet; by day Ice, Cyan, Dawn Gold. It's one gradient down the whole document, so it shifts as you scroll with nothing to animate.
- **Panel / Panel Raised**: two surface steps (ink-glass by night, Cloud White by day) for cards, windows and bubbles from other people.
- **Rule / Rule Strong**: hairlines and outlines; Rule Strong for anything interactive.
- **Ink / Ink Soft / Ink Muted**: starlight by night, navy by day. Headings and primary text, body copy, then metadata. All pass 4.5:1 on every surface and every part of the sky (tested).

### Named Rules
**The One Action Rule.** Amber (or sunrise orange by day) means "do this" or "this needs you". It never decorates, never washes a panel, and never marks plain unread.

**The Rim Light Rule.** Glows sit at edges and corners, the way the eclipse is lit, led by the world's own ink. A world's card is lit from the corner where its planet sits.

**The Living Sky Rule.** Colour behind the page moves: a fixed nebula of three soft colour fields crossfades on a 48-second cycle in step with the hero's aurora, over the scrolling sky, under a fine grain. It is ambient only: text, surfaces and actions keep their fixed tokens.

**The Four Worlds Rule.** Cyan, electric blue, violet and magenta are identities (a Space, a region), never ornament. A screen uses its own world's ink, plus the action colour for actions.

## Typography

**Display Font:** Bricolage Grotesque (optical sizes; with system-ui)
**Body Font:** Atkinson Hyperlegible Next (with system-ui)

**Character:** Bricolage Grotesque is a modern editorial grotesk with ink traps; its optical size follows the font size, so big headlines tighten up and gain their crafted edge. Set heavy (650 to 700) and tight (-0.04em), it reads premium and confident without looking like a game. Atkinson Hyperlegible Next was designed for low-vision readers and distinguishes every letterform, which is why it carries all reading, at a generous 17px with 1.6 line height.

### Hierarchy
- **Display** (700, clamp(2.7rem, 5vw, 4.9rem), 0.98, -0.04em): the hero headline; the closing headline goes up to 6rem.
- **Headline** (650, clamp(2.4rem, 4.4vw, 4.25rem), 1.02): section headings; a world card's heading is a step down (clamp(2.1rem, 3.3vw, 3.25rem)). Words rise in one after another as they scroll into view.
- **Lead** (Atkinson, clamp(1.0625rem to 1.25rem), 1.6, Ink Soft): the paragraph under a headline, 38 to 50ch.
- **Title** (700, 1.125rem): card and panel titles, names in chat.
- **Body** (400, 1.0625rem, 1.6): all reading copy.
- **Label** (Bricolage 600, 0.78rem, 0.08em, uppercase): planet names on the star chart and in the 3D hero, only there.
- **Signature**: the wordmark "realm" set huge (up to 24rem) and faded at the foot of the footer.

### Named Rules
**The Readable First Rule.** Anything longer than a headline is set in Atkinson Hyperlegible Next. Bricolage never sets a paragraph, a button label or a UI list.

**The No Eyebrow Rule.** No kicker or label above a heading. A section locates itself with a star-chart locator graphic, or not at all.

## Layout

Containers of 80rem (the worlds, privacy, download) to 90rem (hero, showcase, star chart), with 16px gutters on phones and 32px from tablet up. Sections breathe (96 to 144px vertical on desktop) and each has its own composition: split copy and 3D in the hero, a centred headline over a big product shot, copy beside the star chart, a stacking deck for the four worlds, a pinned statement beside scrolling cards for privacy, a bento for download, a centred send-off with the cast on a horizon.

The four worlds are a deck: on screens at least 64rem wide and 46rem tall, each card pins under the header and the next slides up over it while the one beneath settles back (scaled to 94%) and dims; each card leaves a sliver of the ones before showing above. Elsewhere they simply follow one another.

Floating 3D art and characters hang off edges (two of the crew perch on the product shot, two on the browser tile). They are decoration: they never cover text, and on phones any that would are hidden or moved. The page never scrolls sideways (`overflow-x: clip` on html and body).

Below 64rem, cards stack copy above the preview and lose their planet renders, the star chart's previews unfold below the chart, planet name tags leave the 3D hero, and chart lettering scales up to stay about 12px on screen.

## Elevation & Depth

Depth comes from light, layering and soft tinted shadows. Surfaces float on the sky: a lit 1px top edge (white at 7% by night, 85% by day), a hairline border, and a long soft shadow in the page's shadow token (deep ink by night, rose by day). Glow is reserved for light sources: the eclipse corona, planet halos, the flight path, the horizon under the cast.

### Shadow Vocabulary
- **Surface** (`inset 0 1px 0 edge, 0 1px 2px shadow/18%, 0 40px 80px -40px shadow/60%`): cards and tiles (the `surface` utility).
- **Preview** (`0 36px 70px -34px` shadow/85%, plus the lit edge): product windows.
- **Window** (`0 50px 100px -40px` shadow/85%): the showcase app window.
- **Float** (`drop-shadow(0 22px 24px shadow/55%)`): under every character render.
- **Button** (`inset 0 1px 0 white/35%, 0 10px 24px -12px` in the button's own colour): the primary button's depth. It never glows.

### Named Rules
**The Light Source Rule.** Only things that emit light glow. Cards, text and buttons never glow.

## Shapes

Round is the default voice. Buttons, the header, chips, room tabs, the composer, stickers and toggles are pills; planets, avatars and presence dots are circles. Cards and tiles use a 28px radius, product windows 20px, icon tiles 12 to 16px. Chat bubbles are 16px with one tucked corner pointing at the speaker. Orbit ellipses, tilted -14 degrees, are the recurring line.

## Components

### Buttons
Confident pills with a tactile press.
- **Shape:** full pill, 52px tall for page actions, 40px in the header.
- **Primary:** Molten Amber with On Amber text (Sunrise Orange with navy text by day), a lit top edge and a soft shadow in its own hue. One per view; it says what happens ("Open Realm"), with an arrow that nudges forward on hover.
- **Secondary:** a Rule Strong outline over a translucent panel, filling with Panel on hover.
- **Press:** scale to 0.97 on press; transitions 160ms ease-out. No animation on keyboard activation.

### Header
A floating capsule (56px, 8px from the top, 64px in all). At the very top of the page it's clear, so the hero runs up under it, with a soft shade behind the links; once you scroll it frosts over with a hairline and a soft shadow, and a thin line in the four worlds' inks along its foot fills as you read down the page.

### Chips and room tabs
- **Style:** pills with a hairline border and soft ink. The active room fills with its world's `fill` and `line` inks and takes bold text.
- **Unread:** an amber count badge only when something needs you; a neutral dot otherwise.

### World cards
A world's card: a surface lit from one bottom corner by its world's ink, where its planet (a real render) sits cropped inside its orbit rings; a locator, headline, lead and availability list on one side and the product on the other, alternating sides from card to card.

### Chat
- **Theirs:** Panel Raised bubbles on the left with a small avatar and name above.
- **Yours:** Spaces Teal bubbles on the right with dark text, no avatar; a reply shows as a pill with a reply arrow above it.
- **Reactions:** small pills tucked under the bubble. Typing shows as a bubble with three rising dots.
- **Composer:** a floating pill with attach, GIF and emoji, and a round action-colour send button on the right.
- The conversation fades out at its top edge, like a real scrolled chat.

### Product previews
Built from the real UI, framed as a window (20px radius, lit edge, deep shadow), inert, and captioned as illustrative. Their people are the cast (portraits as avatars) and their media is Realm's own imagery: stills from the films and images made for the brand, never stock photos.

### Signature: the scroll intro and the edition switch
The landing page opens on a title card under a close-up of the centrepiece (the black hole, or the sun by day); scrolling pulls the camera back through space while the stage stays pinned, the worlds and asteroid belt come into frame, the crew drifts in, and the headline arrives. By day the dawn's horizon rides just under the sun as the camera pulls back; then, with the stage still pinned, comes the descent: the camera drops toward the world, the headline and the crew rise away, the horizon climbs out of the frame and the cloud tops come up to meet you, catching more light as you fall (peach-white heads, lilac shadows); puffs of cloud swell toward you and stream past as you scroll, thicken to white, and clear, and you're in the bright ice-blue sky of the page itself (the canvas clears onto it). With reduced motion or Pause motion there's no descent; the hero fades at its foot through a cool haze into the sky instead. The hero is deep space in both editions, so it (and the header while it's over the hero) keeps the night edition's inks. Switching editions scrolls back to the top and plays the eclipse in the hero, live, while the rest of the page is revealed in the new edition as a soft-edged circle spreading from the sun. Reduced motion and Pause motion skip all of it.

### Signature: the sky behind the page
Below the hero the page is the sky you've come down into (`src/features/landing/sky-life.tsx`), behind everything and never over text, and everything in it is part of the scroll: nothing runs on a clock. Scroll on and things fly; stop and they hold where they are; scroll back and they fly backwards. Each flight has its own stretch of the page and lasts a couple of screens of scrolling. By day, rendered cumulus pass by, the near ones big and quick, the far ones small, pale and slow, each drifting sideways as it rises and paling as it sinks toward the horizon; a jet crosses high up now and then, drawing its twin contrails out behind it; and a few gulls fly over, beating their wings as you go. By night it's space: shooting stars streak across and burn out; satellites glide over, the near ones turning with a red beacon blinking and a flash of sun off their panels, the far ones just moving lights; a rocket lifts off from the foot of the screen and climbs away into space on its flickering fire, leaning into its climb, its exhaust growing out behind it; and a flying saucer darts in spinning, hangs a moment bobbing (its glowing wake fading), then zips off. The jet, rocket, saucers and satellite are the product owner's own models, rendered as sprites; they scale down on a phone. At the very end you've landed, and below the cast's horizon there's no more sky, only ground. By day it's a meadow on the crest of a hill, rendered blade by blade (lush green, gold where the sun catches the crest, the blade tips standing up against the sky) that falls into its own shade down the slope; by night it's the Moon, its horizon curving away under them (grey regolith in a low sun from the left, every crater rim lit and throwing its shadow, boulders on the skyline, a violet glow behind). The cast stand along the curve, each lower and leaning out with the slope the further from the middle, like people on a small world, with a soft shadow at their feet; by day the blade tips come up over their shoes. The footer is that ground carried on down: by day deep green with a fine grain and a pool of sunlight, in light inks; by night the Moon runs on down into the footer, dimming toward you to its own dark dust, in light inks. The name signs off under every page, huge: carved into the ground by day, raised in soft light by night. With reduced motion or Pause motion the clouds stand still and nothing flies.

### Signature: scroll motion
Every section moves as you scroll, in every browser: GSAP ScrollTrigger (`src/features/landing/scroll-fx.tsx`), driven by `data-fx` attributes in the markup. Everything is fully visible without JavaScript; reduced motion and Pause motion switch it all off and put every element back in place.
- **Headlines** rise out of a mask word by word (`words`); lead paragraphs rise in and unblur (`fade`).
- **The statement** ("One app instead of four...") lights up word by word as you read down it, scrubbed (`light`).
- **The product shot** tips up from 30 degrees and grows to face you, scrubbed (`tilt`); the phone and the perched crew drift at their own pace in front of it (`parallax`); the moments around it spring in (`pop`).
- **The chat stickers** run faster the faster you scroll, then ease back (`marquee`).
- **The star chart** grows into place (`zoom`); its planet list arrives one by one (`stagger`).
- **The worlds** stack up as a deck: each card settles back to 90% and dims as the next slides over it (`deck`); inside, the copy arrives in turn, the product rises, the planet drifts and the orbit rings turn.
- **Privacy** pins its statement while the protection cards slide in from the right; the lock turns as it passes.
- **The close**: the headline grows into place, and the whole cast springs up onto the horizon from the middle outwards, then waves.
- Throughout: primary buttons lean toward the pointer, cards catch a soft light where the pointer is, the header's line fills as you read, and the nebula drifts up behind everything.

### Signature: the black hole and the cast
The Eclipse mark (a dark disc over a glowing rim with a small star) appears as the logo, the app icon and the star chart's centre. At night the hero's centrepiece is a black hole, and it's alive: a photon ring where arcs of light race round, an accretion disk crossing in front with its far side lensed over the top, turbulent gas sheared by the orbits, hot clumps, a soft violet and blue glow, faint polar jets, and every few seconds a magnetic flare. By day the sun takes its place: granulated plasma with sunspots, limb darkening, a warm halo and a corona of streamers.

Realm's characters are a cast, not a mascot: an astronaut, aliens (three-eyed Zib, crystal-crowned Nova, the little green one), monsters (Gloop the pink cyclops, Bruno the blue plush) and people (Maya in her headset, Leo in his glasses). They're made in Meshy (image to 3D) as glossy semi-cartoon figures, each posed with a hand up, and `scripts/render-cast.mjs` gives every one a real wave: it rigs the raised arm in Blender (shoulder, elbow, wrist and hand bones, weighted only around the arm so nothing else can bend) and bakes a "Wave" where the forearm swings side to side from the elbow as one firm piece, the hand following a touch behind, with crisp joints so nothing bends like rubber. Live in the hero the models play that animation every couple of seconds while they float; on the page the same wave is rendered in Cycles as 41 frames of just the arm's area, stepped through by CSS over the still pose. Only the hand moves; the body never rocks. Their portraits are the avatars in every product preview.

## Do's and Don'ts

### Do:
- **Do** keep the action colour for the primary action, send, focus and "needs you" counts only.
- **Do** float content on `surface` panels over the sky, lit from an edge or corner.
- **Do** render 3D for real (live React Three Fiber, or transparent WebP from `scripts/render-assets.mjs` and `scripts/render-cast.mjs`) and record provenance in `frontend/web/brand/README.md`.
- **Do** set every paragraph in Atkinson Hyperlegible Next at 17px / 1.6 or larger.
- **Do** make every animation pausable (Pause motion, reduced motion) and never required for understanding.
- **Do** show Spaces as one place with room tabs, bubble chat and a "Here now" panel.

### Don't:
- **Don't** build a server-icon rail with a channel list; it reads as a Discord clone.
- **Don't** wash a panel in the action colour, or use additive glow on a transparent canvas (it bands and clips).
- **Don't** put a kicker or eyebrow label above a heading.
- **Don't** use Unicode glyphs or emoji as icons; icons come from Phosphor. Emoji are fine as chat content and reactions.
- **Don't** fake material with CSS (gradient spheres, bevels, embossing) where a real render exists.
- **Don't** let floating art cover text, or hang past the viewport edge on phones.
- **Don't** use gradient text, coloured side borders on cards or list items, or glass behind reading copy.
- **Don't** make day plain white: it's an ice-blue to cyan sky with white-blue surfaces and a trace of dawn gold.
- **Don't** show the aurora by day, or the dawn at night: each edition has its own sky.
- **Don't** use stock photography in the product previews; use Realm's own imagery.
- **Don't** scatter cartoon props around sections; the 3D world and the cast carry the personality, the page stays composed.
- **Don't** animate a character by rocking its whole body; a wave is the arm and hand, from the rig.
- **Don't** rely on CSS scroll timelines alone for scroll motion; some browsers don't run them. Use `data-fx` (GSAP).
