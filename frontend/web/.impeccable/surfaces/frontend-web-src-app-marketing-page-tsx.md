---
version: 1
slug: "frontend-web-src-app-marketing-page-tsx"
primary_target: "frontend/web/src/app/(marketing)/page.tsx"
related_targets: ["frontend/web/src/features/home"]
---

# Surface: the front page (replacement world, 2026-10-02)

Mode: Persuade. The visitor decides whether to bring their group to Realm.

History: the previous world ("The Eclipse Hour": space diorama, black hole, glossy mascots floating as stickers, a 12-second astronaut intro) was judged AI slop by the owner's friend and by an outside critique (docs/research/2026-10-critique-current-site.md). Over three rounds of rendered previews the owner chose "Profile canvas" plus "Phones in motion", asked to bring in the holo card (as part of the profile, not the identity) and the party lobby (who's here), and asked for sick scroll animation, a loading page, and rich backgrounds instead of flat black. They rejected a fused holo-card prototype as reading like a "trading card site" and "too simple". Research: real scroll captures of 18 sites in docs/research/scroll-captures/ (Partiful, Discord, Apple, Active Theory, Igloo, Raycast and others) and reports in docs/research/.

## Direction contract

THESIS: Your group and your profile, in motion. The real app rides through the page on phones that turn as you scroll, and your profile takes over the page's colour when you customise it. Refuses the old space diorama with mascot stickers, and the template dark SaaS page of feature cards on black.

OWN-WORLD: Ink base lit by living colour fields taken from the profile theme in view (Mint by default; Orchid, Aqua and Ember when the theme swaps) under fine grain; Funnel Display headlines set tight; Atkinson Hyperlegible Next for every word you read; the real app UI inside rounded phone and window frames; one action colour that follows the active theme; holo foil only on the profile card's edge; no mascots floating loose.

STORY: I see it's a real app for my group (the phones), I see my friends are there and what they're doing (the lobby), I see my profile can look like me (the canvas), I trust it because it's honest about privacy, and I open Realm in my browser.

FIRST VIEWPORT: First visit: a short loading page where one phone assembles in the dark as the real assets load, then becomes the centre phone of the hero. Hero: "All your group's stuff. One app." centred over three phones fanned in 3D (chat, clips, profile), lit from below by a mint light field, the two actions under the headline, nav backed and readable.

FORM: Owner-locked fusion of the dealt "Phones in motion" and "Profile canvas" cards from re-roll round 1 of seed a9cd8908, with the holo card and party lobby folded in. Signature interaction: scrolling through the profile canvas swaps its theme, and the whole page's light and action colour follow it.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
