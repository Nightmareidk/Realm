# Phase 1 research: Profiles and the social graph

Status: complete (2026-10-04). Legal points are dated and are not legal advice; anything marked "inference" or "recommendation" is a judgement, not an observed fact.
Date: 2026-10-04

## Top recommendations

1. **Teen defaults are the biggest gap.** Today every account gets the same `user_settings` defaults: profile public, DMs from friends and Space members, friend requests from everyone, presence and read receipts on. For 13 to 17-year-olds that conflicts with the UK Children's code ("high privacy" by default), Ofcom's child safety defaults (in force since 2025-03-17) and the EU's 2025 guidelines. Add a server-side **age ceiling** that clamps each setting by age: friends-only profiles, DMs from friends only, no follower counts or one-way followers under 16, never in strangers' lists or suggestions, never visible logged out. Add **friend links** (an expiring code or QR) so teens can add people they know. (Sections 3 and 6.5.)
2. **Keep the header order everyone already reads:** banner, picture overlapping it, display name, `@username · pronouns`, bio, one stats line, a "Friends with…" line, pins, tabs (Posts, Media). Make it Realm's through type, light and theme, not through a new layout. The side column (Right now, Spaces, Badges, "since 2026") uses the Here now panel slot on desktop and becomes an About tab on phones. (Sections 1 and 6.2 to 6.3.)
3. **One filled button that follows the relationship** (Add friend, Accept, Message), with Follow as a ghost button and Block, Report and Mute in a `⋯` menu that is trust UI and never themed. Friends gate chat and presence; follows only fill the Feed. Explain each in one sentence. (Sections 2 and 6.4.)
4. **Make friend requests safe and quiet:** pending requests expire after 30 days, declines are silent but put a 30-day cooldown on the sender, sending is rate-limited (more tightly for new accounts and adults sending to minors), and unfamiliar requests come with a warning. (Sections 2.3 and 6.4.)
5. **Edit in place, with the profile as its own preview,** with cropping to fixed shapes (1:1 and 3:1 with the phone safe area), optional descriptions for the picture and banner, EXIF stripped in Phase 1, and the four built-in themes (Mint, Orchid, Aqua, Ember) as the Phase 1 profile theme, which delivers the front page's promise without building the theme editor. (Sections 4 and 6.6.)
6. **Protect names:** usernames change at most every 30 days and old names redirect and are held for 30 days (GitHub releases them instantly, which invites takeovers); display names are normalised and checked against confusables of "Realm", "Support", "Staff" and similar; official marks stay system UI. (Section 4.3.)
7. **Lay the groundwork now so customisation plugs in later:** create `profile_showcases` (Phase 1 pins and featured badges are its first kinds), `badges` and `user_badges`, `media.purpose`, `username_history`, and a `viewer` block on the profile API; give the profile parts `data-part` names and keep the `⋯` menu and notices in `data-trust` containers. (Section 6.7.)
8. **Fix the front page:** the holo card's "LV 33" promises levels, which THEMING.md rules out; replace it before launch. (Sections 5.2 and 6.8.)

## 1. How profiles are designed in 2025-2026

**Evidence base.** Screenshots in `docs/research/phase1-captures/profiles/`, taken logged out with headless Chrome on 2026-10-04 (1440x900 desktop, 390-wide phone at 2x). Official accounts and public figures only: Bluesky (@bsky.app), GitHub (torvalds), Steam (Gabe Newell, Robin Walker, the Points Shop), TikTok (@tiktok), Twitch (twitch), Spotify (spotify), Last.fm (RJ, the co-founder), Tumblr (staff), SpaceHey (An, the founder), plus two pages added today: Discord's own blog post on profiles (`discord-blog-customize-desktop.jpg`) and Xbox Wire's friends-and-followers post (`xbox-friends-followers-desktop.jpg`). Instagram and Threads showed a login wall, X returned HTTP 403, TikTok showed a slider CAPTCHA and Letterboxd a Cloudflare check; none of these were bypassed, so for those products only what showed through the wall is used.

### 1.1 What each product puts in the header (observed 2026-10-04)

| Product | Header, top to bottom | Actions | Tabs | Notes |
|---|---|---|---|---|
| Bluesky (desktop and phone) | Banner (about 3:1), round avatar overlapping its bottom-left edge, display name (largest text) with a blue check, `@handle` in muted grey, one stats line ("35.1m followers · 15 following · 865 posts"), bio | `+ Follow` pill and `⋯`, right-aligned on the avatar row | Posts, Media, Videos, Feeds, Starter Packs | First post carries a small "Pinned" label. Phone layout is the same stack, with a back button floating on the banner. |
| GitHub | Large avatar in a left column, name, then username in grey, full-width Follow, "326k followers · 0 following", organisation, location, Achievements (badge icons with "x4" counts) | Follow; "Block or report user" as a quiet text link at the foot of the column | Overview, Repositories (12), Projects, Packages, Stars (2) | Up to six pinned items in a grid, then a contribution graph. On the phone the avatar shrinks and sits beside the name. |
| Steam, Robin Walker | A system notice above the profile (Valve staff will never ask for account details), avatar inside an animated frame, name, real name, flag and location, summary text, "View more info" | (logged-out view has none) | none: one long page | Right rail: "Level 32", one featured badge ("Valve Employee, 1,000 XP"), "Currently Offline", Profile Awards 28, Badges 17 (four icons shown), Screenshots 88, Reviews 4, Groups 36, Friends 294 (each with a level chip). Middle: showcases (Favorite Group with live member counts; Favorite Game with "1,083 hours played"), then a comment wall. Full-bleed game art behind everything, but every text block sits on a dark panel. |
| Steam, Gabe Newell | Avatar, name, "This profile is private." | none | none | The whole private state is one line; nothing else leaks. |
| TikTok | Avatar, name, `@handle` with check, one line "1 Following · 96M Followers · 464.9M Likes", bio, link | Follow (primary), Message, an add-friend icon, share, `⋯` | Videos, Favourites, Liked (the last two show lock icons when private) | Sort chips: Latest, Popular, Oldest. |
| Twitch | Big offline banner, avatar, name with check, "2.5M followers"; on the phone "Last live yesterday" sits under the name | Follow (heart), `⋮` | Home, About, Clips, Videos, Schedule, Chat | About panel holds social links and goals. |
| Spotify | Small "Profile" label, a very large name, "1,519 Public Playlists · 12,151,905 Followers · 327 Following" | Follow (ghost), `⋯` | none; sections of playlists | |
| Last.fm | Name with an "ALUM" text badge, "scrobbling since 20 Nov 2002", and **the top track with a play button inside the header** | (logged out) | none | Stats: Scrobbles, Artists, Loved tracks. |
| Tumblr | Blog title set as a wordmark, `@staff / staff.tumblr.com` | Follow, `⋯` | Posts, Comments | The left nav offers "Change palette": the *viewer* picks colours. |
| SpaceHey | MySpace layout: picture, quote, mood, "Last active: 8 hours ago", a "Contacting An" box | Add to Friends, Add to Favorites, Send Message, Forward to Friend, Instant Message, Add to Group, **Block User, Report User** | none | "Friend Space" (top friends), interests table, a public comment wall. On the founder's page that wall was full of strangers' complaints about moderation and unwanted messages to minors: an open wall on a profile becomes a public complaints and contact channel. |
| Discord (official blog image) | Banner art, avatar with a presence dot, a row of small badge icons, display name, username, "About me", "Discord member since", a private "Note" ("Click to add a note") | (in-app: Message, Add Friend, `⋯`) | (full profile) rows for "1 Mutual Server" and "2 Mutual Friends" | Profile is mostly a pop-out card, not a page. |
| Xbox (official blog image) | People panel: "Friends, 20 friends online", "Friend requests, 6 pending", Gamerscore leaderboard, Clubs, Looking for Group, "Recently played with", "Find someone" | | | Requests have their own row with a pending count. |

Sources: the captures above; Discord's profile post ([discord.com/blog/ways-to-customize-your-discord-experience](https://discord.com/blog/ways-to-customize-your-discord-experience), checked 2026-10-04); Xbox Wire ([news.xbox.com, 2024-09-11](https://news.xbox.com/en-us/2024/09/11/new-xbox-friends-and-followers-experience/), checked 2026-10-04). Discord's help article lists the editable fields as display name ("won't affect your actual username"), pronouns ("a small text field"), About Me with bold, italics, lists and emoji, banner and profile theme, and Nitro per-Space profiles ([Custom Profiles](https://support.discord.com/hc/en-us/articles/4403147417623-Custom-Profiles); [Per-Server Profiles](https://support.discord.com/hc/en-us/articles/4409388345495-Per-Server-Profiles); the help centre returned 403 to direct fetches, so these come from its indexed text, 2026-10-04).

### 1.2 Patterns that hold across products

1. **One header order, nearly everywhere:** banner, avatar overlapping the banner's lower edge, display name, `@username`, one stats line, bio, actions on the right of the avatar row, tabs. Bluesky, TikTok, Twitch, Discord and Spotify all use it. People already know how to read it, so Realm should keep the order and make it its own through type, light and the theme (inference).
2. **Display name is big, the handle is quiet.** The `@username` always sits directly under the name in a muted tone. Pronouns are a short field beside or under the name (Discord, Instagram), never inside the bio. Realm's current limits (display name 48, pronouns 40, bio 300; `shared/contracts/src/limits.ts`) are in line.
3. **Stats are one line of text, not tiles.** Bluesky, GitHub, TikTok and Spotify all print counts inline with abbreviations ("35.1m", "326k"). Steam is the outlier, with a rail of counters, and it reads as clutter. Snapchat removed favourite counts for under-16s on 2026-06-10 ([Snap newsroom](https://newsroom.snap.com/friends-only-way-to-create-and-share-for-snapchatters-under-16), checked 2026-10-04).
4. **One primary action, everything else in `⋯`.** Follow is the only filled button on Bluesky, GitHub, Twitch, Spotify and Tumblr. Products with both friends and follows (TikTok) add Message and an add-friend icon as secondary buttons. Block and report live in `⋯` (Bluesky, TikTok) or as a quiet link (GitHub), never as a coloured button.
5. **Tabs are 3 to 6, named by content type**, sometimes with counts (GitHub "Repositories 12"). Locked tabs show a lock rather than disappearing (TikTok), so the layout doesn't shift between viewers.
6. **Pinned content is labelled, small and limited.** Bluesky labels one pinned post; GitHub allows six pinned items.
7. **"Right now" is a header-level element.** Last.fm puts the current or top track with a play button in the header; Twitch puts "Last live yesterday" under the name; Steam shows "Currently Offline" or the game being played at the top of the rail; Discord shows a presence dot on the avatar and the activity on the card. Realm's "Right now" box on the front page fits this, but it is presence, so it must obey the presence setting (section 3).
8. **Badges without clutter:** show one featured badge near the name (Steam's level plus featured badge; Last.fm's "ALUM"), and the rest behind a count and a few icons (Steam "Badges 17" with four icons; GitHub achievements with "x4" multipliers). Long badge rows next to the name are what Discord's card does, and with many badges it gets busy (inference from the Discord image).
9. **Customisation stays readable because text never sits on the art.** Steam's full-bleed backgrounds are busy, yet every block of text is on a dark, mostly opaque panel. Tumblr lets the *viewer* change palette. Twitch's banner is decoration only, with text on a solid panel below.
10. **Private states are one honest line.** Steam's private profile shows avatar, name and "This profile is private." TikTok shows locked tabs with a lock icon.
11. **Phones: same stack, one column.** Avatar over banner, actions right of the avatar, tabs scroll sideways (Bluesky, Twitch). GitHub moves the avatar beside the name. Twitch's phone About tab turns links into huge pills, which pushes content far down: keep links compact.
12. **Logged-out access is shrinking.** Instagram and Threads put up login walls, X refused the request, TikTok raised a CAPTCHA. Bluesky, GitHub, Steam, Twitch, Spotify, Tumblr and Last.fm showed public profiles. For Realm this is a privacy decision as much as a growth one (section 3).
13. **Trust notices sit above the profile, outside its styling.** Steam's "Valve employees will never ask you for…" banner is rendered in Steam's system style above a fully customised profile. That is exactly Realm's "never themeable" rule in practice.

## 2. Friends vs follows

### 2.1 Products that run both, and how they explain it

- **Xbox (since 2024-09-11):** "Friends are now a two-way, invite-approved relationship", while "following someone remains a one-way connection, allowing you to stay updated with their shared content." Existing mutual follows became friends automatically; one-way follows stayed follows. New privacy settings control who can send friend requests and who can follow you ([Xbox Wire](https://news.xbox.com/en-us/2024/09/11/new-xbox-friends-and-followers-experience/), checked 2026-10-04). Xbox moved *from* follows-only *back to* friend requests; for a gaming audience, a mutual relationship is the one people expect to gate chat and presence.
- **Snapchat:** friends are mutual. For 13 to 15-year-olds, from 2026-06-10, "content on their profile is only visible to mutually accepted friends — not one-sided 'followers'", and they can't be messaged by anyone they haven't added or don't have in their phone contacts. 16 and 17-year-olds get an "optional introduction to public sharing, with additional safeguards, limited distribution, and parental visibility" ([Snap newsroom, 2026-06-10](https://newsroom.snap.com/friends-only-way-to-create-and-share-for-snapchatters-under-16), checked 2026-10-04).
- **Discord:** friends only (with a request), no follows; the profile shows mutual servers and mutual friends (blog image above).
- **TikTok:** one-way follows, with Message and an add-friend icon on the profile (capture).
- **Steam:** friends with requests plus a public comment wall; the friend list on the profile shows each friend's level (capture).
- **SpaceHey:** "Add to Friends" and "Add to Favorites" side by side (capture), which shows the cost of two similar verbs with no explanation.

### 2.2 How to explain it in Realm

Realm's schema already separates the two: `relationships` (friend, pending_outgoing, pending_incoming, blocked) and `follows` (active, pending) in `backend/db/src/schema/social.ts`. The interface has to make the difference obvious in one sentence each (proposed copy):

- **Friends** "Friends can message you, see when you're online and what you're playing, and see posts you share with friends. You both have to agree."
- **Follow** "Following shows someone's public posts and clips in your Feed. They don't have to follow you back, and it doesn't let you message them."

Rules that follow from this (recommendation):
- Friends gate chat and presence; follows gate nothing but the Feed. Accepting a friend request also creates a follow both ways (each can unfollow later), as Xbox did with mutual follows.
- On a profile, the one filled button is **Add friend** when you share a Space or a friend (the likely case for a friend-group product), and **Follow** otherwise; the other action sits next to it as a ghost button. Never two filled buttons.

### 2.3 Friend-request states

| State (viewer's side) | Button shows | What the other person sees | Notes |
|---|---|---|---|
| None | Add friend | nothing | Hidden if their friend-request setting excludes you; show "Not accepting friend requests" in `⋯` rather than a dead button. |
| Sent (pending_outgoing) | Requested (menu: Cancel request) | an entry in Requests with Accept and Decline | Cap outgoing pending requests (e.g. 100) and rate-limit sending; new accounts get lower limits. |
| Received (pending_incoming) | Accept / Decline | — | Show mutual friends and shared Spaces inside the request, the way Discord shows "mutual friends" on the card, so people can tell who it is. For teens, warn on unfamiliar requests (Discord does this since 2026-02-09, see section 3). |
| Accepted (friend) | Friends ✓ (menu: Remove friend) | Friends ✓ | Removing is silent. |
| Declined | Add friend again after a cooldown | — | Declining is silent: the sender's request simply stays "Requested" until it expires or they cancel (inference: avoids rejection notifications and retaliation). Store a `declined_at` so repeat requests are throttled. Today's enum has no declined or expiry state; add one. |
| Blocked | Unblock (in `⋯`) | they see your profile as unavailable | Blocking removes friendship and follows in both directions, hides each from the other's lists, and stops DMs and requests. Blocks are private. |

### 2.4 Mutual friends and privacy

- Mutual friends are the best signal for "do I know this person?" (Discord's card, Snapchat's friend-suggestion rule). Show "Friends with Noor and 2 others" only to signed-in people, only listing friends the viewer already has.
- Friend and follower lists expose the social graph. Ofcom's illegal-harms codes (in force from 2025-03-17) expect that, by default, **children are not included in other users' connection lists, their own connection lists are not shown to others, they are not suggested to others in "people you may know" prompts and are not shown such prompts, and non-connected accounts cannot send them direct messages** ([Ofcom Illegal content Codes of Practice for user-to-user services](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/illegal-content-codes-of-practice-for-user-to-user-services-24-feb.pdf?v=391889); summary via [Lewis Silkin, 2024-12-16](https://www.lewissilkin.com/insights/2024/12/16/ofcom-publishes-final-illegal-harms-codes-102jrep), both checked 2026-10-04). These apply to services at high risk of grooming, and to large services at medium risk. Realm has DMs, friend requests and teens, so it should assume they apply.
- Phase 1 therefore needs: a setting for who can see your friend list (default: friends; for under-18s: only you), and under-18s excluded from every list and suggestion shown to people they aren't connected to.

## 3. Privacy settings for teens and adults

### 3.1 The legal floor, with dates (not legal advice; checked 2026-10-04)

| Rule | Date | What it asks for that touches profiles |
|---|---|---|
| UK ICO Age Appropriate Design Code ("Children's code"), standard 7 | In force 2020-09-02; 12-month transition to 2021-09-02 | "Settings must be 'high privacy' by default (unless you can demonstrate a compelling reason for a different default setting, taking account of the best interests of the child)" ([ICO, standard 7](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/7-default-settings/)). Standard 10: geolocation off by default, an obvious sign when it's on, and location-sharing options reset to off at the end of each session ([ICO code standards](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/code-standards/)). Applies to under-18s. |
| UK Online Safety Act: Ofcom illegal-harms codes | Published 2024-12-16; duties from 2025-03-17 | Safety defaults for child users: profile, location and connections not visible to others; not in others' connection lists or "people you may know"; non-connected accounts can't DM them ([Ofcom codes PDF](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/illegal-content-codes-of-practice-for-user-to-user-services-24-feb.pdf?v=391889)). |
| UK Online Safety Act: protection-of-children duties | 2025-07-25 | Highly effective age assurance where a service allows content harmful to children. Bluesky's UK response (2025-07-10): people under 18, or anyone who doesn't verify, lose direct messages and adult content ([Bluesky blog](https://bsky.social/about/blog/07-10-2025-age-assurance)). |
| Ofcom's public call for anti-grooming commitments | 2026-05-21 | Meta, Snap and Roblox committed to defaults so stranger adults can't contact children and children aren't nudged to add strangers; TikTok and YouTube declined some of the asks ([Ofcom update PDF](https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/protecting-children/project-mercury/update_tech-firms-responses-to-our-call-for-action-to-protect-children.pdf?v=418243); [SCL summary](https://www.scl.org/tech-firms-commit-to-stronger-anti-grooming-measures-in-response-to-ofcom-demands/)). Ofcom's own page returned 403 to a direct fetch. |
| EU DSA Article 28 guidelines on minors | 2025-07-14 | Not binding, but the Commission measures compliance against them: minors' accounts private by default, features that drive excessive use off, no push notifications in core sleep hours ([European Commission](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors); [Freshfields](https://www.freshfields.com/en/our-thinking/blogs/technology-quotient/dsa-decoded-6-the-european-commission-finalises-guidelines-on-the-protection-of-102kv4s)). |

Realm's minimum age is 13 (`shared/contracts/src/limits.ts`), and `users.birth_date` is stored, so the server can already tell a 13 to 17-year-old from an adult. **Today's `user_settings` defaults are the same for everyone: profile public, DMs from friends and Space members, friend requests from everyone, presence on, read receipts on** (`backend/db/src/schema/users.ts`). For under-18s, three of those five break the rules above.

### 3.2 What the big products do now

- **Instagram Teen Accounts** (announced 2024-09-17): under-16s are private by default (new followers need approval; non-followers can't see or interact with content); the strictest messaging setting (only people they follow or are connected to can message them or add them to group chats); only people they follow can tag or mention them; Hidden Words on; sleep mode 10pm to 7am; under-16s need a parent to loosen any of this ([Meta newsroom](https://about.fb.com/news/2024/09/instagram-teen-accounts/), checked 2026-10-04). Instagram says 97% of 13 to 15-year-olds kept the defaults ([Instagram](https://about.instagram.com/blog/announcements/instagram-teen-accounts)).
- **Snapchat:** friend lists private for teens; teens can only talk to mutually accepted friends or saved phone contacts; Find Friends suggestions for 13 to 17s need more friends in common ([Snapchat Parents, Safeguards for teens](https://parents.snapchat.com/safeguards-for-teens)). From 2026-06-10, under-16 profiles are friends-only with no one-way followers and no favourite counts ([Snap newsroom](https://newsroom.snap.com/friends-only-way-to-create-and-share-for-snapchatters-under-16)).
- **Discord** (announced 2026-02-09, phased from early March 2026): everyone starts with teen-appropriate defaults. DMs from people you may not know go to a separate message-request inbox, and only age-assured adults can change that; friend requests from unfamiliar accounts come with a warning; sensitive content blurred; age-gated Spaces and speaking on stage are adults-only. Global age assurance was then delayed to the second half of 2026 ([Discord press release](https://discord.com/press-releases/discord-launches-teen-by-default-settings-globally), checked 2026-10-04).
- **Bluesky:** "Allow new messages from: Everyone / Users I follow / No one", default "Users I follow" ([Bluesky DMs launch, 2024-05-22](https://bsky.social/about/blog/05-22-2024-direct-messages)); DMs off in the UK for under-18s and unverified users (above). Bluesky has no private profiles at all, because posts are public protocol data (inference from the product; profiles in the capture are fully public logged out).
- **Xbox:** separate settings for who can send friend requests and who can follow you ([Xbox Wire](https://news.xbox.com/en-us/2024/09/11/new-xbox-friends-and-followers-experience/)).
- **Presence and read receipts are reciprocal on WhatsApp:** "If you don't share your last seen or online, you can't see other users'"; the same for read receipts, except they're always sent in groups ([WhatsApp, About last seen and online](https://faq.whatsapp.com/general/chats/about-last-seen-and-online/?lang=en); [WhatsApp privacy settings](https://faq.whatsapp.com/3307102709559968/?cms_platform=web), checked 2026-10-04). Reciprocity stops people hiding while watching others, and it's easy to explain.

### 3.3 Plain-language settings for Realm (proposed copy)

One page, **Settings › Privacy**, in the order people worry about them. Each row is a question with the answer as the control, and one line underneath saying what it means. Teen-locked rows show a lock and "Locked for under-18s. This changes on your 18th birthday."

| Row | Choices | Adults default | 13 to 17 default | Teen can change? |
|---|---|---|---|---|
| **Who can see your profile?** | Everyone, including people not signed in · People on Realm · Friends only | People on Realm | Friends only (name, picture and username stay findable so friends can add you) | 16 to 17 may choose "People on Realm"; never "Everyone" |
| **Who can message you?** | Everyone · Friends and people in your Spaces · Friends · Nobody. New people land in **Requests**, not your chats. | Friends and people in your Spaces | Friends | No |
| **Who can send you friend requests?** | Everyone · Friends of friends · Nobody | Everyone | Friends of friends (with a warning on requests from people you share nothing with) | Can narrow, not widen |
| **Who can follow you?** | Everyone · Only people you approve · Nobody | Everyone | Only people you approve (13 to 15: friends only, no followers, as Snapchat now does) | No |
| **Who can see your friends list?** | Friends · Only you | Friends | Only you; and you never appear in strangers' lists or suggestions | No |
| **Show when you're online and what you're playing** | On · Off. "If you turn this off, you won't see others' either." | On, friends only | On, friends only | Yes |
| **Read receipts in DMs** | On · Off, reciprocal. Group chats: off by default in Phase 1 | On | On | Yes |
| **Show up in "people you may know"** | On · Off | On | Off, and can't be turned on | No |

Wording rules: name the audience, not the mechanism ("Friends only", not "Private"); every choice that widens an audience for a teen says who that adds ("This lets anyone on Realm see your posts"). Encryption status on DMs is a separate, untouchable label ("Not end-to-end encrypted yet") and not a privacy *setting*.

## 4. Profile editing UX

### 4.1 Inline vs separate editor

- **Modal over the profile** (Bluesky, X, Instagram on the web): "Edit profile" opens a sheet with banner, avatar, name and bio fields over the page you were looking at. Fast, but you can't see the result until you save (observation of these products' public UI; logged-in editors weren't captured).
- **Settings page with a live preview card** (Discord): the blog image shows an "Edit Your Profile" control, and Discord's profile settings place the editable fields beside a preview of the card ([Discord blog](https://discord.com/blog/ways-to-customize-your-discord-experience), checked 2026-10-04).
- **Inline in the sidebar** (GitHub): an "Edit profile" button turns the left column into a form in place.

Recommendation for Realm: **edit in place on your own profile, with the page itself as the live preview.** Pressing "Edit profile" turns the header into editable regions (banner, picture, name, pronouns, bio) with a sticky bar at the bottom: "Cancel · Save". It's the same page, so there's no gap between preview and result. That matters more on Realm than elsewhere, because the profile *is* the theme preview later (the front page shows a profile driving the whole page's colour). On phones the same mode works as a full-screen sheet with the header at the top. Settings › Profile links to the same mode instead of duplicating fields (UX-ARCHITECTURE principle 2, "every feature has a home").

### 4.2 Pictures

- **Crop at upload, in the browser, to fixed shapes:** picture 1:1 shown in a circle; banner 3:1 (Bluesky's proportion in the capture) with the phone-width safe area outlined, because phones crop banners harder. Zoom slider plus drag; keyboard: arrow keys move, +/- zoom (WCAG 2.1.1). Upload the original and the crop rectangle, and let the media pipeline make the variants, so a later re-crop doesn't need a new upload (recommendation).
- **Formats:** static images only in Phase 1 (THEMING.md keeps animated pictures and banners for later). Strip EXIF on the server (already planned for Phase 2 in the roadmap; for profile pictures, which are public, do it in Phase 1, since location metadata in a teen's photo is exactly what the AADC standard 10 is about).
- **Alt text:** a profile picture next to the name is identified by the name, so screen readers get "Maya's profile picture" automatically; an optional description field is for people who want to describe it. The banner gets an optional description, and is treated as decorative (empty `alt`) when left blank. Today `post_media.alt_text` exists but `media` has no alt text, and `users` stores only `avatar_media_id` and `banner_media_id`, so add `avatar_alt` and `banner_alt` on the profile, not on the media row (the same image could mean different things in different places).
- **Moderation:** profile pictures and banners are public and shown everywhere a name appears, so they go through the same scanning as posts and are reportable from the profile's `⋯` menu ("Report profile picture or banner").

### 4.3 Usernames, display names and impersonation

Evidence:
- GitHub: "After changing your username, your old username becomes available for anyone else to claim", and links to the old profile return 404 ([GitHub Docs](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-personal-account-settings/changing-your-github-username), checked 2026-10-04). Releasing a name instantly invites someone to take it and receive the old owner's traffic.
- Instagram limits name changes to twice every 14 days ([Instagram Help](https://help.instagram.com/2994759677322122/), checked 2026-10-04).
- Bluesky added blue checks on 2025-04-21, issued by Bluesky and by "Trusted Verifiers" (organisations that verify their own staff); 18 organisations had that status by the end of 2025 ([Bluesky blog](https://bsky.social/about/blog/04-21-2025-verification); [TechCrunch](https://techcrunch.com/2025/04/21/bluesky-launches-blue-check-verification/), checked 2026-10-04). Its own bio in the capture says "official Bluesky account (check username)": the handle is the identity, the display name is decoration.
- Steam's Robin Walker profile uses its *bio* to warn that people on Discord pretending to be him are scammers, and Steam shows a system banner above staff profiles (capture). Impersonating staff is a common enough attack that both the person and the platform warn about it.

Rules for Realm (recommendation):
1. **Username** (`@maya`): 3 to 32 characters of a-z, 0-9, `_` and single dots (already in `shared/contracts`). Change at most once every 30 days. The old name is **held for 30 days**: `/@oldname` redirects to the new profile, and nobody else can claim it. Show "Previously @oldname" on the profile for those 30 days so friends aren't confused.
2. **Display name:** 1 to 48 characters, any script, changeable freely (with a rate limit against abuse, e.g. 5 per hour). Normalise (NFKC), strip zero-width and bidi-override characters, and reject display names whose confusable skeleton (Unicode TR39) matches a reserved word ("Realm", "Realm Support", "Admin", "Moderator", "Official", "Staff", "Trust & Safety").
3. **Reserved usernames:** the existing `RESERVED_USERNAMES` list (`backend/api/src/modules/auth/reserved.ts`) applies on change as well as on sign-up; add routes (`settings`, `explore`, `spaces`, `messages`, `download`, `help`, `legal`) so `/@name` can never shadow a page.
4. **Official marks are system UI**, drawn from `--r-sys-*` tokens and in reserved shapes no cosmetic can copy (THEMING.md §3.5). Staff profiles get a system notice above the header, like Steam's.
5. **Pronouns** stay a free text field (40 characters), shown in the muted handle line, with a visibility choice (everyone / friends), since for some people pronouns are sensitive (recommendation; Instagram offers a followers-only option, but that could not be re-verified today).

### 4.4 Accessibility of colourful custom profiles

- **Contrast:** text 4.5:1 (WCAG 1.4.3), icons, borders and focus rings 3:1 (WCAG 1.4.11), measured against the *worst* point of any background, which is what DESIGN.md's Worst Point Rule already does for the light field. Text never sits directly on a banner or background picture: it goes on a panel (Steam's lesson, section 1.2 item 9).
- **Motion:** anything that moves on its own for more than five seconds needs a pause (WCAG 2.2.2, [Understanding 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)); nothing flashes more than three times a second (WCAG 2.3.1). Under `prefers-reduced-motion` or Realm's Pause motion, animated effects show their first frame. The holo card's pointer-driven tilt and foil already exist on the front page; on profiles they should respond to hover or focus only, never to device motion, and be static under reduced motion.
- **Names in colour:** a coloured name style must pass contrast in both night and day editions, or fall back to the default ink (THEMING.md §4.5 already plans a "readable-colour clamp", after Twitch).
- **Screen readers:** the profile header is one landmark with the name as its heading (`h1` on the profile page); stats read as "35 thousand followers", not "35.1m"; badges each have a name and a one-line description ("Founder: made a Space that reached 10 members").
- **Viewer control beats owner styling.** High contrast and reduced motion override profile colours and effects; a viewer can turn off other people's animated backgrounds (THEMING.md §4.1).

## 5. Steam-style customisation and theme culture

THEMING.md §2.1 to §2.5 already covers BetterDiscord, Vencord, Discord's Shop and the Steam Points Shop in depth, with sources. This section adds what today's captures and searches show, and what it means for Phase 1.

### 5.1 What Steam actually offers (checked 2026-10-04)

- **Showcases:** Rarest Achievement, Game Collector, Item Showcase, Items Up For Trade, Badge Collector, Favorite Game, Screenshot Showcase, Custom Info Box, Favorite Group, Workshop Showcase, Favorite Guide, Achievement Showcase, Awards, Completionist, among others; one showcase slot per 10 Steam levels, and some showcases can be bought in upgraded, larger forms ([Steam community guide to showcases, levels and awards](https://steamcommunity.com/sharedfiles/filedetails/?id=2347274114); [Points Shop, Profile Showcases](https://store.steampowered.com/points/shop/profileshowcases)). The Robin Walker capture shows two in use: Favorite Group (with live member, in-game and online counts) and Favorite Game (hours played, an achievement, a review).
- **The Points Shop** (capture `steam-pointsshop-desktop.jpg`): sections for Avatars, Backgrounds, Community Awards, Seasonal Badge, Game Profiles and Showcases under PROFILE; Animated Stickers and Chat Effects under CHAT; Keyboards and Startup Movies under INTERFACE. The "Autumn Sale 2026 Items" row priced Game Profiles (a bundled theme, background, frame and avatar) at 5,000 points and Profile Backgrounds at 1,000; a "Tiled Profile Backgrounds" row listed 71. Points come from spending (THEMING.md §2.5).
- **Levels and badges:** the level circle sits at the top right of the profile with one featured badge beneath; the friend list shows each friend's level (capture). Levels come from crafting badges, mostly from trading cards bought on Valve's market (THEMING.md §2.5).
- **Private profiles** reduce to a single line ("This profile is private.", Gabe Newell capture).

### 5.2 What people love and what they complain about

- **Love (inference from the captures and from the volume of community guides):** a profile you can *arrange*, not just fill in: picking which games, screenshots and badges represent you; full-bleed backgrounds from games you love; levels, badges and dates as visible history (Last.fm's "scrobbling since 20 Nov 2002" and Discord's "Discord member since" do the same with time). Realm's front-page Maya already promises this: pinned clip, right now, Spaces, badges, a showcase card.
- **Complaints about performance:** combinations of animated avatars, frames and backgrounds reported at 30 to 50% CPU; streamers losing frames in OBS with an animated background open; requests to disable animated backgrounds, and toggles for people with epilepsy covering avatars, backgrounds and frames ([Steam Discussions: "unoptimized animated stuff"](https://steamcommunity.com/discussions/forum/0/3155312251415879793/); [Disable animated profile backgrounds](https://steamcommunity.com/discussions/forum/1/3278065526393379063/); [Steam Client Beta: Points Shop animations lag](https://steamcommunity.com/groups/SteamClientBeta/discussions/3/3496509339517372815/), all checked 2026-10-04). This is the same failure Realm's own front page had on the owner's integrated GPU, so the budget rules in THEMING.md §4.11 matter.
- **Complaints about access** (inference, consistent with THEMING.md §2.5): showcase slots depend on level, and level depends on buying cards, so expression is tied to spending. THEMING.md already rules out levels at launch. **The front page's holo card says "LV 33"**, which promises a level system Realm has decided not to build. Replace it with something real (for example "since 2026" or a clip count) before launch.
- **Abuse surfaces:** Steam's comment walls and SpaceHey's friend comments become public message boards that strangers use (SpaceHey capture). Realm has no profile wall in the roadmap and shouldn't add one; posts on a profile already have comments with moderation.

### 5.3 BetterDiscord culture, in one paragraph

People install client mods to run themes like ClearVision (a short list of variables: main colour, fonts, background image, blur, brightness) and Frosted Glass, often through community editors with sliders, despite Discord's terms forbidding client mods (THEMING.md §2.1 to §2.3, with sources). What they want is mostly *values, not code*: a colour, a picture behind the app, some blur, a font. Realm's Layer 1 token themes give exactly that, officially.

### 5.4 Keeping customisation from breaking contrast or safety labels

Already decided in THEMING.md, and confirmed by today's evidence:
- No HTML or CSS on profiles, ever (MySpace and the Samy worm; SpaceHey still allows CSS and now proxies media to stop IP logging).
- Text sits on panels, not on art (Steam).
- Trust UI sits outside the profile's styling: the report and block menu, encryption labels, staff and official marks, safety notices (Steam's staff banner is the model). The `⋯` menu on a profile, and everything it opens, is `data-trust` UI.
- Viewers can switch off other people's animation, and high contrast ignores profile colours.

What Phase 1 has to do so this works later: render the profile from named parts (`data-part="profile-banner"`, `profile-identity`, `profile-actions`, `profile-tabs`, `profile-showcase`), take every colour from semantic tokens, and keep the `⋯` menu, report flow and any "not end-to-end encrypted yet" label in a `data-trust` container from day one.

## 6. Recommendations for Realm

Everything here is a recommendation built on sections 1 to 5. Phase 1 builds the plain profile; the hooks for themes, showcases and frames go in now, so the "Make it yours" work later adds rows and renderers instead of rewriting the page or migrating data.

### 6.1 Where the profile lives

- URL `/@username` (real URL, Back works). It's a Detail-level page (UX-ARCHITECTURE level 3) in the normal shell: dock on the left, profile in the content area, and on desktop the right-hand panel slot (Here now's 280px) holds the profile's side column.
- A **profile peek** (hover or click a name in chat, a member list, a post): a card on desktop, a bottom sheet on phones, with banner, picture, name, `@username · pronouns`, Right now, mutual friends, the primary action and "View profile". Chat needs it in Phase 1 anyway, and it's where the mini-profile background plugs in later.

### 6.2 Header (desktop, 1024px and up)

```
┌──────────────────────────────────────────────────────────┬──────────────┐
│ [ banner 3:1, max 280px tall, rounded, theme lights      ]│ RIGHT NOW    │
│   (●128px picture overlapping the banner's lower edge)    │ Celeste, Ch7 │
│                                   [Add friend] [Follow] ⋯ │ practice · 1h│
│ Maya                                                      │              │
│ @maya · she/her                                           │ SPACES       │
│ speedruns, sourdough, very long voice calls               │ ◐ ◑ ◒ +6     │
│ 12 friends · 340 followers · 85 following                 │              │
│ Friends with Noor, Kenji and 3 others                     │ BADGES       │
│ ┌ Pinned ─────────────┐ ┌ Pinned ──────────┐              │ ★ ◆ ●  12 →  │
│ └─────────────────────┘ └──────────────────┘              │              │
│ [ Posts ] [ Media ]                                       │ Since 2026   │
│ …post list…                                               │              │
└──────────────────────────────────────────────────────────┴──────────────┘
```

- **Order:** banner, picture, name (Funnel Display, about 2rem, as in the front-page frame), `@username · pronouns` (Ink 2), bio (up to three lines, then "more"), one stats line, the mutual-friends line, pins, tabs. This is the order people already read (section 1.2).
- **Stats line:** "12 friends · 340 followers · 85 following". The friend count shows only if the viewer may see the friend list. Under-16s show no follower count (they have no followers, see 6.5). Numbers abbreviate in text ("1.2k") but read in full to screen readers.
- **Side column:** Right now (presence, so it obeys the presence setting and is hidden from non-friends by default), Spaces (only public Spaces, or Spaces you share), Badges (up to three featured, then a count that opens all), and "On Realm since 2026". On phones this column becomes the About tab.
- **Pins:** up to three pinned posts (clips from Phase 3), each labelled "Pinned".
- **Tabs, Phase 1:** Posts, Media. Phase 3 adds Clips. A tab the viewer can't see shows a lock and one line ("Only Maya's friends can see this") rather than vanishing.
- **Own profile:** "Edit profile" (primary) and "Share profile" (ghost) replace the social actions.

### 6.3 Header (phone, under 768px)

One column: banner full width at 3:1, 88px picture overlapping it, primary action and `⋯` on the right of the picture row; then name, `@username · pronouns`, bio, stats line, mutual line; Right now as one compact row; three featured badges with a count; pins as a horizontal row; tabs **Posts · Media · About**, sticky under the app header when you scroll. 44px touch targets. Links stay compact (Twitch's huge link buttons are the counter-example).

### 6.4 Actions and their states

The one filled button follows the relationship; everything else is a ghost button or sits in `⋯`.

| Relationship to viewer | Filled button | Ghost button | `⋯` menu (trust UI, never themed) |
|---|---|---|---|
| Stranger, friend requests allowed | Add friend | Follow | Copy profile link · Mute · Block · Report |
| Stranger, friend requests not allowed | Follow (if allowed) | — | "Not accepting friend requests" (disabled row), plus the above |
| Request sent | Requested ▾ (Cancel request) | Follow / Following | as above |
| Request received | Accept | Decline | as above |
| Friends | Message | Following ▾ (Unfollow) | Remove friend · Mute · Block · Report |
| You follow, not friends | Add friend | Following ▾ | as above |
| You blocked them | Unblock | — | Report |
| They blocked you, or the profile is hidden from you | none: "This profile isn't available." (the same as a missing profile, so a block isn't revealed) | | |

Decline and Remove friend are silent. Requests expire after 30 days; a declined request blocks a new one from the same person for 30 days. Outgoing requests are capped and rate-limited, more tightly for new accounts and for adults sending to under-18s.

Limited views, in plain words:
- Friends-only profile, viewer not a friend: picture, name, `@username`, "Only Maya's friends can see their profile", and Add friend if allowed.
- Under-18 profile, viewer not connected: picture, name and `@username` only; no banner, bio, Spaces, counts, badges or presence (Ofcom child safety defaults).
- Not signed in: only adults who chose "Everyone" are visible; everyone else gets "Sign in to see this profile". Under-18s are never visible logged out.

### 6.5 Privacy settings and defaults by age

Settings › Privacy uses the questions in section 3.3. The server enforces an **age ceiling**: for each setting it takes the user's choice and clamps it to what their age allows, so a teen can always choose *more* private and never less. On the 18th birthday nothing changes on its own; the person gets a notice that the locked settings are now theirs to change.

| Setting (column) | Adults (18+) | 16 to 17 | 13 to 15 |
|---|---|---|---|
| Profile visible to (`profile_visibility`) | Signed-in people (choices: everyone · signed-in people · friends) | Friends (may choose signed-in people) | Friends (locked) |
| Who can message you (`dm_policy`) | Friends and people in your Spaces; others go to Requests | Friends (locked) | Friends (locked) |
| Friend requests from (`friend_request_policy`) | Everyone | Friends of friends, plus friend links | Friends of friends, plus friend links |
| Who can follow you (`follow_policy`, new) | Everyone | People you approve | Friends only: no followers (as Snapchat since 2026-06-10) |
| Friend list visible to (`friend_list_visibility`, new) | Friends | Only you | Only you |
| Suggested to others (`discoverable`, new) | On | Off (locked) | Off (locked) |
| Online and activity (`show_presence`) | Friends, reciprocal | Friends, reciprocal | Friends, reciprocal |
| Read receipts (`show_read_receipts`) | On, reciprocal, DMs only | On | On |
| Profile post default audience | Public | Friends | Friends |

**Friend links** (`/f/<code>`, also shown as a QR code): the way teens add people they know offline without being searchable. Codes expire (7 days) and can be revoked.

### 6.6 The editor

Edit in place on your own profile (section 4.1), with a sticky "Cancel · Save" bar; on phones, a full-screen sheet.

| Field | Phase 1 | Rules |
|---|---|---|
| Banner | Upload, crop 3:1 with the phone safe area shown, remove; optional description | Static image, EXIF stripped, scanned, reportable |
| Picture | Upload, crop 1:1 in a circle, remove; optional description | Same |
| Display name | 1 to 48 characters | NFKC, no zero-width or bidi controls, no confusables of reserved words |
| Username | Separate confirm step | Once per 30 days; the old name redirects and is held for 30 days; "Previously @old" shown for 30 days; reserved list includes app routes |
| Pronouns | 40 characters | Visibility: everyone or friends |
| Bio | 300 characters, plain text with links and emoji | Links open through the "You're leaving Realm" warning (trust UI) |
| Profile theme | One of Mint, Orchid, Aqua, Ember | Built-in themes with contrast already solved (DESIGN.md's Worst Point Rule); delivers the front page's theme promise without the theme editor |
| Pins | Up to 3 posts | Only posts the viewer could see anyway |
| Featured badges | Up to 3 of the badges you've earned | Badges are earned, never bought, in Phase 1 |
| Right now | Status text (80 characters) plus emoji, with expiry (30 min · 1 h · today · never); "in a Space" is automatic | Game detection comes later with account links |

Validation runs on the client for speed and on the server as the authority (contracts already share Zod schemas). Unsaved changes ask before leaving.

### 6.7 Data the backend needs now (so later work plugs in)

Current state (read today): `users` has `avatar_media_id`, `banner_media_id`, `bio`, `pronouns`, `accent_color`; `user_settings` has `profile_visibility (public|private)`, `dm_policy`, `friend_request_policy`, `show_presence`, `show_read_receipts`, all with adult defaults; `relationships` (friend, pending_outgoing, pending_incoming, blocked); `follows` (active, pending); `posts.visibility` (public, followers, community); `media` has no `purpose` or alt text.

Phase 1 changes:

1. **`user_settings`**
   - `profile_visibility` becomes `everyone | signed_in | friends` (map `public` to `signed_in`, `private` to `friends`).
   - Add `follow_policy` (`everyone | approve | friends`), `friend_list_visibility` (`friends | only_me`), `discoverable` (bool), `pronouns_visibility` (`everyone | friends`).
   - Defaults are computed from age at sign-up, and a server-side `effectivePrivacy(user, now)` clamps every read. Don't trust stored values alone, because a birthday changes what's allowed.
2. **`profiles` (1:1 with users)**, or columns on `users`: `avatar_alt`, `banner_alt`, `profile_theme` (`mint | orchid | aqua | ember`, text so custom theme IDs fit later), `status_text`, `status_emoji`, `status_expires_at`, `username_changed_at`. Later, `profile_customization` (THEMING.md §4.6) adds background, frame, nameplate, effect and name style alongside these columns, without migrating them.
3. **`username_history`**: `user_id`, `username`, `released_at` (held until), unique on the lower-cased name while held. Powers redirects, "Previously @old" and the hold.
4. **`relationships`**: add `updated_at` and `expires_at` (pending requests), plus a `friend_request_cooldowns` table (`from_id`, `to_id`, `until`) so declines stay silent but repeat requests are throttled.
5. **`friend_invites`**: `code`, `user_id`, `expires_at`, `max_uses`, `uses`, `revoked_at`.
6. **`profile_showcases`** (the THEMING.md table, created now): `id`, `user_id`, `kind`, `position`, `config` jsonb (validated per kind), `visibility` (`public | friends`). Phase 1 kinds are `pinned_post` and `featured_badges`; later kinds (clips, games, artwork, custom text, now playing) are new rows, not new columns. Phase 1's three pins are showcase slots 1 to 3.
7. **`badges` and `user_badges`** (THEMING.md §4.6), created now with a handful of earned platform badges (for example "Early access", "Started a Space"), so the front page's badge row is real. Kind `staff` uses reserved shapes.
8. **`posts.visibility`**: add `friends`. Profile posts default to `friends` for under-18s.
9. **`media.purpose`** (`avatar | banner | post | attachment | ...`): sets processing (crop variants, EXIF strip, scanning). THEMING.md §4.7 already plans this; adding it now saves a backfill.
10. **Reports**: make sure `reports.target_type` includes `profile` (picture, banner, bio or name), as THEMING.md §4.6 notes.
11. **API**: `GET /users/:username` returns the profile plus a `viewer` block, so the client never guesses: `{ relationship, follow, canMessage, canFriend, canFollow, mutualFriends: { count, sample }, visibility: "full" | "limited" | "none" }`. The server decides what a viewer sees, from settings, age, blocks and relationship.
12. **Rendering hooks**: the profile header, peek and showcase components carry `data-part` names and read only semantic tokens; the `⋯` menu, report flow and system notices are `data-trust`. This is the THEMING.md §4.13 checklist applied to profiles.

### 6.8 Fix on the front page

- The holo card says "LV 33". THEMING.md §4.5 says "Levels: not at launch". Replace it with something Realm will really show (for example "since 2026" or "212 clips"), or the front page promises a feature that has been ruled out.
- "Add friend" as Maya's only button matches 6.4. Badges such as "Board MVP" and "212 clips" imply achievement badges; Phase 1 should ship at least one real earned badge, or the front-page labels should change.

## Sources

All checked 2026-10-04 unless a date is given.

**Captures** (`docs/research/phase1-captures/profiles/`, headless Chrome, logged out): bluesky-desktop/mobile, github-desktop/mobile, instagram-desktop/mobile (login wall), lastfm-desktop, letterboxd-desktop (Cloudflare check, not bypassed), spacehey-desktop, spotify-desktop/mobile, steam-gaben-desktop, steam-robinwalker-desktop, steam-pointsshop-desktop, threads-desktop (login wall), tiktok-desktop (CAPTCHA, not bypassed), tumblr-staff-desktop/mobile, twitch-desktop/mobile, x-desktop (HTTP 403); added today: discord-blog-customize-desktop, xbox-friends-followers-desktop. A Steam Points Shop showcases capture only showed a loading spinner and was deleted.

**Products and platforms**
- Discord blog, Ways to customise your Discord experience: https://discord.com/blog/ways-to-customize-your-discord-experience
- Discord help, Custom Profiles (403 to direct fetch; indexed text used): https://support.discord.com/hc/en-us/articles/4403147417623-Custom-Profiles
- Discord help, Per-Server Profiles: https://support.discord.com/hc/en-us/articles/4409388345495-Per-Server-Profiles
- Discord press release, Teen-by-default settings globally (2026-02-09): https://discord.com/press-releases/discord-launches-teen-by-default-settings-globally
- Xbox Wire, New Xbox friends and followers experience (2024-09-11): https://news.xbox.com/en-us/2024/09/11/new-xbox-friends-and-followers-experience/
- Meta, Introducing Instagram Teen Accounts (2024-09-17): https://about.fb.com/news/2024/09/instagram-teen-accounts/
- Instagram, Teen Accounts: https://about.instagram.com/blog/announcements/instagram-teen-accounts
- Instagram Help, name change limits: https://help.instagram.com/2994759677322122/
- Snapchat Parents, Safeguards for teens: https://parents.snapchat.com/safeguards-for-teens
- Snap newsroom, A friends-only way to create and share for under-16s (2026-06-10): https://newsroom.snap.com/friends-only-way-to-create-and-share-for-snapchatters-under-16
- Bluesky, Direct messages (2024-05-22): https://bsky.social/about/blog/05-22-2024-direct-messages
- Bluesky, Age assurance in the UK (2025-07-10): https://bsky.social/about/blog/07-10-2025-age-assurance
- Bluesky, A new form of verification (2025-04-21): https://bsky.social/about/blog/04-21-2025-verification
- TechCrunch, Bluesky launches blue check verification (2025-04-21): https://techcrunch.com/2025/04/21/bluesky-launches-blue-check-verification/
- WhatsApp Help, About last seen and online: https://faq.whatsapp.com/general/chats/about-last-seen-and-online/?lang=en
- WhatsApp Help, Privacy settings: https://faq.whatsapp.com/3307102709559968/?cms_platform=web
- GitHub Docs, Changing your GitHub username: https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-personal-account-settings/changing-your-github-username
- Steam community guide, Showcases, levelling and awards: https://steamcommunity.com/sharedfiles/filedetails/?id=2347274114
- Steam Points Shop, Profile Showcases: https://store.steampowered.com/points/shop/profileshowcases
- Steam Discussions on animated profile performance: https://steamcommunity.com/discussions/forum/0/3155312251415879793/ · https://steamcommunity.com/discussions/forum/1/3278065526393379063/ · https://steamcommunity.com/groups/SteamClientBeta/discussions/3/3496509339517372815/

**Law and regulators**
- ICO Children's code, standard 7 (default settings): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/7-default-settings/
- ICO Children's code, all standards: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/code-standards/
- Ofcom, Illegal content Codes of Practice for user-to-user services: https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/illegal-content-codes-of-practice-for-user-to-user-services-24-feb.pdf?v=391889
- Lewis Silkin, Ofcom publishes final illegal harms codes (2024-12-16): https://www.lewissilkin.com/insights/2024/12/16/ofcom-publishes-final-illegal-harms-codes-102jrep
- Ofcom, Update on tech firms' responses to the call to protect children (2026-05-21): https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/protecting-children/project-mercury/update_tech-firms-responses-to-our-call-for-action-to-protect-children.pdf?v=418243
- Society for Computers & Law, summary of the same: https://www.scl.org/tech-firms-commit-to-stronger-anti-grooming-measures-in-response-to-ofcom-demands/
- European Commission, Guidelines on the protection of minors (2025-07-14): https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors
- Freshfields, DSA decoded #6: https://www.freshfields.com/en/our-thinking/blogs/technology-quotient/dsa-decoded-6-the-european-commission-finalises-guidelines-on-the-protection-of-102kv4s
- W3C, Understanding WCAG 2.2.2 Pause, Stop, Hide: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html

**Realm files read:** PRODUCT.md, DESIGN.md, docs/ROADMAP.md, docs/THEMING.md (§2, §3.5, §4.5 to §4.6), docs/UX-ARCHITECTURE.md, frontend/web/src/features/home/profile/profile-canvas.tsx, backend/db/src/schema/{users,social,media,content,notifications}.ts, shared/contracts/src/{limits.ts,schemas/users.ts}, backend/api/src/modules/auth/reserved.ts (referenced).
