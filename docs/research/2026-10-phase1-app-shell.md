# Phase 1 app shell: research and recommendations

Status: complete (research for the owner's review; nothing built)
Date: 2026-10-04
Scope: the signed-in frame (dock, content area, Here now panel, phone tabs, Travel palette, theming, keyboard model, states, account menu, verify-email banner, first-run Home, Settings).
Method: the current code under `frontend/web/src/features/app`, `features/settings` and `app/(app)`; 20 signed-out captures of public pages (headless Chrome, cookie banners declined, no sign-in); vendor documentation, W3C/WAI pages, Next.js and React docs. Secondary sources are labelled as such, and inferences are marked.

## Top recommendations

1. **Keep the five-destination dock and the phone tabs; they match the field.** Material caps a navigation bar at five; Discord's phone app is four tabs plus You; Slack and WhatsApp use a slim left rail. Add the three always-available pieces UX-ARCHITECTURE promises and the frame lacks: **Create (+)**, **Notifications** (bell at the dock's foot, opening in the panel slot) and a visible **Travel field** ("Search or jump to… Ctrl K") in every place header.
2. **Move the shell into DESIGN.md's world.** Drop the per-destination "world inks" and orbit rings. The active destination gets a neutral raised pill; the theme action colour is kept for the one thing to press, focus, and "needs you" counts. The ground is ink with one static, dim light field; panels are solid so text sits on a known colour.
3. **Make Here now a slot in the frame, not a Home-only aside.** 288 px, open by default from 1200 px, a toggle from the header's "● 4 here now" pill below that, a sheet on tablet, a strip of avatars on phones. It lists you first, so it's never blank, and the same slot carries the inbox, threads and profile peeks.
4. **Rewrite first-run Home around people.** Greeting, then a three-step "Get your crew in" card (start a Space · invite friends · make your profile yours), one action at a time. Remove the "On the way" roadmap list from Home.
5. **Build Travel as an APG combobox in a modal dialog.**
   - Empty query shows recents, friends here now and actions.
   - Scoped to the current Space with a removable chip.
   - Optional `@` / `#` / `>` prefixes.
   - Grouped results, and settings and actions included.
   - Remappable shortcut.
   - A full-screen version behind the phone search button.
6. **Add `loading.tsx` and `error.tsx` inside `(app)`.** Without a loading boundary, Next can't prefetch anything useful for Realm's dynamic routes, and without an `(app)` error boundary a page error takes the dock down with it. Skeletons mirror the real place, appear only after ~300 ms, and never touch the dock.
7. **Give the You menu its real job and turn the phone "You" tab into a You page.** Status picker, view profile, the four theme swatches, Pause motion, Settings, shortcuts and help, Sign out.
8. **Restructure Settings as list-and-detail, grouped by the person's question:**
   - You: Account, Profile, Privacy and safety.
   - App: Appearance, Accessibility, Notifications.
   - Security: Devices.
   - Search at the top.
   - A theme picker that shows the themes (swatches with a check mark and a live preview) and reserves a row for user-made themes.
9. **Accessibility specifics:** keep the dock and room tabs as plain links (no roving tabindex). Use roving focus only inside true composites (swatches, status picker, toolbars). Add scroll padding so sticky header and tabs never hide focus (WCAG 2.4.11). Put a switch on any single-key shortcut (2.1.4). Put unread counts in link names rather than live announcements.

## 1. How the best social and communication apps structure their shells

All sources checked 2026-10-04 unless marked. Captures are in `docs/research/phase1-captures/shell/` (the bluesky, discord, elk, mastodon, reddit, threads and x files were taken 2026-10-02; telegram, linear, raycast, slack and partiful on 2026-10-04). Every capture is a signed-out public view, because this research never signs in; where a claim is about the signed-in app it comes from the vendor's own writing or a named secondary source.

### 1.1 What the field has converged on

**A fixed strip of destinations, on the left on desktop and along the bottom on phones.** Nearly every product splits "where am I going" (a small, fixed set of destinations) from "what's inside this place" (a list or tabs that change with the place).

| Product | Desktop / web | Phone | Notes |
|---|---|---|---|
| Discord | Server rail + channel list (unchanged); March 2025 "lightweight desktop refresh" added Light, Ash, Dark and Onyx themes and three densities (default, compact, spacious) | Since Dec 2023, bottom tabs **Servers, Messages, Notifications, You**; DMs moved out of the server list into Messages; Friends folded into You | Discord reported the mobile rebuild cut app-open time by 55% on Android and 43% on iOS. Sources: [discord.com/blog/improving-our-mobile-experience](https://discord.com/blog/improving-our-mobile-experience) (5 Dec 2023), [discord.com/blog/player-release-q12025](https://discord.com/blog/player-release-q12025), [Engadget](https://www.engadget.com/gaming/pc/discords-redesigned-pc-app-has-multiple-dark-modes-a-new-overlay-and-more-160019822.html) |
| Slack | Since the redesign announced 9 Aug 2023: a narrow left rail (workspace, **Home, DMs, Activity**, then "Later" and "More" tools) beside the channel sidebar | Not checked today | The rail is visible in Slack's own product illustration (capture `slack-features-desktop.jpg`). Slack's redesign post: [slack.com/blog/productivity/a-redesigned-slack-built-for-focus](https://slack.com/blog/productivity/a-redesigned-slack-built-for-focus) |
| WhatsApp | Web: a far-left vertical toolbar (Chats, Status/Updates, Channels, Communities) with the selected item highlighted | Android moved its top tabs to a bottom bar; iPad replaced its bottom tabs with a Mac-style sidebar | Secondary sources: [WABetaInfo, iPad sidebar](https://wabetainfo.com/whatsapp-launches-a-mac-style-navigation-sidebar-for-ipad/), [GSMArena, Android bottom bar](https://m.gsmarena.com/whatsapp_new_bottom_navigation_bar_android-news-62239.php), [Yahoo Tech, web redesign](https://tech.yahoo.com/general/articles/whatsapp-gets-fresh-redesign-much-182233238.html) |
| Telegram | Chat folders become a left sidebar with an unread count per folder | Folders as top tabs | [telegram.org/blog/folders](https://telegram.org/blog/folders) (2020). The public channel view (`telegram-channel-*.jpg`) is a centred bubble column on a patterned wallpaper with a channel card on the right |
| Element | 2025 room list replaces sections with single-select filters (Unreads, People, Rooms, Favourites) and redraws indicators so unread counts, mentions, muted rooms and live calls are told apart | Same filters (Element X) | [AlternativeTo, Sept 2025](https://alternativeto.net/news/2025/9/element-web-and-desktop-add-redesigned-room-list-with-new-filters-and-clearer-notifications/), [element-web issue #29189](https://github.com/element-hq/element-web/issues/29189) |
| Instagram | Every menu item in a left sidebar, including Search | Bottom bar, under constant testing | [Metricool guide](https://metricool.com/instagram-on-web/) (secondary) |
| Bluesky | Three columns: left nav, a ~600 px centre column, a right column with search and trending | Bottom bar | The left nav shows icon and label on phones and large screens, icons only at medium widths ([social-app issue #7300](https://github.com/bluesky-social/social-app/issues/7300)); capture `bluesky-profile-desktop.jpg` |
| Reddit | Top bar with a **scoped search** (an "r/gaming" chip sits inside the search box), a collapsible left sidebar, the content, and a right "community info" panel | Header with menu, search and an "Open App" push | Tablet drops the right panel and hides the left sidebar behind a menu button (captures `reddit-sub-*.jpg`) |
| Mastodon / Elk | Three columns. Elk's left nav lists 12 items (Home, Notifications, Conversations, Favorites, Bookmarks, Compose, Scheduled posts, Explore, Local, Federated, Lists, Hashtags) | Elk: a bottom bar; Mastodon: top tabs plus a bottom account bar | Capture `elk-public-desktop.jpg` also shows a raw error string ("ERROR: yf: This method requires an authenticated user") as the page body: a model of what not to do |
| Linear (polish) | Left sidebar: workspace switcher, then search and compose buttons, then Inbox, My issues, Reviews, then collapsible Workspace and Favorites groups; content; an optional right panel | n/a | Capture `linear-home-desktop.jpg` (Linear's own product image). Ctrl/Cmd K opens the command menu ([linear.app/docs/select-issues](https://linear.app/docs/select-issues)) |
| X, Threads | Signed out, both are walls: Threads shows only "create an account" choices; X overlays a sign-in panel on the profile | Same | Captures `x-profile-desktop.jpg`, `threads-*.jpg` |

**Platform guidance agrees on the counts.** Material 3: a navigation bar holds **three to five** destinations, always with labels, in fixed positions; the navigation rail is for medium to extra-large windows and "compact windows should always use a navigation bar" ([m3 navigation bar](https://m3.material.io/components/navigation-bar/guidelines), [m3 navigation rail](https://m3.material.io/components/navigation-rail/guidelines)). Apple's HIG: a tab bar is for navigation, not actions; keep it visible; **"Don't disable or hide tab bar buttons, even when their content is unavailable"**, explain the empty section instead; label every tab; badges are for critical information; on iPad the tab bar can turn into a sidebar ([HIG tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)).

### 1.2 Number of top-level destinations

Discord's phone app has four tabs, Slack's rail three or four plus "More", WhatsApp four or five, Material's ceiling is five. Realm's five (Home, Spaces, Messages, Feed, Explore) sits at the top of the normal range on desktop, and on phones Realm already swaps Explore for a header search button and adds "You", which matches Discord's four-plus-You shape. Inference: five is fine; a sixth dock item (say Notifications) would not be.

### 1.3 Presence and unread

- Unread is shown at two strengths almost everywhere: a quiet dot or bold name for "something new", and a count badge for "this is for you" (mentions, replies, DMs). Element's 2025 redesign exists largely to make that split clearer (unread vs mention vs muted vs call). HIG reserves badges for critical information.
- Discord's Notifications tab now **auto-clears** items as you read them, and every item jumps to its source ([Discord blog](https://discord.com/blog/improving-our-mobile-experience)).
- Telegram counts unread per folder in the sidebar ([telegram.org/blog/folders](https://telegram.org/blog/folders)), so the navigation itself tells you where the activity is.
- Presence in chat apps is a member list (Discord, Slack) or a dot on avatars (WhatsApp, Instagram). None of the products looked at frames presence as activity ("in a match, 12m") in the main shell; Discord shows game activity only inside member lists and profiles. Inference: Realm's "Here now" as an activity list is a real point of difference, not a copy.

### 1.4 How layouts adapt

The common three-step pattern, seen in Reddit, Bluesky and Mastodon captures and in the guidance above:

1. **Wide (≥ ~1200 px):** nav + content + right panel.
2. **Medium (~768–1199 px):** the right panel goes first (Reddit tablet drops it entirely); the left nav shrinks to icons (Bluesky) or hides behind a menu (Reddit).
3. **Phone (< 768 px):** a bottom bar of 4–5 labelled items, search in the header, and detail screens pushed on top.

### 1.5 Two cautionary closures

- **Guilded**, the best-funded Discord alternative for gamers, shuts down at the end of 2025; Roblox is folding its features into Roblox Communities ([Roblox DevForum](https://devforum.roblox.com/t/update-on-guilded-and-communities/3966775), 28 Sep 2025).
- **Geneva**, whose model of "homes" with chat, post, audio and video "rooms" is the closest precedent to Realm's Spaces with room tabs, was absorbed into Bumble BFF in September 2025 and shut down ([Wikipedia: Bumble Inc.](https://en.wikipedia.org/wiki/Bumble_Inc.); [geneva.com](https://geneva.com/)).

Inference: neither failed on shell design, but both show that a Discord alternative needs a reason to exist beyond layout. For Realm, that reason (friends, profiles and feed in one fabric, honest privacy) has to be visible in the shell from the first screen: Home must show people, not product announcements.

### 1.6 Gaps

Not examined first-hand: the signed-in shells of Messenger, Instagram, Threads, X and Arc (sign-in was out of scope), and Partiful's app (its public page leads with a single "Create invite" action, capture `partiful-home-phone.jpg`). Raycast's public page shows only its hero (`raycast-home-desktop.jpg`), so command-palette evidence comes from documentation instead (section 2).

## 2. Command palettes

### 2.1 What the good ones search, and how

- **GitHub** ([docs, Command Palette](https://docs.github.com/en/get-started/accessibility/github-command-palette)):
  - `Ctrl K` / `⌘K` opens the palette **scoped to where you are**; the scope shows at the top left as an editable path. Tab narrows the scope to the highlighted item; Backspace widens it.
  - Prefix characters switch what's searched: `#` issues and pull requests, `@` users, organisations and repositories, `!` projects, `/` files. `>` (or `Ctrl Shift K`) switches to command mode.
  - With no query it shows "suggestions based on your current context and resources you've used recently".
  - GitHub admits the default shortcuts "may conflict" with OS and browser shortcuts and lets people change them under Accessibility settings.
- **Linear:** `Cmd/Ctrl K` opens the command menu to act on the selected issue or go anywhere ([linear.app/docs/select-issues](https://linear.app/docs/select-issues)). Secondary write-ups describe it as context-aware, with issue actions first when an issue is open and each entry's shortcut shown beside it ([shortcut.fyi](https://shortcut.fyi/linear-shortcuts)).
- **Reddit and Slack** keep search as a **visible field in the top bar**. Reddit puts the current scope inside the field as a removable chip ("r/gaming", capture `reddit-sub-desktop.jpg`); Slack's product image shows a search bar above the app (capture `slack-features-desktop.jpg`).
- **cmdk**, the common React building block, is "a command menu React component that can also be used as an accessible combobox". It filters and sorts automatically, takes a custom ranking `filter`, and its `Command.Dialog` takes a `label` ([github.com/pacocoursey/cmdk](https://github.com/pacocoursey/cmdk)).

### 2.2 What that means for Travel

- **What it searches (Phase 1):**
  - Spaces you're in, then public Spaces.
  - Rooms in your Spaces, shown as "#general in Late Night Lobby".
  - People: friends first.
  - Conversations.
  - Settings, every individual setting ("theme", "sign out other devices").
  - Actions: create a Space, invite friends, new group chat, switch theme, Pause motion, sign out.
  - Message and post search arrives with Search v1 in Phase 2 (ROADMAP). Until then Travel says so in its empty-results text rather than pretending.
- **Empty query:**
  - Recent places (last five), then "Here now" friends (one press opens their DM), then a few suggested actions.
  - This is what makes it useful to people who never type a query (GitHub's recents precedent).
- **Scope:** inside a Space, results from that Space rank first and a removable "in Late Night Lobby" chip shows the scope (GitHub's scope path and Reddit's scope chip). Backspace on an empty field removes the scope.
- **Prefixes as an option, not a requirement:** `@` people, `#` rooms, `>` actions, borrowed from GitHub. Show them as hints in the footer ("Type @ for people, # for rooms, > for actions"); never require them.
- **Results:**
  - Grouped with visible headings (Recent, People, Spaces, Rooms, Settings, Actions), at most about five per group, plus "See all in Explore".
  - Each row: icon or avatar, name, where it lives, and the shortcut when it has one (Linear).
  - Presence dots on people.
- **Discoverability for people who don't use shortcuts:**
  - A visible "Search or jump to… Ctrl K" field in every desktop place header.
  - The search icon in the phone header opens the same thing full screen.
  - A Travel row at the top of the Create menu.
  - Show the real platform key (`⌘K` on Mac, `Ctrl K` elsewhere).
  - Let people remap it in Settings → Accessibility (GitHub precedent).

### 2.3 Accessibility model (ARIA APG combobox)

From the [APG combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

- **Focus model:** "DOM Focus is maintained on the combobox and the assistive technology focus is moved within the listbox using aria-activedescendant". The input keeps focus; arrow keys move a highlighted option.
- **Keys:** Down Arrow moves into the list. Escape dismisses the popup (and optionally clears the field). Alt+Down Arrow opens the list without moving focus.

Realm's Travel:

- **Structure:** a modal `dialog` (labelled "Travel") holding an input with `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`, and a `listbox` with `group`s labelled by their headings. Options use `aria-selected`.
- **Keys:** Up and Down move through results, wrapping; Enter opens the highlighted result; Escape clears a non-empty field first, then closes. Focus returns to whatever opened Travel.
- **Announcements:** announce the result count through a `role="status"` region ("8 results"), which WCAG 4.1.3 asks for: status messages presented "without receiving focus" ([Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)).
- **Motion:** opening from the keyboard has no scale animation (UX-ARCHITECTURE: no animation on keyboard-driven actions); a pointer open may fade in over 120–150 ms.

## 3. Empty, first-run, skeleton and error states

### 3.1 Evidence

- **Empty states:** NN/g's guidance ([Kaplan, 2021](https://www.nngroup.com/articles/empty-state-interface-design/)) has three rules: say what the system's status is, give a learning cue, and offer a direct path to the key task. Its first-use example (Loggly) offers two paths: add your own data, or explore with demo data.
- **Skeletons:** NN/g ([Skeleton Screens 101](https://www.nngroup.com/articles/skeleton-screens/), June 2023, last reviewed Sep 2026):
  - Skeletons are for **full-page loads under 10 seconds**.
  - Spinners are better for a single module.
  - Over 10 seconds, use a progress bar.
  - Under 1 second, use neither, because a quick flash "can be annoying".
  - A "frame-display" skeleton (a page frame with a pulse but no structure) is "essentially equivalent to a spinner".
- **Hidden sections:** Apple's HIG says not to hide or disable tab bar sections when their content is unavailable, and to explain why a section is empty instead ([HIG tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)). Realm's five destinations should therefore stay visible in Phase 1, each with an honest empty state, which is what the current build does.
- **Raw errors:** the Elk capture shows what happens without an error design: a raw error string as the page body, with the nav still around it.
- **Notifications:** Discord's mobile rebuild made each item jump to its source and auto-clear once read ([Discord blog](https://discord.com/blog/improving-our-mobile-experience)). The inbox empties itself, so its empty state is the normal state and should feel like "all caught up", not "nothing here".
- **One action:** friend-group products lead with one action. Partiful's page has a single "Create invite" button (capture). Discord's server creation asks one question, "For me and my friends" or "For a club or community" (secondary: [Vibebot](https://www.vibebot.gg/blog/how-to-create-discord-server), [AOL how-to](https://www.aol.com/news/discord-server-customize-chatroom-channels-220151896.html)).

### 3.2 Making them feel alive, not generic (recommendations; the reasoning is inference unless cited)

- **Never fully empty when the person is there.** Here now always lists **you** first ("You · around"), so the panel is never blank and shows what friends will see. Messages' empty state shows your friends who are online, each with a "Say hi" button. Spaces' empty state shows the two Space starting points (7.5).
- **Use real things, not illustrations.** The person's own avatar, theme colour and name, a preview of what their invite link will look like, the real room names a template will create. DESIGN.md already says the real app is the imagery. Retire the orbit-ring motif; no mascots.
- **Copy:** one short line of what goes here, one line of why it's empty, one action. Talk to the person ("Nobody's around right now"), never as the system ("No data").
- **"Caught up" states:** for Notifications, Messages read to the end, and a Feed with nothing new since your last visit. Use a calm, positive line plus a next step (go to a Space, check Explore).
- **Skeletons:** structural (place header, tab row, 5–6 rows of the real shape) and only in the content column. Fade in after ~300 ms. No shimmer when reduced motion or Pause motion is on; use a static, slightly lighter Raised tone. Never re-skeleton the dock, header or Here now panel.
- **Errors:** say what happened in a person's words, what still works, and one action (Try again). Keep the composer's draft through any error. Show a status code only in a "Details" disclosure for support. A failed send stays in the conversation, marked "Didn't send · Try again", the way chat apps do.
- **Offline:** a slim status line under the header, with presence dots going hollow rather than vanishing.

## 4. Settings information architecture

### 4.1 Evidence

- **Discord:**
  - User Settings has a **Devices** page listing current sessions, with per-session sign-out and "Log out of all known devices" (secondary: [Tabletmonkeys](https://tabletmonkeys.com/how-to-secure-your-discord-account-check-and-log-out-of-devices/)).
  - The March 2025 refresh offers four colour themes (Light, Ash, Dark, Onyx, the last true black for OLED) and three densities ([Discord blog, Q1 2025](https://discord.com/blog/player-release-q12025); [Engadget](https://www.engadget.com/gaming/pc/discords-redesigned-pc-app-has-multiple-dark-modes-a-new-overlay-and-more-160019822.html)). A dark-first app ships **several darks**, not one dark and one light.
  - On phones, settings sit inside the **You** tab next to profile and status ([Discord blog](https://discord.com/blog/improving-our-mobile-experience)).
- **Instagram:** settings are grouped by the question they answer. "Who can see your content" holds Account privacy, with Blocked just below ([Instagram Help](https://help.instagram.com/448523408565555)).
- **Bluesky:** settings groups include Privacy and security, Content and media, Appearance and Accessibility. Appearance holds colour mode (System, Light, Dark), theme font vs system font, and font size (smaller, default, larger). Accessibility holds "require alt text" and larger alt-text badges. (Secondary: [SocialBee](https://socialbee.com/blog/bluesky-settings/), [Veroniiiica](https://veroniiiica.com/bluesky-accessibility-features/).)
- **Slack:** "Sign out of all other sessions" lives on the account page (secondary: [How-To Geek](https://www.howtogeek.com/447462/how-to-log-all-devices-out-of-your-slack-account/)).
- **Telegram and Steam:** their theming and profile customisation are covered in `docs/THEMING.md` §2.5 and §2.11, not re-researched here.

### 4.2 Patterns that hold across them

1. **Group by the person's question, not by the system's tables.** "Who can see me", "How it looks", "Where I'm signed in".
2. **Privacy is its own top-level group**, next to Account rather than buried inside it.
3. **Appearance holds mode, font size and density.** Accessibility holds the things that change how content is made or read (alt text, motion, contrast).
4. **Sessions are always one group, with a "sign out everywhere else" action.**
5. **Phones use a list that pushes to detail; desktops use a list beside the detail.** (Observed in the products above; the phone push pattern is iOS's own convention.)
6. **Theme pickers show the theme, not just its name.** Discord's themes and Bluesky's modes are picked visually. (Inference from the descriptions; not seen signed in.)

Realm's recommended structure is in 7.6.

## 5. Accessibility for app shells

### 5.1 Landmarks and skip links

- The APG landmark guidance: `banner`, `main`, `complementary` and `contentinfo` should be top-level. If a role appears more than once on a page, each instance needs a unique label ([APG landmark regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)).
- **For Realm:**
  - `nav` "Realm" (the dock, or the phone tabs; only one is rendered visible at a time, which the current code already does with `display: none`).
  - `main` for content, a place-level `header` inside it for the place header.
  - `aside` "Here now" (complementary).
  - When the Notifications inbox or a thread takes the panel's slot, rename the landmark to match ("Notifications", "Thread").
- **Skip links:** WCAG 2.4.1 asks for a way to bypass repeated blocks ([Understanding 2.4.1](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html)). Realm has "Skip to content". Add "Skip to composer" in rooms and DMs, and "Skip to Here now" when the panel is open.

### 5.2 Focus order

Dock → place header (switcher, tabs, here-now pill, Travel, action) → content → composer → Here now panel. Opening a sheet or Travel moves focus into it and traps it; closing returns focus to the trigger (the current You menu already does this).

### 5.3 Roving tabindex: where it belongs and where it doesn't

- APG: in a composite widget, one element has `tabindex="0"` and the rest `tabindex="-1"`; arrow keys move between them ([APG keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)).
- **Use it for real composite widgets:** the theme swatch radio group, the status picker, toolbars (message actions, composer tools), and the Travel listbox (via `aria-activedescendant` instead).
- **Do not use it for the dock or the phone tabs.** They are navigation links between pages, so they should stay ordinary links in the tab order, with `aria-current="page"`. Turning them into a `tablist` would promise in-page tab panels that don't exist. (Inference; the [APG tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) describes tabs that switch panels within one page.)
- **Room tabs** are the same case: each room has a URL, so a `nav` of links, not `role="tab"`.

### 5.4 Reduced motion and Pause motion

- MDN: scaling or panning large objects can trigger vestibular disorders ([MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).
- Realm already honours both the system setting and its own Pause motion switch in the dock highlight. Keep that rule for sheets (fade only), the mark's pending dot (still), skeletons (no shimmer) and the theme cross-fade (instant swap).

### 5.5 Zoom, reflow and the sticky layers

- WCAG 1.4.10: content must work without two-way scrolling at 320 CSS px, the equivalent of a 1280 px window at 400% zoom ([Understanding 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)). At 200% on a 1280 px window the viewport is 640 px, so Realm shows its **phone layout**, and that's correct.
- **Test at 320 px:** five tabs at 64 px each fit; the phone header must not wrap its buttons; the verify banner must stack.
- **Sticky layers:** WCAG 2.4.11 names "sticky footers, sticky headers" as what typically hides focus ([Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)). Set `scroll-padding-top` to the header height and `scroll-padding-bottom` to the tab-bar height plus the safe area, so tabbing never lands a focused control under them. Recommend checking this in the Playwright suite at 390 px and at 200% zoom.

### 5.6 Target size and shortcuts

- **Target size:** WCAG 2.5.8 asks for pointer targets of at least 24×24 CSS px, or enough spacing ([Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). Realm's own rule (44 px on touch, UX-ARCHITECTURE) is stricter; keep it. Watch the small ones: badge-only buttons, the here-now pill, room-tab close buttons, swatches (DESIGN's 2.75rem = 44 px, fine).
- **Shortcuts:** WCAG 2.1.4. Single-character shortcuts need a way to turn them off or remap them, or must only work while their component has focus ([Understanding 2.1.4](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)). `Ctrl K` is fine; `?`, `c` or `g h` style keys need the switch.

### 5.7 Live updates

Unread counts and presence change constantly. Put the count in each nav link's accessible name ("Messages, 3 unread") rather than announcing it. Reserve `role="status"` announcements for results of the person's own actions ("Message sent", "Copied invite link", "8 results"), as WCAG 4.1.3 intends.

## 6. Performance norms for the Next.js App Router shell

### 6.1 Targets

- web.dev's Core Web Vitals, measured at the 75th percentile ([web.dev/articles/vitals](https://web.dev/articles/vitals), [web.dev/articles/inp](https://web.dev/articles/inp)):
  - **LCP within 2.5 s.**
  - **INP at or under 200 ms**, meaning the next frame after a click shows visible feedback.
  - **CLS at or under 0.1.**
- Discord treated speed as a headline feature of its 2023 mobile rebuild: app-open time fell 55% on Android and 43% on iOS, and it caches recent messages for up to 700 channels and DMs ([Discord blog](https://discord.com/blog/improving-our-mobile-experience)).

### 6.2 What the App Router gives you (Next.js 16; Realm is on 16.3.6 with the React Compiler on)

- **Prefetch:**
  - `<Link>` prefetches when it enters the viewport ([linking guide](https://nextjs.org/docs/app/getting-started/linking-and-navigating)).
  - With the default (`"auto"`), a **static** route is prefetched in full, but a **dynamic** route only "down to the nearest segment with a loading.js boundary" ([next/link](https://nextjs.org/docs/app/api-reference/components/link)).
  - Realm's `(app)` routes are dynamic (the layout reads cookies), so `loading.tsx` files are what make dock presses instant.
- **Next 16 routing:**
  - **Layout deduplication**: a shared layout is downloaded once, not once per link.
  - **Incremental prefetching**: only what isn't cached is fetched, and requests cancel when a link leaves the viewport.
  - **Cache Components** (Partial Prerendering plus `use cache`) for "instant navigation", opt-in.
  - Source: [nextjs.org/blog/next-16](https://nextjs.org/blog/next-16).
- **`loading.js`** shows "an instant loading state from the server while the content of a route segment streams in", and navigation is **interruptible**: people can change their mind mid-load ([loading.js reference](https://nextjs.org/docs/app/api-reference/file-conventions/loading)).
- **`useLinkStatus`** gives "immediate feedback while the transition is in progress" ([linking guide](https://nextjs.org/docs/app/getting-started/linking-and-navigating)).
- **React 19.2's `<ViewTransition>`** animates updates made inside a Transition, a Suspense reveal or `useDeferredValue`, and not plain `setState` ([react.dev](https://react.dev/reference/react/ViewTransition)). App Router navigations qualify, so cross-fades between destinations are possible without a library.

### 6.3 Shell budgets for Realm (recommendations; the numbers are proposals, not measurements)

1. **A dock or tab press paints feedback in the next frame:** the active pill moves, and `useLinkStatus` lights the mark. Content appears (real or skeleton) within 300 ms on the reference laptop (the owner's Radeon 610M machine).
2. **The shell never re-renders on navigation.** Dock, header frame and Here now live in the `(app)` layout. Only the content segment changes, which the App Router does by default.
3. **Travel loads on demand:** code-split, fetched on idle after first paint and opened in under 50 ms. Filtering local results (recents, your Spaces, settings, actions) happens synchronously per keystroke; server results (people, public Spaces) merge in as they arrive, without reordering what's under the highlight.
4. **No layout shift from the shell:** the verify banner renders on the server (as now), badges reserve their width, and the Here now panel's open state is decided before first paint (cookie or CSS), the same way the landing decides its layout "in CSS before first paint" (DESIGN.md).
5. **Real-time without jank:** batch presence updates (for example once a second) and never animate a list reorder in Here now under reduced motion.
6. **The light field in the app is a static gradient,** not the landing's canvas. No full-screen grain over scrolling content; the project's memory records that full-screen noise and shader compiles were what made the landing lag on the owner's iGPU.
7. **Measure INP and LCP in the field** from day one (the `web-vitals` library), split by phone and desktop, as web.dev advises.

## 7. Recommendations for Realm

### 7.1 What exists today (read 2026-10-04)

Files: `frontend/web/src/features/app/{app-shell.tsx, nav.ts, place.tsx, verify-banner.tsx, app.module.css}`, `frontend/web/src/features/settings/*`, `frontend/web/src/app/(app)/**`.

Worth keeping:
- The dock (76 px) with **icon and label** for each of the five destinations, `aria-current="page"`, the "You" avatar at its foot, and one sliding highlight that respects both reduced motion and Pause motion.
- Phone header with Explore behind a search button, phone tabs (Home, Spaces, Feed, Messages, You) clear of the home indicator.
- A skip link to `#main`; `main` is focusable; the You menu closes on Escape and returns focus to its button.
- The verify banner lets people verify in place, and announces success with `role="status"`.
- The session check in `layout.tsx` sends a broken API to an error screen, not to sign-in.

What should change:
1. **It still wears the old world.** `app.module.css` gives each destination its own "world ink" (spaces, feed, profiles, boards) and draws orbit rings in empty states; Appearance says "deep space and starlight"; the shell reads the old `--r-*` tokens. DESIGN.md's Migration note already flags this. Under the new rules (One Action Rule, Light Is The Colour Rule) the per-destination inks and orbit motif go.
2. **Missing always-available pieces.** UX-ARCHITECTURE lists Create (+), Notifications and Travel as always available; none is in the frame yet.
3. **Home's first run talks about the product, not your people.** It's an "On the way" roadmap list with "In the works" tags, plus "Choose your look". Section 1.5 is the reason to change this: Home should be about friends from the first screen.
4. **Here now is only a hidden, static aside on Home** (shown from `xl`). It needs to be a slot in the frame, shared by every place.
5. **No `loading.tsx` and no `error.tsx` inside `(app)`.** Every `(app)` page is dynamic (the layout reads cookies), and Next's default prefetch for a dynamic route only goes "down to the nearest segment with a loading.js boundary" ([next/link docs](https://nextjs.org/docs/app/api-reference/components/link)); with no boundary there is nothing useful to prefetch and nothing to show the instant a dock item is pressed (inference from the docs). An error in any page falls through to the root `app/error.tsx`, which sits outside the `(app)` layout, so (inference) the dock disappears along with the broken page.
6. **The phone "You" tab goes straight into Account settings.** Discord's You tab is a profile-and-status page with settings one step in ([Discord blog](https://discord.com/blog/improving-our-mobile-experience)).
7. **The You menu holds only Settings and Sign out.** No profile, status, theme, Pause motion, shortcuts or help.
8. **Settings groups are pills across the top.** That works for three groups; Phase 1 Profiles adds privacy settings, and UX-ARCHITECTURE lists seven groups (Account, Privacy, Security, Appearance, Notifications, Devices, Blocked).
9. **No `data-part` hooks yet** (`docs/THEMING.md` §4.13 item 8 asks for `app.dock`, `app.header`, `panel.here-now` and so on).

### 7.2 The frame at each width

**Desktop, 1024 px and up**

```
┌──────┬─────────────────────────────────────────────────────┬────────────────┐
│ (o)  │ Late Night Lobby ▾        [● 4 here now]  [⌕ Travel  Ctrl K]  Invite │
│      │ [# general] [# clips •] [# lfg] [▤ builds 2] [⋯]    │  HERE NOW      │
│ Home │─────────────────────────────────────────────────────│  ● Noor        │
│Spaces│                                                     │    in a match  │
│Messag│                 content (place)                     │  ● Kenji       │
│ Feed │                                                     │    around      │
│Explor│                                                     │                │
│  ＋  │                                                     │  Recently      │
│  🔔  │                                                     │  Ama · 2h      │
│ (You)│  ( + )  Say something in #general        (Send)     │                │
└──────┴─────────────────────────────────────────────────────┴────────────────┘
 76 px                      fluid                               288 px
```

- **Dock, top to bottom:** the ring mark (goes Home; doubles as the route-pending indicator, see 7.7) · Home, Spaces, Messages, Feed, Explore (icon + one-word label, 64 px rows) · gap · **Create** (a ghost ring "+" that opens a short menu: new post, new Space, new group chat, invite friends) · bottom cluster: **Notifications** (bell; opens the inbox as a panel in the Here now slot) and **You** (avatar with presence dot). Seven items plus the mark, which keeps within UX-ARCHITECTURE's 5–7 rule.
- **Active destination:** a neutral raised pill (white at ~8% with a hairline ring) behind the icon, the icon filled, the label in Ink. Not the action colour, and not a per-destination hue: under DESIGN.md the action colour is for what you press and what needs you.
- **Unread on the dock:** Messages and Spaces carry a **count in the action colour** only for things addressed to you (DMs, mentions, replies, requests), and a **small neutral dot** for "something new". Feed and Explore never carry counts (inference: counts on a feed are engagement bait and clash with "calm, all-day tool"). Every badge needs a text equivalent in the link's accessible name ("Messages, 3 unread").
- **Place header (top of content, 56–64 px):** place name in Funnel Display (DESIGN's `title` size, not the landing's display sizes) with a switcher caret where it applies (Space switcher), then the place's context (room tabs, feed tabs, conversation title), then on the right: the **"● 4 here now"** pill (toggles the panel), the **Travel field** ("Search or jump to…" with a visible `Ctrl K` / `⌘K` hint), and the place's one action (Invite).
- **Here now panel (288 px):** shown by default from 1200 px; between 1024 and 1199 px it starts closed and opens from the header pill, overlaying content (Reddit drops its right panel first; Bluesky collapses its rail first; see 1.4). The choice is remembered per device.
- **Content:** fluid. Reading surfaces (feed, boards, settings) hold a ~42rem column; chat uses the full width.

**Tablet, 768–1023 px**

- Dock stays (labels still fit at 76 px). Here now and the Notifications inbox are right-hand **sheets** opened from the header; Travel is a centred overlay. Room tabs scroll sideways with a fade and the `⋯ All rooms` button pinned at the end.

**Phone, under 768 px**

- **Header (56 px):** on Home and Feed, the wordmark or place name, then Travel (search icon), Notifications (bell) and Create (+); in a Space, back, Space name (switcher), "● 4" here-now pill.
- **Tabs:** Home, Spaces, Feed, Messages, You (avatar with presence dot), as today; badges follow the dock rules. Phone search opens **Travel full screen** with Explore as its first section and a "Browse Explore" link, rather than going straight to `/explore`.
- **You tab** becomes a You page: profile card, status, friends, then a settings list. Settings detail screens push on top with a back button.
- **Conversations:** inside a room or DM, the tab bar gives way to the composer (inference and trade-off: HIG asks for the tab bar to stay visible, but every chat app looked at puts the composer at the bottom; keep the back button prominent to compensate).
- **Here now** becomes a horizontal strip of avatars at the top of Home and of each Space's room list, opening a sheet with the full list.

### 7.3 The Here now panel

- **What it shows:** people, not a member list. "Here now" (presence dot + name + an activity line: "in a match, 12m", "cutting a clip", "around"), then a collapsed "Recently around" (name + "2h"). On Home it's your friends across Spaces; in a Space, that Space's people; in a DM, the other person's profile peek; later, the voice room on top.
- **Same slot, other uses:** thread replies, profile peeks and the Notifications inbox open in this slot, so the frame never grows a fourth column (as UX-ARCHITECTURE already says).
- **Empty state:** "Nobody's around right now." plus the one action that fixes it: **Invite friends** (copy link / share).
- **Privacy:** presence is shown only to people the settings allow (Profiles phase: presence and read-receipt settings); the panel says which ("Only your friends see that you're here").
- **Accessibility:** a `complementary` landmark with a unique label ("Here now"); presence changes are **not** announced live (they'd be constant noise); the count in the header pill is the summary.

### 7.4 The You menu and the verify banner

**You menu** (a disclosure, not an ARIA `menu`, because it holds switches and swatches; Tab moves through it, Escape closes and returns focus):

1. Avatar, display name, @username, and a **status picker** (Online, Away, Do not disturb, Invisible) with a custom line ("in a match").
2. View profile.
3. **Theme row:** the four swatches (Mint, Orchid, Aqua, Ember) as a radio group, so the "profile takes over the colour" idea is one click away inside the app.
4. Pause motion (switch).
5. Settings.
6. Keyboard shortcuts and help.
7. Sign out, separated by a rule.

**Verify banner:**

- Keep the in-place code entry, but make it one line by default: "**Confirm your email** so you can get back into your account and friends can find you. [Enter code] [Resend]". "Enter code" expands the code field in place.
- Put it **at the top of the content column, never over the dock or as a sticky layer**: WCAG 2.4.11 fails sticky notifications that fully hide a focused control ([Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)).
- Add **"Later"** (hides it for this session; a dot stays on the You avatar and a row in the You menu).
- Neutral surface, not a warning colour: it is a request, not an error.

### 7.5 First-run Home

Principle: Home shows people and the next thing to do with them. One primary action at a time.

1. **Greeting** in Funnel Display: "Hey, Sam." One line under it in Atkinson.
2. **"Get your crew in"**: a three-step card with one action-colour button at a time, each step ticking off and collapsing:
   1. **Start a Space** for your group, with two starting points (inference, mirroring Discord's "For me and my friends" / "For a club or community" choice reported by [Vibebot's guide](https://www.vibebot.gg/blog/how-to-create-discord-server), secondary): "For my friends" (private, rooms: general, clips, plans) and "For a bigger group" (rooms plus a board).
   2. **Invite friends**: copy a link or use the share sheet. The invite page a friend opens while signed out should show the Space's name, who invited them and who's in it, not a wall like Threads or X (captures `threads-*.jpg`, `x-profile-desktop.jpg`).
   3. **Make your profile yours**: picture, theme swatch and a line about you, which also previews the profile canvas idea from the front page.
   
   Partiful's public site leads with one action, "Create invite" (capture `partiful-home-phone.jpg`); NN/g's empty-state guidance is the same three things: system status, learning cues and a direct path to the key task ([NN/g](https://www.nngroup.com/articles/empty-state-interface-design/), Kaplan, 2021).
3. **Until Spaces ship:** step 3 is the live action and steps 1 and 2 show "Coming soon" honestly. Drop the full "On the way" roadmap list from Home; a single "What's coming" link to Help is enough.
4. **Once people are around:** Home becomes: here-now strip (phones) or panel (desktop) · things that need you (unread DMs, mentions, requests) · "Pick up where you left off" (last three rooms or chats) · what changed in your Spaces. The first-run card disappears once all three steps are done or it's dismissed; progress is stored on the server so it follows the person across devices.

### 7.6 Settings

- **Structure (Phase 1):** Settings is a place in the content area with its own list on the left (desktop/tablet) or a list that pushes to detail screens (phone). Groups, in this order:
  - **You:** Account (email, username, display name, password) · Profile (opens the profile editor) · **Privacy and safety** (profile visibility, who can DM you, friend requests, presence, read receipts, Blocked).
  - **App:** **Appearance** · Accessibility · Notifications ("Coming soon" in Phase 1; arrives with Phase 2's notification centre).
  - **Security:** **Devices** (where you're signed in, sign out others) · later, two-factor and passkeys.
  - Footer: Help, Terms, Privacy, Sign out.
- **Search** at the top of the list (UX-ARCHITECTURE asks for searchable settings), and every setting also reachable from Travel.
- **Appearance:**
  - **Theme** as large swatches (DESIGN's 2.75rem squircles, each showing its three lights). It's a radio group: arrow keys move the choice, and the selected one shows DESIGN's lift and ring **plus a check mark**, so colour is not the only signal.
  - A **live preview**: a small frame of the shell in the chosen theme.
  - **Mode:** Night (default) · Day · Match my device. Day stays labelled "Coming soon" until it's redesigned in this world.
  - **Your themes:** an empty row reserved now ("Make your own, later"), so user-made themes have an obvious home (`docs/THEMING.md`).
  - Text size, density (Comfortable / Compact), and motion (Pause motion; "Realm follows your device's reduced-motion setting").
  - Reconcile the stored value (`system|dark|light` in DATA-MODEL vs `night|day` on the web) before the settings API ships, as THEMING §4.13 item 11 already says.
- **Devices:** keep the current list. Add "Sign out everywhere else", and the device and approximate place for each session (Discord and Slack both offer a "sign out all other" action; secondary sources: [Tabletmonkeys on Discord](https://tabletmonkeys.com/how-to-secure-your-discord-account-check-and-log-out-of-devices/), [How-To Geek on Slack](https://www.howtogeek.com/447462/how-to-log-all-devices-out-of-your-slack-account/)).

### 7.7 Keyboard, loading and errors

- **Keyboard:**
  - `Ctrl K` / `⌘K` opens Travel from anywhere, including inside text fields.
  - `Escape` closes the topmost layer.
  - `?` opens the shortcuts sheet, only when focus isn't in a text field.
  - Any single-key shortcuts (Linear-style) ship **off by default** or behind a Settings switch, to meet WCAG 2.1.4 ([Understanding 2.1.4](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)).
  - `F6` / `Shift F6` to cycle dock → header → content → panel is a candidate (desktop-app convention; not verified against any product today).
  - The dock stays **plain links in the tab order** (5–8 stops), not a roving-tabindex widget (section 5.3).
- **Loading:**
  - Add `loading.tsx` for each destination, drawn as that place's real frame (header, tabs, a few rows) inside the content column only. The dock and panel never re-skeleton.
  - Delay the skeleton's fade-in by about 300 ms. NN/g: under 1 s, skeletons "can be annoying" ([NN/g](https://www.nngroup.com/articles/skeleton-screens/)); the 300 ms figure is an inference.
  - Show navigation progress with `useLinkStatus` on the pressed dock item and on the ring mark ([Next.js linking guide](https://nextjs.org/docs/app/getting-started/linking-and-navigating)).
- **Errors:**
  - Add `(app)/error.tsx` and per-destination error files so the dock stays and only the content says what went wrong.
  - Error copy is plain: what happened, what to do (Retry), and never a raw error string (the Elk capture is the counter-example).
  - Offline gets a slim `role="status"` line: "You're offline. We'll send messages when you're back."

### 7.8 How the shell carries DESIGN.md's world and stays calm

| DESIGN.md element | In the app shell |
|---|---|
| Ink ground + light field + grain | The ground behind the frame is Ink Ground with **one static, dim field** in the theme's lights, anchored top-left behind the dock and Home's greeting. No scroll drift, no grain over reading panels: panels (dock, header, content, Here now) are solid Surface/Raised so text sits on a known colour. The project's own lesson is that full-screen noise stalled the owner's integrated GPU (project memory, "Realm performance lessons"). |
| Theme action colour (`--acc`) | One pressed fill per screen (Send in chat; the current first-run step on Home), focus rings, selection, and "needs you" counts. Never the active-tab fill. |
| Funnel Display / Atkinson | Funnel for place names, the Home greeting, profile names and Space names (DESIGN `title` size, 1.4–1.9rem). Atkinson for everything else, body at 1.0625rem; UI labels 0.95rem bold. |
| Pills and rounded rectangles | Dock items, tabs, tags, the here-now pill and the Travel field are pills; panels and sheets are 1.2–1.8rem rectangles, nested radii. |
| Black shadows, one blur | Sheets, Travel and menus get the Frame drop shadow; the scrim behind Travel is a plain dim, not a second blur. The phone header may carry the one ink-glass blur. |
| Mark with the action dot | The dock's ring mark: its dot travels round the ring while a route is pending (stills under reduced motion and Pause motion). A small, playful signal that costs nothing. |
| Theme swap | The You menu and Appearance swatches swap `--acc` and `--l1…l3` with DESIGN's 0.8 s cross-fade, so "your profile takes over the colour" is felt inside the app too. |
| Motion | 150–260 ms ease-out for sheets and panels; nothing animates on keyboard-driven navigation (UX-ARCHITECTURE); reduced motion and Pause motion get opacity only. |
| Tokens and hooks | Rebuild on THEMING's public role names and add `data-part` hooks (`app.dock`, `app.header`, `app.tabs`, `app.banner`, `panel.here-now`, `travel`) as the frame is rebuilt. |

Where the playfulness lives (so the frame itself can stay quiet): presence activity lines, avatars ringed in each person's own theme colour, the mark's travelling dot, the theme swap, and the voice of empty-state copy. Not in neon, glows, mascots or per-destination colours.

## Sources

All checked 2026-10-04. "(secondary)" marks third-party reporting rather than the vendor's own words.

**Captures** (`docs/research/phase1-captures/shell/`, signed-out, headless Chrome, cookie banners declined):
- Taken 2026-10-02 (earlier run): `bluesky-profile-{desktop,tablet,phone}`, `discord-discovery-desktop`, `elk-public-{desktop,phone}`, `mastodon-explore-{desktop,phone}`, `reddit-sub-{desktop,tablet,phone}`, `threads-profile-{desktop,phone}`, `x-profile-desktop`.
- Taken 2026-10-04 (this run): `telegram-channel-{desktop,phone}` (t.me/s/telegram), `linear-home-desktop` (linear.app), `raycast-home-desktop` (raycast.com), `slack-features-desktop` (slack.com/features), `partiful-home-phone` (partiful.com).

**Products**
- Discord, mobile rebuild (5 Dec 2023): https://discord.com/blog/improving-our-mobile-experience
- Discord, desktop refresh (Mar 2025): https://discord.com/blog/player-release-q12025 ; https://www.engadget.com/gaming/pc/discords-redesigned-pc-app-has-multiple-dark-modes-a-new-overlay-and-more-160019822.html (secondary)
- Discord, Devices page: https://tabletmonkeys.com/how-to-secure-your-discord-account-check-and-log-out-of-devices/ (secondary)
- Discord, server creation choices: https://www.vibebot.gg/blog/how-to-create-discord-server (secondary) ; https://www.aol.com/news/discord-server-customize-chatroom-channels-220151896.html (secondary)
- Slack redesign (2023): https://slack.com/blog/productivity/a-redesigned-slack-built-for-focus
- Slack, sign out other sessions: https://www.howtogeek.com/447462/how-to-log-all-devices-out-of-your-slack-account/ (secondary)
- WhatsApp: https://wabetainfo.com/whatsapp-launches-a-mac-style-navigation-sidebar-for-ipad/ ; https://m.gsmarena.com/whatsapp_new_bottom_navigation_bar_android-news-62239.php ; https://tech.yahoo.com/general/articles/whatsapp-gets-fresh-redesign-much-182233238.html (all secondary)
- Telegram folders: https://telegram.org/blog/folders
- Element room list (2025): https://alternativeto.net/news/2025/9/element-web-and-desktop-add-redesigned-room-list-with-new-filters-and-clearer-notifications/ (secondary) ; https://github.com/element-hq/element-web/issues/29189
- Instagram: https://metricool.com/instagram-on-web/ (secondary) ; https://help.instagram.com/448523408565555
- Bluesky: https://github.com/bluesky-social/social-app/issues/7300 ; https://socialbee.com/blog/bluesky-settings/ (secondary) ; https://veroniiiica.com/bluesky-accessibility-features/ (secondary)
- Linear: https://linear.app/docs/select-issues ; https://shortcut.fyi/linear-shortcuts (secondary)
- GitHub Command Palette: https://docs.github.com/en/get-started/accessibility/github-command-palette
- cmdk: https://github.com/pacocoursey/cmdk
- Guilded closure: https://devforum.roblox.com/t/update-on-guilded-and-communities/3966775
- Geneva closure: https://en.wikipedia.org/wiki/Bumble_Inc. ; https://geneva.com/

**Guidance**
- Material 3 navigation bar: https://m3.material.io/components/navigation-bar/guidelines
- Material 3 navigation rail: https://m3.material.io/components/navigation-rail/guidelines
- Apple HIG, tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- NN/g, empty states (Kaplan, 2021): https://www.nngroup.com/articles/empty-state-interface-design/
- NN/g, skeleton screens (2023, reviewed 2026): https://www.nngroup.com/articles/skeleton-screens/
- NN/g, mobile navigation: https://www.nngroup.com/articles/mobile-navigation-patterns/

**Accessibility**
- APG combobox: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- APG keyboard interface (roving tabindex): https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- APG landmark regions: https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/
- APG tabs: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- WCAG 2.2 Understanding:
  - 2.4.1: https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html
  - 1.4.10: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
  - 2.4.11: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
  - 2.5.8: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
  - 2.1.4: https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html
  - 4.1.3: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- MDN prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

**Performance**
- Next.js linking and navigating: https://nextjs.org/docs/app/getting-started/linking-and-navigating
- next/link: https://nextjs.org/docs/app/api-reference/components/link
- loading.js: https://nextjs.org/docs/app/api-reference/file-conventions/loading
- Next.js 16: https://nextjs.org/blog/next-16
- React ViewTransition: https://react.dev/reference/react/ViewTransition
- web.dev Web Vitals: https://web.dev/articles/vitals
- web.dev INP: https://web.dev/articles/inp

**Not covered:** the signed-in shells of Messenger, Instagram, Threads, X and Arc, and Steam's settings (no sign-in; Steam profiles are covered in `docs/THEMING.md`). Raycast's page showed only its hero, so palette evidence comes from GitHub, Linear and cmdk documentation.
