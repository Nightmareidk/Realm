# Realm — UX Architecture

> Status: v1, 2026-09-27. Governs navigation, information hierarchy, and how features are introduced.
> Visual world: **The Atlas**, a night map (see the landing surface brief and, after the first build, DESIGN.md).

## Design philosophy

**One world for your people: calm on the surface, deep underneath.**
Realm is a single place where your friends, your Spaces, your conversations and your feed live together. You always know where you are, where your people are, and how to get anywhere in one move. Everything is one step away; nothing shouts.

Five principles, in priority order:

1. **People first.** Friends, Spaces and DMs are the center. Content orbits them, not the other way round.
2. **Every feature has a home.** One destination per job. No feature lives in two places with two different behaviors.
3. **Simple by default, deep on demand.** The first screen shows what 80% of people need; power is one deliberate step away (menu, panel, shortcut), never in the way.
4. **One grammar.** Every place (Space, DM, profile) is laid out the same way; every item (message, post, comment, clip) has the same actions in the same order.
5. **Dark, crafted, alive, honest.** Dark is the primary experience. Motion informs. Labels about privacy are exact.

## Product structure

Four levels. Users only ever go one level deeper at a time.

| Level | What | Examples |
|---|---|---|
| 1. Destinations | Always visible, five of them | Home, Spaces, Messages, Feed, Explore |
| 2. Context | The list you pick from inside a destination | A Space's channels, the DM list, feed tabs |
| 3. Detail | The thing itself, plus an optional side panel | A channel, a thread, a post, a profile |
| 4. Settings & tools | Behind a gear or menu, shown only to people who can use them | Space settings, roles, moderation, account settings |

**The five destinations**

- **Home**: your people and what changed. Friends online, unread DMs and mentions, activity from your Spaces, and "continue where you left off". It's the hub where you start.
- **Spaces**: communities, with text channels, boards (threaded posts and votes), members, and voice later.
- **Messages**: DMs and group chats, with privacy status always visible.
- **Feed**: posts and clips from people and Spaces you follow, in two tabs: *Following* (chronological) and *For you* (explainable picks).
- **Explore**: search and discovery for Spaces, people, topics and trending posts.

**Always-available (not destinations):** Notifications (inbox panel), Create (one `+` for post, clip, Space, group chat, invite), your Profile & Settings (avatar menu), and **Travel** (the command palette).

How the landing page's four regions map to the app: Spaces → Spaces + Messages; Feed → Feed (posts, clips); Profiles → profiles everywhere; Boards → board channels inside Spaces, surfaced in Feed and Explore.

## Navigation system

### Desktop (≥ 1024 px): rail + context + content + optional panel

```
┌────┬───────────────┬──────────────────────────────────┬──────────────┐
│ ⌂  │ CONTEXT       │  HEADER  breadcrumb · search ⌘K  │  PANEL       │
│ ✉  │ (channels,    ├──────────────────────────────────┤  (members,   │
│ ▤  │  DM list,     │                                  │   thread,    │
│ ◎  │  feed tabs)   │           CONTENT                │   profile    │
│────│               │                                  │   peek)      │
│ S1 │               │                                  │  collapsible │
│ S2 │               │                                  │              │
│ S3 │               │                                  │              │
│ +  │               │  composer / actions              │              │
│ @me│               │                                  │              │
└────┴───────────────┴──────────────────────────────────┴──────────────┘
```

- **Rail** (72 px): the four global destinations on top (Home, Messages, Feed, Explore), then your Spaces as icons (reorderable, foldable into groups), then `+` to create or join, then your avatar (status, profile, settings) pinned at the bottom. Unlike Discord's server-only rail, the destinations and your Spaces sit together, so *every* part of Realm is one click from anywhere.
- **Context column** (260 px, resizable): changes with the destination. It can be collapsed for focus.
- **Header**: breadcrumb ("Late Night Lobby › #general"), the global search field that opens Travel, and the place's actions.
- **Panel** (320 px): members, thread replies, profile peek, pinned items. It's closed by default and remembered per place.

### Tablet (768–1023 px)
Rail + content. The context column becomes a slide-over drawer (swipe or button), and the panel becomes an overlay sheet.

### Mobile (< 768 px): bottom tabs
`Home · Spaces · Feed · Messages · You`, with Notifications and Create in the Home/Feed headers and Explore behind the search icon in every header. Detail screens push on top with a clear back affordance, and threads and profile peeks open as sheets.

### Wayfinding details
- **Travel (⌘K / Ctrl K)**: jump to any Space, channel, person, setting or action by typing. It's the power user's whole navigation system, and it's listed in the header so everyone can find it.
- **Breadcrumbs** in every header, and browser Back always does what you expect (real URLs for every place).
- **Unread language**: a neutral dot for "new stuff" and a magenta count for "someone needs *you*" (mentions, replies, requests). Magenta is never used for plain unread.
- **Space identity**: each Space picks a map ink (green, yellow, blue, brown) used subtly in its icon and header, so you recognise where you are at a glance without the UI turning rainbow.

## Keeping many features manageable

1. **Progressive disclosure by role and context.** Moderation tools appear only for moderators, role editors only for people who can manage roles, voice controls only in Spaces with voice channels, and creator stats only once you've posted clips.
2. **One pattern per kind of thing.** Places use list → content → panel. Items share one action bar (react, reply, share, save, more), shown on hover, focus or long-press rather than always on screen.
3. **One Create button.** It's context-aware: in a Space it defaults to "post in this board"; in Feed, to a post or clip.
4. **One inbox.** Notifications are grouped (Mentions, Replies, Activity, Requests) and collapsed ("Noor and 11 others liked your clip").
5. **Teaching empty states, not tours.** Every empty screen says what goes there and offers the one action that fills it. Tips appear at the moment a feature becomes relevant, once.
6. **Settings are searchable** and grouped the same way as the product (Account, Privacy, Security, Appearance, Notifications, Devices, Blocked).
7. **Hard limits on visible choice.** At most 5–7 options in any menu level, and one primary action per screen.

## Visual style for a dark, premium app

- **Dark first.** The night edition is the default for everyone. The day edition is an option in Appearance, designed to the same standard.
- **Layered darks, not black.** Four surface steps (ground → panel → raised → overlay) separated by small lightness steps and hairline rules. Depth comes from light, and shadows appear only on floating layers.
- **One accent, used sparingly.** Magenta marks actions and "needs you" moments: primary buttons, mentions, active states and focus. Everything else is neutral ink. The four map inks carry identity (Spaces, categories), never decoration.
- **Type does the hierarchy.** Archivo throughout. UI sizes are restrained (13–15 px) with clear weight steps. Expressive widths (expanded caps) are reserved for landing, profile headers and Space banners.
- **Slightly futuristic, never gimmicky.** It comes from precise hairlines, map-grid and contour motifs in quiet places (empty states, headers, landing), tabular figures for metadata, live presence, and crisp motion. There's no neon glow, no gradient text and no decorative glass.
- **Motion.** 100–250 ms, exponential ease-out, for panels, message arrival, reactions and hover feedback. There's no animation on keyboard-driven actions, and `prefers-reduced-motion` gets opacity-only transitions.
- **Density** comes in Comfortable (default) and Compact, and both keep 44 px touch targets on touch devices.
- **Contrast**: text is at least 4.5:1 everywhere, verified by token tests. Focus rings are always visible.

## Balancing power and simplicity

| Casual user sees | Power is one step away |
|---|---|
| Five destinations, one Create button | Travel (⌘K), keyboard shortcuts, custom Space folders |
| Messages and posts with a clean action bar | Full action menu, message links, pins, edit history |
| Sensible notification defaults (all for small Spaces, mentions-only for big ones) | Per-Space and per-channel overrides |
| A Space's channels | Roles, permissions, audit log, mod queue (only if you have the rights) |
| Feed tabs | Filters, muted words, "why am I seeing this" |

Rules of thumb: default to the common case, reveal the rest in context, and never make a simple task wait on a power feature.

## Feature placement (by roadmap phase)

| Feature | Lives in | Phase |
|---|---|---|
| Spaces, text channels, boards, roles, invites | Spaces | 1 |
| DMs, group chats | Messages | 1 (E2EE in 2) |
| Home hub | Home | 1 |
| Posts, comments, votes, saves | Feed, Spaces (boards), Profiles | 1 |
| Profiles, privacy settings, devices | Profile, Settings | 1 |
| Notifications inbox | Bell (everywhere) | 1 basic, 2 full |
| Search and discovery | Explore, Travel | 1 basic, 2–3 richer |
| Moderation tools | Space settings, context menus | 1 basic, 2 full |
| Media sharing | Composer everywhere | 1 images/files, 3 video |
| Clips (short video) | Feed › Clips | 3 |
| Voice/video rooms | Spaces | 3 |
| Customization (theme, density, Space inks) | Appearance settings | 1–2 |
| Desktop / mobile apps | Same structure, native navigation | 4 |
