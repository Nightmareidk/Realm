# Why the app frame felt "limited and congested", and what modern apps do instead

2026-10-05. The owner's verdict on the signed-in app (Home at about 830 CSS px wide): "too limited and congested… doesn't feel like a real app GUI, only AI slop". Their steer, from the structured questions:
- references: **Discord (2025 desktop)** and **Instagram / Threads web**;
- Home leads with **your Spaces, live**;
- **spacious** density;
- keep the coloured glow but **much fainter**.

Captures of today's frame: `frontend/web/.impeccable/review/shell-now/` (830, 1280 and 1536 wide). Previews: `.impeccable/mocks/shell2/`.

## What was wrong (audit of today's build)

1. **It collapses too early.** Below 64rem (1024px) the sidebar hides behind a menu button, the destinations drop to icons only, and Here now disappears. At a common laptop window (about 830 CSS px at 125–150% Windows scaling) the app is one floating panel with five unlabelled icons. That is the "limited" feeling.
2. **Floating rounded panels on a glowing gradient.** Three separately boxed cards with gaps, each with its own corner and ring, over a lit ground. They read as a template or mockup, not as an application window.
3. **Marketing type inside the product.** The display face at hero scale ("Hey, Noor." at 3rem+), and bold weight on nearly every label, row and tab. Nothing leads, so everything competes: "congested".
4. **Filler where content should be.** Half the sidebar and most of Here now are "coming soon" paragraphs. Home is only a setup checklist. There is nothing live on the first screen.
5. **Pills everywhere:** tabs, status, actions and links all share one bubbly shape. The top bar mixes filled, outlined and bare icon buttons.

## What modern apps do

- **Linear's 2025 refresh:** it reduced visual noise in "the sidebar, tabs, headers, and panels", and spent its effort on aligning labels, icons and buttons. Hierarchy comes from layered surfaces built from three theme inputs (base, accent, contrast), not from heavy borders. Display type is kept for headings; the UI face does everything else. ([Linear, "How we redesigned the Linear UI"](https://linear.app/now/how-we-redesigned-the-linear-ui))
- **Discord's March 2025 desktop refresh:**
  - Compact, Default and Spacious density options;
  - a resizable channel list;
  - new Ash and Onyx dark themes;
  - call controls gathered into one bar with stronger colour cues.

  Density is a first-class setting, and the lists stay visible. ([Discord changelog, 25 Mar 2025](https://discord.com/blog/discord-update-march-25-2025-changelog); [Engadget](https://www.engadget.com/gaming/pc/discords-redesigned-pc-app-has-multiple-dark-modes-a-new-overlay-and-more-160019822.html); [How-To Geek](https://www.howtogeek.com/discord-desktop-better-game-overlay-themes/))
- **Material 3 window size classes:** medium is 600–839dp and expanded is 840–1199dp. A navigation rail is used across both of these; navigation is not hidden behind a drawer. So at 830px, navigation should stay visible with labels. ([Material 3 breakpoints](https://m3.material.io/foundations/layout/applying-layout); [navigation drawer guidance](https://m3.material.io/components/navigation-drawer/guidelines))
- **Slack's 2023 redesign:** it consolidated navigation into a few labelled destinations (Home, DMs, Activity, Later) to make the sidebar "less cluttered". Fewer, clearer places, with content inside them. ([Engadget](https://www.engadget.com/slacks-latest-redesign-has-a-dedicated-dm-tab-and-a-discord-style-activity-view-130032154.html); [Stanford UIT](https://uit.stanford.edu/service/slack/redesign2023))
- **Instagram and Threads web:** a labelled left navigation, one content column, faces and media first, and almost no chrome. (This comes from the owner's chosen references; no external source is needed.)
- **Impeccable's Operate guidance:**
  - display fonts don't belong in labels;
  - use a tighter type scale (1.125–1.2 ratio);
  - use a second neutral layer for side panels;
  - make responsive behaviour structural, by collapsing and moving things rather than hiding them.

## What the previews change (all three directions)

- **Navigation never goes icon-only.** Under 1024px the five destinations move into the top of the sidebar as labelled rows, and the sidebar stays visible down to tablet width.
- **Fewer boxes.** Either flush panes split by hairlines (A), or one content sheet with the sidebar on the ground (B, C).
- **Product type.** The display face only for the greeting and Space names, at 23–32px. Atkinson does the rest, mostly at 600 rather than 800.
- **Home shows live things:**
  - who's in voice, with Join as the one action;
  - your Spaces with unread counts and the last message;
  - the faces of who's around.

  Setup shrinks to one line or a slim banner.
- **The glow is about a third of today's strength.**

The three structures were dealt by Impeccable's surface seed from a ranked list of seven:
- **A · Live frame:** edge-to-edge panes, and the sidebar shows who's in voice.
- **B · Lobby:** a row of faces, then your Spaces as picture tiles.
- **C · Wall:** an Instagram-style left nav, a live hero tile and poster rows.

The four structures not dealt:
- a Threads-style column of Space blocks with inline messages;
- list–detail;
- a command-centre Home;
- a bento dashboard. This one was excluded as the generic rut.
