# Realm — Roadmap

> Launch focus: **friend groups & gamers**. Every phase ends with an exit bar; we don't start the next phase with the previous bar unmet.
> Time estimates assume a very small team working with AI assistance; they're planning guides, not promises.

---

## Phase 0 — Foundations *(~1 week)*
- Monorepo (pnpm workspaces, Biome, TS strict), shared tsconfig, CI (typecheck · lint · test · build).
- Docker Compose: Postgres, Valkey, MinIO, Mailpit.
- `contracts` (IDs, permissions, errors, gateway protocol), `db` (Drizzle schema + migrations + seed), `server-core` (config, logger, snowflake, event bus).
- Product truth (`PRODUCT.md`) and the visual direction for Realm; design tokens.

**Exit:** `pnpm dev` boots web + api + gateway + worker against local infra; CI green.

## Phase 1 — Core product *(private alpha)*
**Public web**
- Landing page (hero, what Realm is, feature showcase with real product mockups, communities, privacy — *honest* claims only, cross-platform, "Use Realm in browser", download section with Windows/macOS/Linux + Google Play/App Store badges driven by `/v1/releases`, footer).
- `/download` portal page, legal/help stubs.

**Auth & accounts**
- Sign up (with age gate), login, logout, email verification (code + link), forgot/reset password, change password, session/device list with revoke.
- *Status (2026-10-02): built on the web, end to end against the API.*

**App shell**
- Responsive shell: a dock of the five destinations (no community rail; see docs/UX-ARCHITECTURE.md), content, context panel; mobile-web navigation; command palette (⌘K); dark-first theming with light mode; keyboard navigation; skeleton/empty/error states.
- *Status (2026-10-02): the frame (dock, phone tabs, account menu), Home's first-run state, the verify-email banner and Settings (Account, Appearance, Devices) are built. Travel (⌘K) and the Here now panel's content come with Spaces.*

**Profiles**
- Avatar, banner, bio, display name, username, pronouns; posts + media tabs; followers/following; friends; privacy settings (profile visibility, DM policy, friend requests, presence, read receipts).

**Communities**
- Create/edit/delete; public/private; join via discovery or invite; categories + text channels + board channels; roles & permissions with channel overwrites; kick/ban/timeout; audit log; basic discovery list.
- *Status (2026-10-04): Spaces (create, rename, leave, delete), chat rooms, invites with link settings and the `/i/{code}` join page (sign up from it), Explore's public list, and the starter Everyone and Mods roles are built. Board rooms wait for posts; the role editor, room access, kick/ban/timeout UI and the audit log come next.*

**Messaging**
- DMs + group DMs (**labelled "not end-to-end encrypted yet"**), community text channels; real-time delivery, typing, presence, read states/unread badges, read receipts (DMs, opt-out), replies, reactions, edit/delete, pins, image/file attachments, mentions.
- *Status (2026-10-04): room chat is built: the realtime gateway, live delivery, typing, presence, read positions and unread dots, replies, edit and delete, photos, videos, files, voice messages and shared places. Voice rooms (LiveKit: voice, video, screen sharing) are in, ahead of Phase 3.*
- *Status (2026-10-10): DMs and group chats are built (Messages: inbox with search, All/Unread/Groups, pinned and muted chats, who's around; new-message picker; group names, adding people, leaving; "Not end-to-end encrypted yet" chip and explainer; DM push notifications), plus reactions (quick six, any emoji, double-click heart), message pins, "Seen" read receipts (mutual), and an emoji picker. Research: `docs/research/2026-10-messaging-apps-survey.md`. Mentions, polls and ready checks, chat backdrops, status notes and notification levels are next.*

**Posts & feed**
- Text / image / link posts on profiles and community boards; nested comments; votes/likes; saves; share links; Home / Following / Communities feeds with infinite scroll.

**Safety basics**
- Report users/posts/comments/messages; block & mute; community mod queue; rate limits; new-account limits.
- *Status (2026-10-04): built for messages, people and Spaces: automatic spam limits, reports that hide messages on their own, Space mod queues, timeouts, kicks, bans, the activity log, block and mute. Designed so no one at Realm reviews messages by hand (owner).*

**Exit:** a friend group can sign up, create a community, chat in real time, DM, post and comment — on desktop and mobile browsers — with p95 API < 150 ms locally, no a11y blockers (WCAG 2.2 AA on core flows), and passing e2e tests.

## Phase 2 — Private beta: trust *(the "can we let strangers in" phase)*
- **E2EE DMs & group DMs (MLS/OpenMLS)** as the default; device management, cross-signing, safety numbers, Secure Backup, message franking. Alpha plaintext DMs frozen read-only.
- 2FA (TOTP) + passkeys; breached-password checks; security activity log UI.
- Notification center + Web Push; per-community/channel notification settings.
- Moderation v2: join requests, AutoMod-style keyword/link filters, slowmode, mod tools on posts, report franking for E2EE.
- Search v1 (Postgres FTS) across users, communities, posts, channel messages (non-E2EE).
- Media pipeline hardening (EXIF stripping, variants, CSAM hash matching), GDPR data export & account deletion, transactional outbox, observability/SLOs.
- External security review of auth + E2EE.

**Exit:** E2EE audited; T&S launch gates (ARCHITECTURE.md §10) met.

## Phase 3 — Public launch: voice & video *(the gamer hook)*
- **Voice rooms** in communities (LiveKit), push-to-talk / voice activity, mute/deafen, per-user volume, **screen share**; 1:1 and small-group **E2EE calls** in DMs.
- Video posts and **Clips** (short vertical video feed) via managed transcoding; creator profile polish.
- Discovery: trending topics, suggested communities & people (explainable signals).
- OAuth sign-in (Google, Apple; account import helpers); invite links with rich previews.
- Load testing, rate-limit tuning, chaos drills; trademark cleared.

**Exit:** public launch.

## Phase 4 — Native apps
- **Desktop (Electron)**: bundled signed web app, auto-update from `/v1/releases`, global push-to-talk, OS notifications, keychain-backed E2EE keys → `.exe` / `.dmg` / AppImage+deb on the download portal.
- **Mobile (Expo)**: iOS + Android using `sdk`/`contracts`/`design-tokens`; native navigation; push with on-device decryption; store listings → the badges go live.
- Web E2EE code-verification extension; key transparency.

## Phase 5 — Scale & depth
- Recommendation system (event pipeline → ClickHouse → ranking service) for Home and Clips.
- Stories; richer creator tools; community monetization (if/when the business model calls for it).
- Dedicated search engine; message store migration if Postgres limits approach; multi-region.

## Later — Make it yours: themes, profiles and a paid tier *(owner request, 2026-10-02)*
Users theme Realm "to anything", the way people mod Discord with BetterDiscord (ClearVision, Dark Matter, Frosted Glass and so on), except here it's a built-in, sanctioned feature, and profiles can be customised the way Steam profiles are.
- **Themes, free:** colours, surfaces, fonts from an allowlist, background images/video from Realm's own media pipeline, blur and transparency; a theme editor, share links, a gallery. Contrast is checked; accessibility themes are always free.
- **Realm+ (paid):** animated backgrounds, profile effects and frames, per-Space themes for owners, a marketplace with creator credit.
- **Profiles, Steam-style:** backgrounds, showcases, badges, frames, mini-profiles.
- **Never themeable:** privacy and encryption labels, safety warnings, the report button.
- Design doc: `docs/THEMING.md`. What it means **now**: every colour, radius, font and surface in the product comes from semantic design tokens, so a theme is a set of token overrides and works the same on web and native.
