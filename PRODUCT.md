# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated (user asked for a recommendation): Next.js 16 + React 19 + TypeScript web app (landing, download portal, and full web app in one codebase), Tailwind CSS 4 over a CSS-variable token layer, Base UI primitives, Motion for springs/gestures. Backend: Fastify API, dedicated WebSocket gateway, BullMQ workers, PostgreSQL, Valkey/Redis, S3-compatible storage. pnpm workspace monorepo split into frontend/, backend/ and shared/. Full rationale in `docs/ARCHITECTURE.md`.

## Users

**Primary (launch focus, user-confirmed): friend groups and gamers.** Small circles of friends who already hang out online — gaming squads, school/uni friend groups, Discord-native people — who want one place to chat in real time, keep private conversations private, share clips and posts with each other, and drift into bigger interest communities around the games and topics they care about.

Secondary (later phases): creators and their audiences (short video, profiles), and topic communities (discussion boards).

Context of use: evenings and weekends, often alongside a game or on a second monitor; long sessions on desktop, quick check-ins on a phone browser. Many will be on their phone without installing anything.

## Product Purpose

Realm is one social platform that combines real-time community spaces (servers, channels, group chats, DMs, voice later), a short-form video and media feed, rich personal profiles, and topic-based discussion boards — so a friend group's chat, its shared media, and its wider communities live in one place instead of four apps.

It must be a real product in the browser (not a marketing site): people sign up, chat, browse communities, post, and use most core features on the web. The public site doubles as the download portal for native apps once they exist (Windows .exe, macOS, Linux, Google Play, App Store), always offering two paths: **use Realm in the browser** or **download the app**.

Success for Phase 1: a friend group can sign up, create a community, talk in real time, DM each other, and post/comment — comfortably on desktop and mobile browsers.

## Positioning

The only place where a friend group's private chat, its public communities, and its media feed are the same fabric: one identity, one set of friendships, one permission and moderation model — with private conversations that are genuinely end-to-end encrypted (once shipped) and honest labels everywhere else. Original branding and UX; explicitly **not** a clone of Discord, TikTok, Instagram, or Reddit.

## Operating Context

- Web first (desktop, tablet, mobile browsers). Native Android, iOS, Windows, macOS, Linux apps come later and reuse the same backend and API.
- Users switch between chat (high-frequency, keyboard-driven), feeds (scroll, media), and community management (settings, roles, moderation).
- Real-time is expected: messages, typing, presence, unread counts update live.
- Many features share one surface, so navigation must stay easy despite breadth.

## Capabilities and Constraints

- **Phase 1 scope (confirmed):** public landing page; auth (sign up, login, forgot password, email verification, session/device list); core app shell; user profiles; basic communities; text channels; direct messages; real-time messaging; basic post/feed system.
- Later: voice/video rooms, short-form video feed, stories, recommendations, OAuth, native apps.
- **Encryption truth (binding):** DMs and small group DMs become end-to-end encrypted (MLS) in Phase 2, before public launch. Until then DMs are labelled "not end-to-end encrypted yet". Public/large communities, posts, and feeds are **not** E2EE and must never be described as such. No fake security.
- Download buttons are placeholders ("coming soon") until native apps exist; the structure must be ready for real links.
- **Sign-up (user-confirmed):** open sign-up, presented honestly as *early access*. Primary CTA: use Realm in the browser now.
- **Terminology (user-confirmed):** a community/server is called a **Space** in all user-facing copy ("create a space", "join a space"). The codebase and API call them `communities`. Avoid "realms" for communities (collides with Minecraft Realms and the product name).

## Brand Commitments

- Name: **Realm** (trademark search pending before public launch).
- **Current direction (user decisions, 2026-10-02): "Your group and your profile, in motion."** It replaces the earlier "another universe" world (Eclipse logo, aurora palette, astronaut and alien cast, Bricolage Grotesque, the Stratosphere day edition), which the user and a friend judged "AI slop". Treat that world as an anti-reference.
  - Chosen from rendered previews: the front page is **"Phones in motion"** (one 3D phone turning through the app's screens as you scroll) plus **"Profile canvas"** (a profile that builds itself, then changes theme and the whole page follows). The holo card is a profile element, not the identity; the party lobby ("who's here now") is in.
  - Look: an ink ground lit by soft colour fields in the current theme, with grain; never plain black. Funnel Display for statements, Atkinson Hyperlegible Next for reading. The mark is a ring with the theme's action colour caught inside it. Four themes: Mint (default), Orchid, Aqua, Ember. DESIGN.md holds the details.
  - Not cartoonish, not gamer-only, not retro, not generic SaaS; "modern social app, dark-first, playful, polished, highly usable". Scroll animation is welcome when it is good and not overdone.
  - Every surface (sign-in, the app, settings, help and legal pages) moves to this world. Until they do, DESIGN.md's Migration note lists what is still on the old look.
- **Night is the default. Day is an option**, to be redesigned in this world later. Users will be able to theme Realm "to anything" later (docs/THEMING.md).
- **Spaces UI:** must NOT look like Discord. No server-icon rail plus channel list. Rooms appear as tabs, chat as bubbles, with a presence panel.
- Original identity: must not look or read like Discord, TikTok, Instagram, or Reddit.
- Modern, premium, polished; fast and responsive; smooth animations that don't make the site heavy (the owner's machine has an integrated AMD Radeon 610M; measure there).
- **Dark mode is a first-class experience**, not an inverted afterthought; light mode also supported.
- Landing site and web app must feel like one coherent product.
- Honest claims only, especially about privacy and security.
- **Accessibility:** a priority for dyslexic readers and people with short attention spans (legible body face, clear hierarchy, Pause motion), and WCAG 2.2 AA throughout.
- **Design priorities (user-confirmed 2026-09-27):** modern, user-friendly, premium and feature-rich without clutter. Clear navigation and information hierarchy, and features discovered gradually. Social, immersive, sleek; one consistent design language across landing and app. Full UX structure in `docs/UX-ARCHITECTURE.md`.
- **Headline belief (user-confirmed):** "one app instead of four": a visitor should leave the first screen understanding that chat, the feed, profiles and discussion boards live together in Realm.
- **Anti-references (user-confirmed):** must not read as (1) Discord with a new logo, (2) a generic SaaS template (gradient hero, three feature cards, logo cloud), (3) try-hard gamer aesthetic (RGB neon, aggressive angles, energy-drink esports), (4) cold corporate collaboration software, or (5) generic AI-made spectacle (purple nebula glow, mascots, glow everywhere).
- **Process (user preference):** show rendered previews and let the user choose before building a new look or layout; when asked for ideas or previews, give only those.

## Evidence on Hand

None yet. No users, testimonials, press, metrics, logos, screenshots, or partner brands exist. Native apps do not exist yet. Product mockups on the landing page must be built from the real UI (or clearly illustrative demo content labelled as such) — never fabricated metrics, user counts, reviews, or "trusted by" logos.

## Product Principles

1. **Your people first.** The friend group is the unit: presence, DMs, and small spaces come before algorithmic reach.
2. **Private means private.** Where we promise E2EE, it's real; everywhere else we say exactly what protection applies.
3. **Many features, one mental model.** Channels, boards, and profiles share one identity, one permission system, and one navigation grammar.
4. **Fast is a feature.** Real-time, instant-feeling interactions on any device, including a mid-range phone browser.
5. **Browser is a first-class home.** Installing an app is optional, never required.

## Accessibility & Inclusion

User requirement: good accessibility. Target WCAG 2.2 AA on all core flows (delegated), full keyboard operation (chat is keyboard-heavy), screen-reader-correct live regions for real-time updates, `prefers-reduced-motion` honored, sufficient contrast in both dark and light themes.
