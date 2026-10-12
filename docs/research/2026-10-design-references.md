# Realm: design references and directions (2026-10)

> Status: research for a decision, written 2026-10-02. Nothing here is built.
> Purpose: help the owner choose a new visual direction after a friend said the current site "looks like AI slop".
> Constraints carried through every section: night is the default and light is optional; Atkinson Hyperlegible Next (AHN) for reading text; a Pause-motion switch; WCAG 2.2 AA; dyslexia- and ADHD-friendly; and everything must reduce to design tokens so users can later theme the app (see [THEMING.md](../THEMING.md)).
> Companion: [2026-10-critique-current-site.md](2026-10-critique-current-site.md) (the outside critique; not repeated here).
> Evidence: the screenshots in [`2026-10-design-references/`](2026-10-design-references/) (`ref-*.jpg`, `realm-current-*.jpg`). Two were added on 2026-10-02 with Playwright at 1440x900: `ref-poolsuite.jpg` and `ref-steam-points.jpg`. Note that `ref-steam.jpg` is the Steam store front, not a profile; the Points Shop capture covers the profile side.

---

## 0. Summary

- **What reads as slop in 2025–2026 is a cluster, not one choice.** The first-order cluster (indigo-violet gradient, Inter, glass, three cards, glow CTA, one coloured headline word, generated 3D art, fade-up on everything) is well documented. A second-order "tasteful" cluster has formed since (near-black with one acid-green or vermilion accent; cream, serif and terracotta; broadsheet hairlines; mono all-caps labels; decorative 01/02/03; Space Grotesk, Geist, Instrument Serif, Fraunces, Bricolage Grotesque). The current site has most of the first cluster and uses Bricolage from the second.
- **Every reference that feels crafted has one thing in common: its colour and imagery come from something real that the company owns or makes.** Valorant's red comes from its HUD; Nintendo's art is the game; Playdate's look is its 1-bit screen; Teenage Engineering draws its own two-ink comics; Linear's hero is its actual app with believable content; Steam and itch.io keep their chrome dull so that game art carries the colour. None of them use art that could belong to another product.
- **The directions split into two kinds.** The Manual, Party Lobby and the full-craft category standard can carry a whole product. Arcade Cabinet, One-bit Desktop, Drop and Holo Card are strongest as a layer (a theme, the profile system, or launch pages) on top of one of those.
- **My recommendation, for the owner to accept or reject:** build the app on the category standard at full craft (it's the screen people live in, and the best substrate for user themes); give the brand its voice with **Party Lobby** (the most on-brief: "who's here" and "invite a friend" become the hero) or **The Manual** (the most distinctive, and the cheapest to theme); make **Holo Card** the profile system; ship **Arcade** and **One-bit** as the first official user themes to prove the token pipeline. Note that the category standard reopens the owner's 2026-09-27 decision that Spaces should not use a server rail plus channel list.

---

## 1. AI-slop tells in 2025–2026

Sources are listed in §6. "Realm now" refers to the current build in `realm-current-*.jpg` and the code.

| # | Tell | Who calls it out | Realm now |
|---|---|---|---|
| 1 | Indigo or violet-to-blue gradients as the default colour, traced to Tailwind UI's `bg-indigo-500` | Adam Wathan (2025-08-07); 925 Studios; Mania (2026-07-23) | **Yes.** The nebula behind the hero (`realm-current-night.jpg`) and the violet corner blobs in the app (`realm-current-app.jpg`). |
| 2 | Inter or Roboto by default, and the "tasteful" substitutes that replaced them: Space Grotesk, Geist, Instrument Serif, Fraunces; Bricolage Grotesque spread after a widely shared 2025 post recommended it | avoid-ai-design catalogue | **Partly.** Headings are Bricolage Grotesque at -0.04em (`layout.tsx`, `globals.css`). AHN for body is a defensible, purpose-driven choice; keep it. |
| 3 | Glassmorphism: frosted pill nav, translucent cards | SmoothUI; Mania; avoid-ai-design | **Yes.** The nav pill and the feature cards (`realm-current-hero5.jpg`, `realm-current-night-s1.jpg`). |
| 4 | One radius, one padding and one card height everywhere; thin stock line icons on top of cards; `rounded-2xl shadow-lg` | 925 Studios; Mania; avoid-ai-design | **Partly.** Everything is a pill or a large-radius card; the app rail uses a stock icon set (Phosphor) at default weight; the decorative orbit icon sits above every feature heading. |
| 5 | A gradient or glowing primary CTA ("Get Started") | 925 Studios | **Yes.** The orange glow on Open Realm and Verify. |
| 6 | One accented word in the headline (colour, italic or gradient) | avoid-ai-design ("single accented headline word") | **Yes.** "share clips" in lilac (`realm-current-hero5.jpg`). |
| 7 | Generated imagery and its artefacts: glossy clay mascots, glowing portals and arches in meadows, cosmic nebulae, the same render reused | Matt Ström-Awn, "Expansion artifacts"; the critique §2 | **Yes.** Mascot cast, black hole, the stone arch in the feed mock-up (`realm-current-night-s1.jpg`). |
| 8 | The template scroll: centred hero with two CTAs, social-proof marquee, alternating feature rows | SmoothUI; 925 Studios | **Yes.** Hero with Open Realm and Download, the chat-bubble marquee, four alternating rows. |
| 9 | Identical motion: fade-up on everything, bounce easing, scroll-jacked word reveals | avoid-ai-design; Mania | **Yes.** GSAP word reveals and cross-fading panels. |
| 10 | Second-order looks: near-black plus one acid-green or vermilion accent; cream, high-contrast serif and terracotta; broadsheet hairlines with zero radius; mono all-caps labels; decorative 01 / 02 / 03 | avoid-ai-design | **No.** But The Manual and Drop sit right next to these; see §3. |
| 11 | Weightless copy: "Build faster. Ship smarter.", "your all-in-one platform", Elevate / Seamless / Unleash, "not X, but Y", rule of three, em dashes, emoji bullets, Title Case headings | 925 Studios; Mania; Wikipedia "Signs of AI writing"; avoid-ai-design | **Partly.** "Four apps, one Realm", "One place to…", "Step into another universe" are formulas plus a theme word. The sample chat copy and the privacy copy are human and specific. |
| 12 | Undesigned states: no empty, loading or error design; everything shown at once; flat hierarchy | Mania | **Yes, in the app.** The home screen narrates a roadmap instead of offering an action. |
| 13 | Ambient motion with no way to stop it | WCAG 2.2.2 (not a slop source, a requirement) | **No.** Realm already has a Pause control. Keep it. |

The useful lesson from the sources is that none of these is wrong alone; the giveaway is that they arrive together and that nothing in them is specific to the product. A font or colour is only a tell when it's borrowed: Geist on vercel.com is Vercel's own voice (`ref-vercel-2.jpg`); Geist on a chat app is a default.

---

## 2. What makes each reference feel crafted

### Discord (`ref-discord-hero.jpg`, `ref-discord-2.jpg`, `ref-login-discord.jpg`)

**The site.** Headlines are a modified Ginto Nord in heavy capitals ("GROUP CHAT THAT'S ALL FUN & GAMES") with generous line-height; body copy is gg sans at about 20px. Colour is one decision: blurple (#5865F2) as an indigo-to-blurple field, plus white. The two CTAs are a white "Download for Windows" (detected OS) and a blurple "Open Discord in your browser"; there is no third colour on the hero. The imagery is a commissioned, flat-shaded 3D illustration system: a few teenagers and Wumpus-family robots lounging around a monitor and a phone that show the **actual app**. People are using the product in the picture. Blurred props (a crown, a trophy, an egg) and pixel-square sparkles recur as a motif that says "games" without saying "space". The second section frames a real phone UI (emoji picker, "Top emoji in Sword Squad") inside a huge rounded bezel card. The login is one dark card with a QR code and a passkey link and the line "Welcome back! We're so excited to see you again!". Voice: excitable, plain, specific.

**How it got here.** OG blurple #7289DA and the Whitney typeface ran from 2015. The **2021-05-13** rebrand moved to #5865F2, a Ginto Nord wordmark and "Imagine a Place"; users pushed back on the colour (some reported eye strain) and the wordmark. **2022-12-01**: gg sans by Colophon replaced Whitney everywhere. **2023-12-05**: a mobile redesign split Servers and DMs and drew enough backlash that people cancelled Nitro; in **May 2024** Discord merged them back, and its CTO said the mobile-first rethink "did not really work well for most users who use both". **2025-03-25**: the desktop refresh added Light, Ash, Dark and Onyx themes, Spacious / Default / Compact density and a resizable channel list, "to enhance legibility, reduce the feeling of being overwhelmed by visual noise". In **March 2026** a mobile redesign was reported to realign with desktop and restore the original dark theme.

**What to take.** Discord's site is loud and its app is quiet. Discord itself uses a purple gradient and 3D characters, but it doesn't read as slop because the colour has been its own for a decade, the characters are one authored system with one lighting model, and the product is in every hero. Its users punish visual change hard, which is why density and contrast should be settings from day one.

### Steam (`ref-steam.jpg`, `ref-steam-points.jpg`)

Valve's chrome barely changes: dark navy (#1B2838 family), a darker header, a light-blue accent and a green install button, set in a plain sans. All the colour comes from somewhere else: the Autumn Sale hero is commissioned seasonal art (a purple dragon digging up a treasure chest with a Steam Deck in it), and every capsule below is art made by a game's own developer. The Points Shop (`ref-steam-points.jpg`) shows how customisation is productised: fixed categories (Avatars, Backgrounds, Community Awards, Seasonal Badge, Game Profiles, Showcases, Animated Stickers, Chat Effects), rows such as "Tiled profile backgrounds (71)" and "Animated profile backgrounds (1,164)", every item at a fixed price (1,000 points). On profiles, showcases unlock one per 10 levels, and users go as far as uploading long images through the browser console so the Artwork Showcase lines up with the background as one composition. That hack is a demand signal: people want their profile to read as one designed piece. Steam's lesson is that a dull, stable frame lets user art be loud. The model itself is covered in [THEMING.md §2.5](../THEMING.md).

### Valorant (`ref-valorant.jpg`)

A black nav with tracked uppercase labels, a full-bleed hero of Riot's own painted key art (an agent aiming down a rifle in a violet ruined city), the wordmark with its custom cut letterforms, a subline in tall condensed capitals, and one CTA: "PLAY FOR FREE", a sharp red rectangle inside a 1px outline offset by a few pixels. That offset frame is the brand in miniature: it comes from the in-game HUD and recurs on buttons and cards, and the hero's CTA and frames are square-cornered. The palette is four colours: red #FF4655, navy #0F1923, off-white #ECE8E1 and slate #5A6672. Type is Tungsten for display and DIN Next for interface, both commercial. Craft here is **one motif, derived from the game, repeated without exception.**

### Nintendo (`ref-nintendo.jpg`)

A white page; the red (#E60012) logo is a solid tab in the top-left corner; nav items are a friendly rounded sans with small filled red icons. The hero is the game's own key art at full bleed. The headline is sentence case with a pun: "Available now! Steel yourself for the Heroic Games." The ESRB rating box sits next to it at the same weight as marketing, and the carousel controls start with a **pause button**, ahead of the thumbnails. Red does the brand work; everything else is the content. This is the direct precedent for Realm's Pause-motion switch: make stopping motion the first control, not a buried setting.

### Playdate (`ref-playdate.jpg`)

A neutral studio-grey radial backdrop and the product rendered large and true: the yellow console, its crank and screws. The screen shows real 1-bit dithered game art ("CatchaDiablos"). A tilted sticker ("Season 3 PRE-ORDER IT!") in black, white and yellow with a striped numeral does the selling. Nav items each have a small custom glyph, and Shop is a purple pill. The system UI is set in Roobert, and the hardware and OS are full of rare, earned moments: crank to buy (the button fills with growing tension), eyes that open on unlock, settings breadcrumbs drawn as daisy-chained cables (Clip Content, 2023-03-13). Colour discipline: yellow, purple and 1-bit, nothing else. **The constraint is the brand, and delight is spent where it's rare.**

### Teenage Engineering (`ref-te.jpg`)

A near-white canvas. Navigation is a custom thin cut of Univers ("Univers Te"), and every section has its own bespoke geometric icon: a fan-flower for products, a bag for the store, a square for latest, an arrow, magnifier and dial for finder. A block of real Japanese copy sits beside the logo as texture. The headline "DAILY LIFE OF MR. UPDATE" is custom notched capitals; an "EP series update" calendar card lists firmware versions in a little table; below is a hand-drawn comic in **two inks, black line plus one orange**, of an exhausted engineer between paper stacks, with a sign that reads "BUSY. Meet only between 10:30 and half past ten". The palette is near-monochrome (#000, #E5E5E5, #F0F0EF) with one chromatic accent. The founders describe their constraints as simple geometry, a fixed set of RAL colours and industrial standards. Deadpan humour, two inks and bespoke icons: **this is the bar for The Manual.**

### Linear (`ref-linear-2.jpg`)

The hero is the app itself, set on a soft grey studio floor. Surfaces are three steps of near-black; text is Inter with Inter Display for headings; colour appears only as tiny semantic marks (a yellow in-progress ring, an orange icon on "UI Refresh"). The content is believable to the point of being funny: "Right now we show a spinner forever, which makes it look like the car disappeared…". The process is the transferable part. In **2024-03-28** Linear rebuilt its theme generator in LCH so that a theme is three inputs (base colour, accent colour, contrast) instead of 98 variables, with high-contrast themes falling out of the contrast input. In **2026-03-12** it warmed the greys, dimmed the sidebar, shrank and removed icons, and softened separators: "structure should be felt not seen". **Realm's user themes should be generated the same way.**

### Arc (`ref-arc.jpg`)

One saturated electric blue (#3139FB family) carrying a fine noise grain, with scalloped die-cut edges between the blue bands and a white band that frames the product (now pointing at Dia). The press quote "Arc is the Chrome replacement I've been waiting for." is set huge in a heavy, soft-cornered grotesk (reported as Marlin Soft SQ) and credited with The Verge's own wordmark. The craft is physical: grain and a bespoke edge make a flat blue feel like printed card stock. The warning is that grain and wavy edges are now widely copied, so they only work with a reason.

### Family (`ref-family.jpg`)

A white page, a black geometric headline tracked tight but not crushed ("Your favorite crypto wallet."), a black pill and a light pill. The cast is flat 2D: a blue square in a cloud, a green blob, a red flower, a yellow triangle, all with the same thick dark limbs and the same palette, with coins, hearts and a lock as props. Family's reputation comes from motion inside the app, written up as "Family Values" (2024-07-08): simplicity, fluidity and delight; trays that overlay rather than replace screens; text that morphs ("Continue" to "Confirm"); and a **delight-impact curve**, where the rarer a feature is used, the more delight it may carry. If Realm keeps any characters, this is the model: one flat, authored system with rules, not mixed renders.

### Emil Kowalski (`ref-emil.jpg`)

A near-white page, one small sans size, two text colours (black name, grey role), sections called "Today" and "Projects", one-line descriptions ("Sonner. An opinionated toast component for React."), very large gaps, no images and no colour. The craft is in behaviour and in rules he publishes: animate only with a purpose; frequency of use decides (a keyboard shortcut used a hundred times a day gets no animation, ever; a rare celebration can have some); keep UI motion under 300 ms; prefer ease-out. **Removal is the cheapest anti-slop move**, and his frequency table is the right budget for Realm's motion.

### The rest, briefly

- **Raycast** (`ref-raycast-2.jpg`): near-black, and the demo sits inside a real macOS menu bar with specific details ("Lunch • 37m left", "Mon Jun 22 9:41 AM"). A two-line headline with the second line grey. Specificity is the craft.
- **Vercel** (`ref-vercel-2.jpg`): Geist, a black triangle with a soft glow, a logo wall. Authentic on Vercel; a tell anywhere else.
- **Rauno Freiberg** (`ref-rauno.jpg`): horizontally scrolling cards, huge neo-grotesk set with staggered indents, one yellow circle and a tick-mark progress meter. One shape, one colour.
- **Bluesky** (`ref-bluesky.jpg`): a real sky photo, with the actual feed tabs (Following, For You, Art, Friends) and real posts floating over it. The italic "social internet" is the one accent-word trick, used once.
- **Are.na** (`ref-arena.jpg`): an ordered list as the hero ("Are.na is a. … b. … c. +") and a live counter, "For the last 15 years and 54 days". Copy is the design.
- **Cosmos** (`ref-cosmos.jpg`): warm off-white, black pills, and the hero is the search field with an example query ("Try 'monochromatic digital art'").
- **Telegram** (`ref-telegram.jpg`): a site that hasn't changed in a decade, with a dated changelog ("Aug 25", "Jul 14", "Jun 11"). Boring and credible.
- **Stoat**, formerly Revolt (`ref-stoat.jpg`): dark indigo, a bold geometric "Find your community.", a cyan pill and a grey pill, the app window below. Competent and generic: this is the median of the category, the thing Realm must clearly beat.
- **itch.io** (`ref-itch.jpg`): a dense, white, utilitarian frame with one small red accent, so creators' art carries all the colour.
- **Config** (`ref-config.jpg`): green, grey generative blobs and a black panel with large arrowed links. The brand is a generative system, not a picture.
- **Poolsuite** (`ref-poolsuite.jpg`, captured 2026-10-02): a pink desktop, one cream window with a 1px rule and a soft shadow, bitmap-style type, a menu-bar date that reads "FRI 2 OCT 1997", a video titled "IsuzuTrooper.avi" in dithered colour, and a dock of pixel icons (Player, Newsroom, Mixtapes, Members, Events, Instagram, Vacation, Guestbook, Apps). It isn't one-bit; it's pastel late-90s Mac. The jokes live in the metadata.

---

## 3. Lessons for each candidate direction

Each section: what to borrow, which reference sets the bar, the main trap, and how it reduces to tokens.

### 3.1 The Manual

*A game instruction booklet or Japanese game-magazine editorial; two inks on black stock; the app drawn as numbered diagrams.*

- **Borrow.** Teenage Engineering's two-ink line drawing and deadpan captions. Tunic's in-game booklet, which its developer made from a real folded, taped and scanned prototype, mixing lavish illustration with doodles, down to the visible staples. The classic manual's order: the big concept first, then a controls diagram with numbered leader lines, then the details. For Realm, that means the landing page explains a Space as **a labelled diagram of the real, shipped UI** (1 room tabs, 2 who's here, 3 pinned plan, 4 reply), and empty states read as manual pages ("Inviting your party: copy this link, send it to the group chat you already have"). Magazine density, but chunked into short blocks.
- **Bar.** Teenage Engineering for drawing, restraint and humour; Tunic's manual for game feel.
- **Main trap.** This direction sits on top of the 2026 second-order slop look: near-black, one spot colour, hairline rules, mono all-caps labels and decorative 01/02/03. The fixes: numbers must index real things (a callout that points at a real control), never decorate section headings; labels in sentence case, not all-caps mono; the spot ink should not be vermilion or acid green; diagrams must be drawn from the real product, never generated. Don't fake Japanese: use correct Japanese copy or none. Never justify text, even though magazines do.
- **Tokens.** The whole look reduces to `stock`, `ink-1`, `ink-2` and a contrast value. A user theme is a "print run" (bone on black, pink on navy). This is the cheapest direction to theme.

### 3.2 Party Lobby

*A multiplayer lobby: friends in party slots, HUD typography.*

- **Borrow.** The lobby's grammar is Realm's product logic: N slots, each a person with a state (ready, in a match, away, muted); an **empty slot that is literally the invite button**; ready-up; a leader mark; a timer for "ranked at 9". It answers the critique's demand that the first screen be "create a Space, invite someone, see who's in it". From Valorant, take one geometric motif (an offset frame or a corner cut) applied everywhere, and nothing else. From Discord's 2025 call bar, take clear state colours (red for muted, green for camera on). Research corpus: Game UI Database's "Pre-Game & Lobby" and "Matchmaking Lobby" categories.
- **Bar.** Valorant for motif discipline; Discord's call controls for function.
- **Main trap.** Esports cosplay: clip-path corners on everything, all-caps condensed type, black and red aggression, fake telemetry (invented ping and XP), Orbitron or Rajdhani. It also shuts out friend groups who don't play competitive games, and it can drift into a Valorant clone.
- **Accessibility.** Player colours never carry meaning alone; pair each with a slot number, a shape and the name. Capitals only for labels of three words or fewer. State changes announced politely (`aria-live="polite"`); "ready" pulses stop under Pause motion.
- **Tokens.** Neutral base, one action colour ("ready"), an 8-colour player palette checked against the surface, and the motif's size (corner cut, frame offset) as tokens.

### 3.3 Arcade Cabinet

*Pixel art and CRT; the cast as sprites.*

- **Borrow.** Attract mode (the idle screen demonstrates the app), "press start" as the CTA, the high-score table as board leaderboards, cabinet side-art, a fixed hardware palette (PICO-8's 16 colours) and a sprite avatar per user. From Playdate: the constraint is the brand.
- **Bar.** Playdate, plus PICO-8's palette discipline.
- **Main trap.** Generated "pixel art" (inconsistent pixel grids, mixed resolutions, anti-aliased pixels) is itself instantly recognisable slop; this direction needs a real pixel artist and a sprite spec (for example 32x32, a 4-frame idle). Full-screen scanline, bloom and flicker shaders repeat the iGPU lesson from 2026-09-30, and flicker can breach WCAG 2.3.1 (three flashes). Pixel fonts for body text fail dyslexic readers. Synthwave pink and cyan is its own cliché.
- **Accessibility.** Pixel fonts only at 24px and up, or for labels of three words or fewer at integer multiples of their grid; body in AHN; scanlines decorative, never over text, off under Pause motion.
- **Tokens.** A palette index (16 colours), an integer pixel scale, a per-user sprite sheet, and a CRT-effect toggle. Best shipped as an optional theme pack.

### 3.4 Drop

*A streetwear drop page: huge condensed type, items shot on seamless.*

- **Borrow.** Cadence: Supreme drops at 11am every Thursday and has kept a stripped-down site since 2006. Early-access waves as numbered drops ("Drop 004, Thu 18:00"), product shots on a seamless backdrop (Teenage Engineering's catalogue does this), SKU-style metadata, and one enormous condensed word per screen.
- **Bar.** Teenage Engineering's catalogue photography and Supreme's plainness.
- **Main trap.** Realm sells nothing physical, so "items on seamless" becomes rendered stand-ins, the exact generated look the friend objected to, unless the items are real (screens of real Spaces, real clips, real cosmetics). Scarcity mechanics (countdowns, "sold out") on a social app are a dark pattern and hostile to ADHD users. Condensed all-caps for nav or body ruins readability.
- **Accessibility.** Condensed capitals only at 48px and up and for four words or fewer; text never directly on photos (a solid plate behind it); countdowns update per minute and are not live-announced.
- **Tokens.** Monochrome base, one material accent and a "live" colour; the display face's width axis as a token.
- **Fit.** Launch pages and the cosmetics shop, not the daily chat UI.

### 3.5 Holo Card

*Profiles as collectible holographic trading cards, with Steam-showcase customisation.*

- **Borrow.** Steam's structured showcases (fixed slots, earned unlocks, art that composes with the background); Discord Shop's frames and nameplates; the card anatomy (name bar, art window, type line, stats, set number, rarity mark, a back face for details); and Simon Gellner's pokemon-cards-css for physically plausible holo: a pointer-driven gradient, masked to the foil areas, with 3D tilt.
- **Bar.** Steam profiles for the system; poke-holo.simey.me for the effect.
- **Main trap.** The rainbow foil gradient is one step from the iridescent AI gradient, and foil on everything turns the app into a casino. Tying rarity to spending is pay-to-flex, and THEMING.md already rules that accessibility is never paywalled. On the reference iGPU, blend modes and filters on a grid of cards will stutter.
- **Accessibility.** Foil only on the art window and frame, never behind text; static under Pause motion, `prefers-reduced-motion` and reduced transparency; driven by pointer or tilt, never autoplay; only the hovered or focused card runs the effect; rarity shown by label and shape, not colour alone.
- **Tokens.** Frame colour, foil texture (an asset from Realm's catalogue), foil mask pattern, rarity. This maps directly onto THEMING.md Layer 2.
- **Fit.** The profile and hover-card layer of whichever direction wins.

### 3.6 One-bit Desktop

*An early-Mac one-bit desktop; every Space is a window (cf. poolsuite.net).*

- **Borrow.** Each Space is a window (title bar is the Space name, the window menu is its settings); desktop icons are pinned Spaces and DMs; selection is shown by inversion; dither is the only grey; a menu bar with a clock that can carry a joke (Poolsuite's "1997"); Susan Kare-style 32x32 icons. system.css (MIT) is a faithful System 6 reference implementation; Playdate shows one-bit can feel modern.
- **Bar.** Poolsuite for tone and polish, system.css for fidelity, Playdate for modern one-bit.
- **Main trap.** Windows that have to be dragged (WCAG 2.2 SC 2.5.7 requires a single-pointer alternative), overlapping windows on phones (a phone needs a one-window stack), dither behind text (the BDA style guide says avoid background patterns), and nostalgia for an OS most of the target audience never used. Chicago is Apple's design; free recreations exist but have limited character sets.
- **Accessibility.** Full keyboard window management; snap and tile buttons instead of drag; pixel type only in the chrome; body in AHN; focus as a thick inverted outline.
- **Tokens.** `paper`, `ink`, and an optional `case` colour (Playdate yellow, Poolsuite pink). The purest token system of all; ideal as a free theme.

### 3.7 The category standard, done at full craft

*Rail, channel list, chat, member panel: the Discord grammar, built properly.*

- **Borrow.** Discord's grammar and its 2025 decisions: four base themes (Light, Ash, Dark, Onyx), three densities, a resizable channel list, strong state colours. Linear's restraint: a dim sidebar, fewer and smaller icons, softened separators, and themes generated from base, accent and contrast. Telegram's per-chat themes with a day and a night variant.
- **Bar.** The Discord desktop app after the 2025-03-25 refresh, and Linear for finish.
- **Main trap.** Becoming Stoat: a competent clone with no reason to switch. Borrowing Discord's marketing look (blurple gradient, 3D teens) would read as both a knockoff and slop. Note also that this reverses the owner's 2026-09-27 decision against a server rail plus channel list; the owner should confirm that.
- **How it stays Realm.** Through what's actually different: the honest two-tier privacy labels (the critique's best section), Feed and Boards in the same shell, AHN as the UI face (it is visibly unlike gg sans), and theming as a sanctioned feature rather than a banned mod.
- **Tokens.** A Discord-like semantic set (`bg-lowest/base/surface/raised`, `text/muted/faint`, `brand`, states), which BetterDiscord users already think in (THEMING.md §2.1).

---

## 4. Type and colour, per direction

**Shared rules.** AHN carries all reading text (posts, messages, settings, descriptions) at 16px or more, line-height 1.5, left-aligned, no italics for emphasis (bold instead), as the British Dyslexia Association's 2023 style guide recommends. Atkinson Hyperlegible Mono (OFL, Google Fonts, 200–800) carries timestamps, counts, code and IDs, with tabular figures. Display faces never set paragraphs. Every pair below pairs AHN with a face that differs in **width or texture** (condensed, expanded, pixel, heavy gothic); pairing it with another neutral grotesk (Inter, Geist) just muddies it.

**Contrast notes.** Ratios are WCAG 2.x, computed for this report. Text needs 4.5:1 (3:1 at 24px, or 18.66px bold); meaningful borders, focus rings and icons need 3:1. Night text sits at about 15:1 on purpose, below pure white on black (21:1), to reduce halation; a theme's `contrast` input can lower it toward 10:1 or raise it. The BDA guide advises against white backgrounds, so every light edition uses an off-white or tinted paper.

### 4.1 The Manual

| Role | Font | Source and licence |
|---|---|---|
| Display, numerals, chapter heads | Dela Gothic One (one heavy weight; Latin plus Japanese) | Google Fonts, OFL |
| Condensed callout labels, expanded headings | Archivo (variable: width 62–125, weight 100–900) | Google Fonts (Omnibus-Type), OFL |
| Figures, part numbers | Atkinson Hyperlegible Mono | Google Fonts, OFL |

| Token | Night (black stock) | Light (bone stock) |
|---|---|---|
| stock | #111110 | #F1ECDF |
| stock-2 (panels) | #1B1A17 | #E7E1D2 |
| ink-1 (text) | #ECE5D3, 15.0:1 | #151412, 15.6:1 |
| ink-1 muted | #A8A090, 7.3:1 | #5C574C, 6.1:1 |
| ink-2 (spot: sunflower) | #F2BE1A, 10.9:1 as text; as a fill, stock text on it 10.9:1 | Fill only: #F2BE1A with #151412 text, 10.7:1. As text: #8A5A00, 5.0:1 |
| rule (meaningful) | #7A7466, 4.1:1 | #6E6858, 4.7:1 |
| alt ink-2 (fluoro pink) | #FF48B0, 6.1:1 | fill only |

Ink-2 is a fill colour (highlighter bars, callout discs, the primary button) with stock-coloured text on it, which is also how print manuals use a second ink. The BDA guide's "dark text on a yellow background" suggestion makes a yellow-stock light edition a real option.

### 4.2 Party Lobby

| Role | Font | Source and licence |
|---|---|---|
| Player names in slots, section heads | Big Shoulders Display (condensed American gothic, 100–900; a free answer to Tungsten) | Google Fonts (Patric King / XO Type), OFL |
| HUD labels, buttons | Barlow Semi Condensed (DIN-like) | Google Fonts (Jeremy Tribby), OFL |
| Ping, timers, ready counts | Atkinson Hyperlegible Mono | Google Fonts, OFL |

Avoid Orbitron and Rajdhani; they are the esports-template defaults.

| Token | Night | Light |
|---|---|---|
| bg | #0C1015 | #E9EDF1 |
| surface | #151B23 | #FFFFFF |
| slot | #1B2330 | #F3F5F8 |
| empty-slot outline (it's a button) | #6A7A90, 4.0:1 on surface | #80858E, 3.4:1 on slot, 3.7:1 on surface |
| text | #E9EEF3, 16.3:1 | #0C1015, 16.2:1 |
| muted | #93A0AF, 7.2:1 | #4A5664, 6.4:1 |
| ready / action | #36E2A0, 11.4:1; fill with #062016 text, 10.2:1 | text #0A7A52, 5.4:1; fill #36E2A0 with #062016 |
| player 1–4 (on surface) | #FF6B5E 6.2, #4DA3FF 6.6, #FFC145 10.7, #C08BFF 6.9 | #C2362B 5.5, #1F6FD1 4.9, #8A6100 5.5, #7B45C9 5.9 |

### 4.3 Arcade Cabinet

| Role | Font | Source and licence |
|---|---|---|
| Headings (24px and up) | Pixelify Sans (variable weight) | Google Fonts, OFL |
| Marquee titles | Jersey 10 | Google Fonts, OFL |
| Tiny labels on an 8px grid | Silkscreen | Google Fonts (Jason Kottke), OFL |
| One hero word, if any | Sixtyfour or Workbench (SCAN and BLED axes, kept static) | Google Fonts (Jens Kutilek), OFL |
| Mono | Departure Mono | departuremono.com (Helena Zhang), OFL |

Palette: PICO-8's fixed 16 colours.

| Token | Night (bezel and screen) | Light (cabinet flyer) |
|---|---|---|
| bg | bezel #0B0B12; screen #1D2B53 | #FFF1E8 |
| text | #FFF1E8: 17.7:1 on bezel, 12.5:1 on screen | #1D2B53, 12.5:1 |
| muted | #C2C3C7, 7.8:1 on screen | #5F574F, 6.4:1 |
| action | #FFA300, 6.9:1 on screen; fill with #0B0B12 text, 9.8:1 | text #7E2553, 8.4:1 |
| red | #FF004D: 5.0:1 on bezel, but only 3.5:1 on screen (large text and fills only, with #0B0B12 labels at 5.0:1) | fills only (3.6:1 as text fails) |
| green | #00E436, 8.0:1 on screen | #00704A, 5.6:1 (PICO's #008751 fails at 4.1:1) |
| decorative only | #83769C, 3.3:1 on screen | |

### 4.4 Drop

| Role | Font | Source and licence |
|---|---|---|
| Huge condensed display | Anton (one weight), or Archivo at width 62 and weight 900 for more control | Google Fonts, OFL |
| Alternative display | League Gothic (variable width) | The League of Moveable Type / Google Fonts, OFL |
| Sizes, prices, drop times | Atkinson Hyperlegible Mono | Google Fonts, OFL |

| Token | Night (studio black) | Light (seamless paper) |
|---|---|---|
| bg | #0A0A0A | #F2F1EE |
| seamless / surface | #1C1C1C, #262626 | #FFFFFF |
| text | #F3F2EE, 17.7:1 | #0A0A0A, 17.5:1 |
| muted | #A3A19B, 7.7:1 (6.6:1 on #1C1C1C) | #55534E, 6.8:1 |
| accent (kraft, like a swing tag) | #C9A27A, 8.4:1; fill with #0A0A0A text | text #7A5530, 5.9:1; fill #C9A27A with #0A0A0A |
| live | #FF4A3D, 5.9:1 | text #B42318, 5.8:1; white on #D92D20, 4.8:1 |

Kraft rather than vermilion keeps it out of the "near-black plus vermilion" cluster and ties it to something physical.

### 4.5 Holo Card

| Role | Font | Source and licence |
|---|---|---|
| Card names, nameplates | Mona Sans at Expanded width, Black (variable: width 75–125, weight 200–900) | GitHub, OFL |
| Stats, set numbers | Atkinson Hyperlegible Mono | Google Fonts, OFL |

| Token | Night (card table) | Light (binder page) |
|---|---|---|
| table | #0E0E13 | #ECEAF1 |
| card | #1A1922 | #FFFFFF |
| text | #F1EEF6, 15.2:1 on card | #16151C, 18.1:1 |
| muted | #A6A2B5, 7.0:1 | #575466, 7.3:1 |
| foil gold (stamp, frame) | #DDB65C, 9.1:1; fill with #1A1408, 9.5:1 | text #8C6A12, 5.0:1 |
| rarity marks (on card) | common #8B8FA0 5.4, uncommon #4CC38A 7.9, rare #5B9BFF 6.3, epic #B583FF 6.4, legendary #FFB347 9.8 | darker equivalents, not yet picked; each must reach 4.5:1 on white |

The holo layer is a texture asset plus an angle variable, not a colour token, so it can be switched off without changing the palette.

### 4.6 One-bit Desktop

| Role | Font | Source and licence |
|---|---|---|
| Window titles, menus | ChiKareGo2 (a Chicago 12 recreation, used by system.css) | Giles Booth, CC BY (needs attribution) |
| Safer alternative for menus | Pixelify Sans or Silkscreen | Google Fonts, OFL |
| Small labels | Pixel Operator | Jayvee Enaguas, CC0 |
| Mono | Departure Mono | OFL |

| Token | Night (inverted) | Light (native one-bit) |
|---|---|---|
| paper | #111111 | #EFEDE6 |
| ink | #EAE7DF, 15.3:1 | #141414, 15.7:1 |
| disabled text | #9A978F, 6.5:1 | #6A675F, 4.8:1 |
| greys | 50% dither of paper and ink, chrome only, never behind text | same |
| case (optional third token, chrome only) | Playdate-like yellow #FFC72C (ink on it 11.8:1) or Poolsuite-like pink #F3D3D3 (13.2:1) | same |

### 4.7 Category standard at full craft

| Role | Font | Source and licence |
|---|---|---|
| Marketing headlines only | Mona Sans at Expanded width, Bold to Black (the free answer to Discord's Ginto Nord) | GitHub, OFL |
| All product UI and reading text | Atkinson Hyperlegible Next, 15–16px UI, 16px+ messages | Google Fonts, OFL |
| Code, timestamps | Atkinson Hyperlegible Mono | Google Fonts, OFL |

| Token | Night | Light |
|---|---|---|
| bg-lowest / base / surface / raised | #0F1013 / #15171B / #1C1F24 / #252930 | #E9EAEC / #F4F4F5 / #FFFFFF / #FFFFFF with border |
| border (inputs, meaningful) | #687079, 3.6:1 on base | #80858E, 3.7:1 |
| divider (decorative) | #31363E | #E2E3E6 |
| text | #EDEEF0, 15.5:1 | #17181B, 17.8:1 |
| muted | #A2A8B2, 7.5:1 | #565B63, 6.8:1 |
| faint (timestamps; the floor) | #7D838D, 4.7:1 | #6B7079, 4.5:1 on base, 5.0:1 on white |
| brand (amber, kept from today, without the glow) | #FFB23F, 10.0:1; fill with #1A1205, 10.3:1 | text #8F5300, 6.2:1; fill #FFB23F with #1A1205 |
| danger / success | #FF6B6B 6.0, #3DD68C 8.8 | #C93838 5.1, #127A4B 5.4 |

The brand colour is a single token, so keeping amber is a decision the owner can revisit without touching components.

---

## 5. Cross-cutting rules for whichever direction wins

**Token skeleton.** Every direction above maps onto one semantic set, so a user theme or a direction change never touches components: `bg`, `surface-1..3`, `ink`, `ink-muted`, `ink-faint`, `line`, `line-strong`, `accent`, `on-accent`, `accent-ink` (accent used as text), `focus`, `identity-1..8` (players or rarity), `font-display`, `font-ui`, `font-body`, `font-mono`, `radius-*`, `density`, `texture` (foil, dither or scanline asset) and `motion` (0 or 1). Trust UI keeps its own `--r-sys-*` set that themes can't reach (THEMING.md §0). Generate the ramps from three inputs plus contrast, in OKLCH, as Linear does in LCH.

**WCAG 2.2 AA items each direction will hit.**
- 1.4.3 and 1.4.11: the ratios in §4.
- 1.4.1: never colour alone (players, rarity, status).
- 2.2.2 Pause, Stop, Hide: anything that moves for more than 5 seconds stops under the Pause switch (holo shimmer, CRT roll, attract mode, marquees).
- 2.3.1: no flicker above three flashes a second (CRT effects).
- 2.4.11 Focus Not Obscured: sticky headers and docks must be opaque (the critique's see-through nav fails this today).
- 2.5.7 Dragging Movements: windows, cards and reordering need a click alternative.
- 2.5.8 Target Size: 24x24 CSS px minimum.
- 3.3.8 Accessible Authentication: allow paste and password managers; passkeys and QR, as Discord does, help.

**Motion budget.** Use Emil Kowalski's frequency rule: no animation on keyboard actions or high-frequency UI; under 300 ms with ease-out elsewhere. Use Family's delight-impact curve: rare moments (first Space created, first invite accepted) may celebrate. The Pause switch kills every ambient loop.

**Performance.** Budget every effect for the reference iGPU (AMD Radeon 610M): no full-screen noise, foil or scanline shaders at full resolution; at most one card or window running an effect at a time.

**Imagery.** Use only imagery Realm makes or users own: screenshots of the shipped app, commissioned illustration in one style, user content. Nothing that could belong to another product.

---

## 6. Sources

Dates are publication dates where the page gives one; otherwise the access date (2026-10-02) is noted.

**AI-slop tells**
- Adam Wathan on X, apology for `bg-indigo-500`, 2025-08-07: https://x.com/adamwathan/status/1953510802159219096
- funboy322/avoid-ai-design (67 tells, including second-order defaults), accessed 2026-10-02: https://github.com/funboy322/avoid-ai-design
- 925 Studios, "AI Slop Fonts and Gradients", accessed 2026-10-02: https://www.925studios.co/blog/ai-slop-design-tells
- Mania Design, "Spot the Slop", 2026-07-23: https://www.mania.design/blog/spot-the-slop-a-ui-designers-guide-to-fixing-ai-defaults/
- SmoothUI, "AI Design Slop", accessed 2026-10-02: https://smoothui.dev/blog/ai-design-slop
- Matt Ström-Awn, "Expansion artifacts", accessed 2026-10-02: https://mattstromawn.com/writing/expansion-artifacts/
- Wikipedia, "Signs of AI writing", accessed 2026-10-02: https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing

**Discord**
- Logos Wiki, Discord (2021-05-13 rebrand, #7289DA to #5865F2, Ginto Nord), accessed 2026-10-02: https://logos.fandom.com/wiki/Discord
- Know Your Meme, rebrand criticism and accessibility complaints, 2021: https://knowyourmeme.com/news/discord-rebrand-criticized-by-users-over-new-logo-and-possible-accessibility-issues
- Envato Tuts+, "What Fonts Does Discord Use?" (gg sans by Colophon, 2022-12-01), accessed 2026-10-02: https://design.tutsplus.com/articles/what-fonts-does-discord-use--cms-108779
- TechCrunch, Discord mobile redesign, 2023-12-05: https://techcrunch.com/2023/12/05/discord-app-redesign-mobile
- Dexerto, users cancelling Nitro over the mobile layout, 2023-12: https://www.dexerto.com/tech/discord-users-are-cancelling-their-nitro-after-new-mobile-layout-update-2421053/
- Discord blog, "Revamped Overlay & Refreshed Desktop", 2025-03-25: https://discord.com/blog/player-release-q12025
- PiunikaWeb, mobile redesign to undo parts of the 2023 overhaul, 2026-03-19: https://piunikaweb.com/2026/03/19/discord-mobile-app-redesign-desktop-ui/

**Steam**
- Steam Points Shop, profile backgrounds (captured as `ref-steam-points.jpg`), 2026-10-02: https://store.steampowered.com/points/shop/c/backgrounds
- Steam Level Forge, profile customisation (showcases one per 10 levels), accessed 2026-10-02: https://steamlevelforge.com/en/blog/steam-profile-customization
- Steam Community guide, uploading long images for showcases, accessed 2026-10-02: https://steamcommunity.com/sharedfiles/filedetails/?id=748624905

**Valorant, Nintendo, Playdate, Teenage Engineering**
- VALDB, VALORANT colours and fonts, accessed 2026-10-02: https://valdb.gg/brand/
- Clip Content, "The playful design details of the Playdate console", 2023-03-13: https://clipcontent.substack.com/p/the-playful-design-details-of-the
- Playdate Help, "Designing for Playdate" (Roobert, 1-bit type rules), accessed 2026-10-02: https://help.play.date/developer/designing-for-playdate/
- Fudge, teenage.engineering tokens (Univers Te, palette), accessed 2026-10-02: https://design.withfudge.com/tokens/teenage.engineering
- SFMOMA, interview with Jesper Kouthoofd, accessed 2026-10-02: https://www.sfmoma.org/read/stay-curious-stay-naive-an-interview-with-teenage-engineering-jesper-kouthoofd/

**Linear, Arc, Family, Emil Kowalski, Poolsuite**
- Linear, "How we redesigned the Linear UI (part II)", 2024-03-28: https://linear.app/now/how-we-redesigned-the-linear-ui
- Linear, "A calmer interface for a product in motion", 2026-03-12: https://linear.app/now/behind-the-latest-design-refresh
- Fudge, arc.net design tokens, accessed 2026-10-02: https://design.withfudge.com/share/arc.net-design
- Benji Taylor, "Family Values", 2024-07-08: https://benji.org/family-values
- Emil Kowalski, "You Don't Need Animations", accessed 2026-10-02: https://emilkowal.ski/ui/you-dont-need-animations
- Poolsuite (captured as `ref-poolsuite.jpg`), 2026-10-02: https://poolsuite.net/
- Setproduct, "Retro and brutalist UI design: a 2026 field guide", 2026-06-05: https://www.setproduct.com/blog/retro-brutalist-ui-design-2026
- sakofchit/system.css (System 6, MIT; Chicago and Geneva recreations by @blogmywiki), accessed 2026-10-02: https://github.com/sakofchit/system.css/

**Direction-specific**
- GameSpot, "How Tunic's Cool In-Game Manual Was Made", 2022: https://www.gamespot.com/articles/how-tunics-cool-in-game-manual-was-made/1100-6507719/
- PlayStation Blog, "The creation of Tunic's invaluable in-game manual", 2022-09-21: https://blog.playstation.com/2022/09/21/the-creation-of-tunics-invaluable-in-game-manual/
- NME, "The lost art of the video game manual", accessed 2026-10-02: https://www.nme.com/features/gaming-features/the-lost-art-of-the-video-game-manual-3088607
- Game UI Database, Pre-Game & Lobby, accessed 2026-10-02: https://www.gameuidatabase.com/index.php?scrn=43
- BDOW, "Supreme Streetwear's Insane Success" (site unchanged since 2006; Thursday 11am drops), accessed 2026-10-02: https://bdow.com/stories/supreme-marketing/
- Simon Gellner, Pokémon Cards CSS holo effects: https://poke-holo.simey.me/ and GIGAZINE coverage, 2025-09-02: https://gigazine.net/gsc_news/en/20250902-pokemon-cards-css/
- Stoat (formerly Revolt), Wikipedia, accessed 2026-10-02: https://en.wikipedia.org/wiki/Stoat_(software)

**Fonts and accessibility**
- Braille Institute, Atkinson Hyperlegible Next launch (7 weights plus italics, 150+ languages), 2025-02: https://www.brailleinstitute.org/about-us/news/braille-institute-launches-enhanced-atkinson-hyperlegible-font-to-make-reading-easier/
- googlefonts/atkinson-hyperlegible-next-mono: https://github.com/googlefonts/atkinson-hyperlegible-next-mono
- Google Fonts specimens: Archivo https://fonts.google.com/specimen/Archivo · Big Shoulders https://fonts.google.com/specimen/Big+Shoulders · Sixtyfour https://fonts.google.com/specimen/Sixtyfour · Workbench https://fonts.google.com/specimen/Workbench
- GitHub, "Introducing Mona Sans and Hubot Sans" (OFL; width 75–125): https://github.blog/news-insights/company-news/introducing-mona-sans-and-hubot-sans/ and v2.0 release: https://github.com/github/mona-sans/releases/tag/v2.0
- Departure Mono (OFL): https://departuremono.com/
- ChiKareGo2 (CC BY), Giles Booth, 2017-04: http://www.suppertime.co.uk/blogmywiki/2017/04/chicago/
- Pixel Operator (CC0): https://fontlibrary.org/en/font/pixel-operator
- British Dyslexia Association, Dyslexia Style Guide 2023: https://cdn.bdadyslexia.org.uk/uploads/documents/Advice/style-guide/BDA-Style-Guide-2023.pdf
- W3C, Understanding SC 2.5.7 Dragging Movements: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
