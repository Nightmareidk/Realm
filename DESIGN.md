---
name: Realm
description: Another universe your group steps into together. Spaces, a feed, profiles and boards in one app.
colors:
  midnight-ground: "oklch(0.155 0.024 256)"
  panel: "oklch(0.19 0.027 256)"
  panel-raised: "oklch(0.228 0.03 256)"
  rule: "oklch(0.31 0.03 256)"
  rule-strong: "oklch(0.52 0.03 256)"
  starlight-ink: "oklch(0.965 0.008 240)"
  ink-soft: "oklch(0.84 0.02 245)"
  ink-muted: "oklch(0.71 0.025 248)"
  aurora-lime: "oklch(0.88 0.2 128)"
  aurora-lime-hover: "oklch(0.93 0.17 128)"
  on-lime: "oklch(0.2 0.05 145)"
  spaces-teal: "oklch(0.72 0.1291 182)"
  feed-ice-blue: "oklch(0.72 0.14 252)"
  profiles-violet: "oklch(0.72 0.14 296)"
  boards-pink: "oklch(0.72 0.14 352)"
  danger: "oklch(0.72 0.17 22)"
  success: "oklch(0.85 0.15 160)"
typography:
  display:
    fontFamily: "Unbounded, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 4.6vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Unbounded, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 2.9vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Unbounded, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "12px"
  xl: "28px"
  round: "999px"
spacing:
  gutter-mobile: "16px"
  gutter-desktop: "32px"
  section-y: "96px"
  container: "90rem"
components:
  button-primary:
    backgroundColor: "{colors.aurora-lime}"
    textColor: "{colors.on-lime}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.aurora-lime-hover}"
  button-secondary:
    textColor: "{colors.starlight-ink}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 20px"
  chip-room:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.round}"
    height: "28px"
    padding: "0 10px"
  stage:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.xl}"
    padding: "64px"
  bubble-mine:
    backgroundColor: "{colors.spaces-teal}"
    textColor: "{colors.midnight-ground}"
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

Realm is the moment a midnight world lights up at its rim: the Eclipse mark, a dark planet edged in aurora, the instant before you arrive somewhere new. Everything is built from that one image. The ground is deep midnight, never black. Light comes from the edges, as aurora (lime, teal, ice blue, violet, pink), and it gathers where something matters: the primary action, the world you are in, the person who needs you.

The public face is a spectacle and the app is calm. The landing page is a universe: a live 3D eclipse with four planets in orbit, astronaut explorers floating and waving, speech bubbles, a star chart with a flight path drawing itself between worlds. The two editions are two different skies. At night the eclipse hangs in an aurora (curtains with a bright green lower edge, rays, violet above) over stars that twinkle and scintillate in colour. By day the moon slides off the sun: a bright sky, a golden granulated sun with flares, warm light on the crew. Switching editions plays that change out, like the eclipse ending. It carries a lot of information, so it leans on motion and imagery to keep dyslexic and short-attention readers moving through it. Inside the app the same world becomes quiet motifs: orbit rings, a soft aurora edge on the active Space, star-chart locators. Reading surfaces are never glass and never animated for their own sake.

It is semi-cartoon, not a cartoon. The 3D is glossy clearcoat plastic with iridescent visors, cute in form and precise in finish. Colours are modern and luminous rather than pastel.

**Key Characteristics:**
- Midnight ground with light arriving from the edges, as the eclipse does.
- One action colour (aurora lime); four identity inks for the four worlds.
- Real 3D, rendered live or pre-rendered to transparent WebP; never faked with CSS.
- Unbounded for display moments, Atkinson Hyperlegible Next for everything you read.
- Lots of motion on the landing page, all of it pausable, none of it required to understand anything.

## Colors

Midnight neutrals tinted toward blue (hue 256), one luminous lime for actions, and four aurora inks that name the worlds. All values are OKLCH, generated and contrast-tested in `frontend/design-tokens`.

### Primary
- **Aurora Lime**: the rim light of the eclipse. It marks the primary action (Open Realm, send), "needs you" counts, focus rings, the flight path on the star chart, and nothing else. Text on it is the deep green **On Lime**, never white.

### Secondary
- **Spaces Teal**: the Spaces world and your own chat bubbles. Also the lead colour of the brand glow when a surface needs light without meaning "act".
- **Feed Ice Blue**: the Feed world.
- **Profiles Violet**: the Profiles world.
- **Boards Pink**: the Boards world, votes and hearts.

Each world ink has four roles in the token set: `fill` (a dark tinted surface), `line` (strokes and orbit rings), `solid` (planets, dots, badges) and `text` (lettering on midnight).

### Neutral
- **Midnight Ground**: the page itself, and the starfield behind it.
- **Panel / Panel Raised**: two surface steps for stages, windows, cards and bubbles from other people.
- **Rule / Rule Strong**: hairlines and outlines; Rule Strong for anything interactive.
- **Starlight Ink / Ink Soft / Ink Muted**: headings and primary text, body copy, then metadata. All pass 4.5:1 on every surface (tested).

### Named Rules
**The One Action Rule.** Lime means "do this" or "this needs you". It never decorates, never washes a panel, and never marks plain unread.

**The Rim Light Rule.** Glows sit at edges and corners, the way the eclipse is lit, and are led by teal with at most a trace of lime. A lime wash at strength turns olive on midnight.

**The Four Worlds Rule.** Teal, ice blue, violet and pink are identities (a Space, a region), never ornament. A screen uses its own world's ink, plus lime for actions.

## Typography

**Display Font:** Unbounded (with system-ui)
**Body Font:** Atkinson Hyperlegible Next (with system-ui)

**Character:** Unbounded is wide, round and a little cosmic: it gives headlines the scale of a title card. Atkinson Hyperlegible Next was designed for low-vision readers and distinguishes every letterform, which is why it carries all reading, at a generous 17px with 1.6 line height.

### Hierarchy
- **Display** (600, clamp(2.4rem, 4.6vw, 4.5rem), 1.04, -0.035em): hero and closing headlines only.
- **Headline** (600, clamp(1.9rem, 2.9vw, 2.75rem), 1.04): section headings. Words rise in one after another as they scroll into view.
- **Title** (700, 1.125rem): card and panel titles, names in chat.
- **Body** (400, 1.0625rem, 1.6): all reading copy, kept to 40 to 52ch.
- **Label** (Unbounded 600, 0.78rem, 0.08em, uppercase): planet names on the star chart and in the 3D hero, only there.

### Named Rules
**The Readable First Rule.** Anything longer than a headline is set in Atkinson Hyperlegible Next. Unbounded never sets a paragraph, a button label or a UI list.

**The No Eyebrow Rule.** No kicker or label above a heading. A section locates itself with a star-chart locator graphic, or not at all.

## Layout

A 90rem container with 16px gutters on phones and 32px from tablet up. Sections breathe (96 to 128px vertical on desktop) and vary their composition: split copy and 3D in the hero, a centred showcase, copy beside the star chart, alternating stages for the four worlds, an open annotated specimen for Profiles, a centred send-off.

Floating 3D art and explorers hang off section edges (explorers stand on a stage's top edge, props float at corners). They are decoration: they never cover text, and on phones any that would are hidden or moved. The page never scrolls sideways (`overflow-x: clip` on html and body).

Below 48rem, stages stack copy above the preview, the star chart's previews unfold below the chart, planet name tags leave the 3D hero (the chart names them), and chart lettering scales up to stay about 12px on screen.

## Elevation & Depth

Depth comes from light and layering, not shadows. Surfaces step up in lightness (ground, panel, raised) and are separated by hairlines. Shadows appear only under things that float: 3D renders (a soft drop shadow in deep navy), app windows in the showcase, and fold-out previews. Glow is reserved for light sources: the eclipse corona, planet halos, the flight path, speech-bubble edges.

### Shadow Vocabulary
- **Float** (`drop-shadow(0 18px 24px rgb(2 8 18 / 0.5))`): under every floating 3D render.
- **Window** (`0 40px 80px -30px rgb(2 8 18 / 0.9)`): the showcase app window and phone.
- **Preview** (`0 18px 40px -18px` in the shadow token at 70%): product previews inside stages.
- **Bubble glow** (`0 10px 30px -8px` in the bubble's own tone at 55%): speech bubbles and marquee stickers.

### Named Rules
**The Light Source Rule.** Only things that emit light glow. Cards, text and buttons never glow.

## Shapes

Round is the default voice, precise at the edges. Planets, avatars, presence dots, room tabs, chips, the composer and stickers are full circles or pills. Panels and stages use a large 28px radius (the app-icon tile's curve); controls use 6px; small inline elements 4px. Chat bubbles are 16px with one tucked corner pointing at the speaker. Orbit ellipses, tilted -12 to -14 degrees, are the recurring line.

## Components

### Buttons
Confident and simple, with a tactile press.
- **Shape:** gently rounded (6px), 48px tall on the landing page, 40px in the app.
- **Primary:** Aurora Lime with On Lime text. One per view; it says what happens ("Open Realm").
- **Secondary:** a Rule Strong outline with Starlight Ink text, filling with Panel on hover.
- **Press:** scale to 0.97 on press; colour transitions 160ms ease-out. No animation on keyboard activation.

### Chips and room tabs
- **Style:** pills with a hairline border and soft ink. The active room fills with its world's `fill` and `line` inks and takes bold text.
- **Unread:** a lime count badge only when something needs you; a neutral dot otherwise.

### Stages
The container for a world's feature section: Panel with a 28px radius, lit from one corner by its world's ink, with that world's orbit rings sweeping out of the same corner as a faint texture. An explorer may stand on its top edge.

### Chat
- **Theirs:** Panel Raised bubbles on the left with a small avatar and name above.
- **Yours:** Spaces Teal bubbles on the right with midnight text, no avatar.
- **Reactions:** small pills tucked under the bubble. Typing shows as a bubble with three rising dots.
- **Composer:** a floating pill with attach on the left and a round lime send button on the right.

### Navigation
A sticky, blurred midnight header: the Eclipse wordmark, text links in Ink Soft (Ink on hover), a Pause motion button, Sign in (quiet) and Open Realm (primary). On phones the links move into a menu and Pause motion moves to the footer. In the app, a dock of five destinations replaces any server-icon rail (see docs/UX-ARCHITECTURE.md).

### Signature: the Eclipse and the explorers
The Eclipse mark (a midnight disc over an aurora rim with a small star) appears as the logo, the app icon, the hero's 3D centrepiece (a real moon in front of a real sun) and the star chart's centre (the sun itself by day). The four astronaut explorers, one per world ink, are Realm's characters: glossy white suits with panels, belt, knee pads and cuffs, iridescent visors with a coloured rim and glowing eyes that follow the pointer, helmet lamps, twin tanks, a Realm mission patch, all casting soft shadows. They wave from the elbow: live in the hero, and on the page as two layers (body and forearm) with the forearm swinging about the elbow's measured pivot, eased at each end of the swing.

## Do's and Don'ts

### Do:
- **Do** keep lime for the primary action, send, focus and "needs you" counts only.
- **Do** light surfaces from an edge or corner, teal-led, the way the eclipse is lit.
- **Do** render 3D for real (live React Three Fiber, or transparent WebP from `scripts/render-assets.mjs`) and record provenance in `frontend/web/brand/README.md`.
- **Do** set every paragraph in Atkinson Hyperlegible Next at 17px / 1.6 or larger.
- **Do** make every animation pausable (Pause motion, reduced motion) and never required for understanding.
- **Do** show Spaces as one place with room tabs, bubble chat and a "Here now" panel.

### Don't:
- **Don't** build a server-icon rail with a channel list; it reads as a Discord clone.
- **Don't** wash a panel in lime, or use additive glow on a transparent canvas (it bands and clips).
- **Don't** put a kicker or eyebrow label above a heading.
- **Don't** use Unicode glyphs or emoji as icons; icons come from Phosphor. Emoji are fine as chat content and reactions.
- **Don't** fake material with CSS (gradient spheres, bevels, embossing) where a real render exists.
- **Don't** let floating art cover text, or hang past the viewport edge on phones.
- **Don't** use gradient text, or glass behind reading copy.
- **Don't** show the aurora or stars by day, or a daytime sky at night: each edition has its own sky.
- **Don't** animate a character by flipping between two poses; move a joint about its pivot.
