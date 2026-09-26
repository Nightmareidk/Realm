# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated (user asked for a recommendation): Next.js 16 + React 19 + TypeScript web app (landing, download portal, and full web app in one codebase), Tailwind CSS 4 over a CSS-variable token layer, Base UI primitives, Motion for springs/gestures. Backend: Fastify API, dedicated WebSocket gateway, BullMQ workers, PostgreSQL, Valkey/Redis, S3-compatible storage. pnpm + Turborepo monorepo. Full rationale in `docs/ARCHITECTURE.md`.

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
- Terminology: the codebase calls servers "communities". **Open decision:** the user-facing name for a community/server.

## Brand Commitments

- Name: **Realm** (trademark search pending before public launch).
- Original identity — must not look or read like Discord, TikTok, Instagram, or Reddit.
- Modern, premium, polished; fast and responsive; smooth animations that don't make the site heavy.
- **Dark mode is a first-class experience**, not an inverted afterthought; light mode also supported.
- Landing site and web app must feel like one coherent product.
- Honest claims only, especially about privacy and security.

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
