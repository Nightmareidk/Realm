---
version: 1
slug: "frontend-web-src-app-app-layout-tsx"
primary_target: "frontend/web/src/app/(app)/layout.tsx"
related_targets: ["frontend/web/src/app/(app)/home/page.tsx","frontend/web/src/features/app","frontend/web/src/app/(app)/settings"]
---

# Surface: the signed-in app frame (nav column, content sheet, Here now) and its first pages

Mode: Operate. People spend evenings in it, often beside a game: calm, readable, fast, keyboard-able.

Routes: `/home` (first run), `/spaces`, `/messages`, `/feed`, `/explore` (honest "being built" states
until each ships), `/settings/account`, `/settings/appearance`, `/settings/devices`.

**Superseding decision (2026-10-05):** the owner judged the 2026-10-04 build "too limited and
congested… doesn't FEEL like a real app GUI". After `docs/research/2026-10-app-shell-feel.md` and a
surface round (seed 6b1197e3 dealt "Live frame", "Lobby" and "Wall"; previews in
`.impeccable/mocks/shell2/`), they picked **C · Wall**. Their answers:
- references: Discord (2025 desktop) and Instagram/Threads web;
- Home leads with your Spaces, live;
- spacious density;
- the glow kept but much fainter.

They then asked for the Instagram feel to be "a bit stronger than Discord", with Discord still
there and no clone of either. Home gained a row of faces (who's around) for that. Mobile renders:
`c-phone-home`, `c-phone-space`.

Earlier decision, user decisions (2026-10-04, from rendered previews in `.impeccable/mocks/phase1/`): the user wrote
their own hybrid of A "Top bar" and C "Shared frame": "a persistent top navigation bar for global
destinations and actions, plus a slim left sidebar for Spaces, DMs, and contextual navigation, and
an optional right context panel for members, profiles, or details. Keep the center content area as
the main focus. Make the layout responsive so side panels can collapse on smaller screens."
Confirmation renders: `h1-space`, `h2-dm`, `h3-phone`. Chat: your own bubbles in the theme colour;
the DM "here" peek kept. Research: `docs/research/2026-10-phase1-app-shell.md` and
`2026-10-phase1-messaging.md`.

## Direction contract

THESIS: One sheet where your people and what's live come first: a labelled nav column on the
ground (destinations, your Spaces, you), and one content sheet holding a slim bar and the page.
Home is faces, live tiles and Space posters. Refuses icon-only navigation, floating boxed panels,
a Discord-style server rail, and a SaaS dashboard of cards.

OWN-WORLD: DESIGN.md's world, quieter in the app: the lit ground at about a third of its strength
behind one Surface sheet (1.375rem corners). Funnel Display only for greetings, page titles and
Space or room names, at product sizes (1.75–2rem); Atkinson for everything else, mostly 600. The
theme colour on the one action (Join on live tiles, Send in rooms), focus, "New" chips and your
own bubbles. Media-first posters and tiles use the Space's banner, or its own colours as a lit
field.

STORY: I see who's around (faces), what's live (tiles with Join), and where I belong (posters
with "New"). Every count is real: unread is "New", never an invented number.

FIRST VIEWPORT:
- Desktop 1280px: the nav column (15.5rem) and the sheet with a 4rem bar (Travel field, Here now,
  Create, notifications), then "Hey, Noor" with the email reminder inline, the row of faces,
  "Live now" when someone's in voice, and "Your Spaces" posters.
- 768–1023px: the same, with the nav column at 13.5rem (labels kept).
- Phones: a slim header, the same Home stacked, and five tabs. Inside a room the header and tabs
  step aside for the Space's own header with a back arrow.

FORM: Surface round (seed 6b1197e3), owner's pick C · Wall. Signature moments:
- the live tile, a Space's banner with who's in and Join;
- posters that lift with a white ring on hover and focus;
- the faces row, with a speaker badge on anyone in voice.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
