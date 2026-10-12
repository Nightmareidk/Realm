# Phase 1 Messaging: research and recommendations

Status: complete (research). Nothing here is built; section 7.9 lists the owner decisions needed first.
Date: 2026-10-04. Sources checked 2026-10-02 (screen captures from the first run) and 2026-10-04 (this run). Claims marked **[inference]** are my reasoning, not something a source says. Claims marked **[third-party]** come from a guide or forum, not the product's own documentation.

Captures for this report live in `docs/research/phase1-captures/messaging/`. One of them, `steam-chat-page.jpg`, is not useful: `store.steampowered.com/chat/` redirected to the Steam store front page (autumn sale), so it shows no chat UI. The Steam evidence below comes from Steam's own chat update page instead. Real chat screens for Discord, Slack, WhatsApp, Messenger, Instagram and LinkedIn all sit behind sign-in, which this research does not do, so the visual evidence is limited to public views (Telegram's public channel preview, Zulip's spectator mode, WhatsApp Web's landing) and to official help pages.

## Top recommendations (summary)

1. **Layout: "C structure, A frames, B presence".** Messages is an inbox plus conversation (C) on every screen size, the pattern every personal messenger uses. It is dressed in A's look: rounded frames floating on the lit ink ground, which is DESIGN.md's own window frame. B's party ("who's here now") moves to where it is cheap: a Here now row at the top of the inbox, the Here now panel or sheet in Spaces, and an optional "peek" of the other person inside a DM. No floating chat windows in Phase 1: they suit products where chat is secondary (LinkedIn, facebook.com) and don't exist on phones (§6).
2. **Messages holds DMs and group chats only;** Spaces keep their room tabs and Here now panel. One message component is used everywhere, so a group that moves from a group chat into a Space sees the same chat (§6.5).
3. **Bubbles, grouped Telegram's way:** name above the first bubble of a run, avatar beside the last, time inside the last bubble, a new run after 5 minutes. Compact density stays bubbles; flat rows read as Discord and work tools (§1.2, §7.4).
4. **Honest, calm encryption label:** a quiet "Not end-to-end encrypted yet" chip in every DM and group chat header (the subtitle on phones) that opens a three-sentence explainer. Never a lock, never "encrypted" on its own, never a warning colour; Telegram is the cautionary tale. At MLS it becomes "End-to-end encrypted" with a system line marking the switch (§3).
5. **Sending uses a visible outbox:** an instant pending bubble with a clock, "Failed to send · Retry" that never vanishes, and client ids so retries don't duplicate. Read receipts are DMs only, shown as text ("Seen 9:05 PM", "Seen by Noor, Kenji +2"), reciprocal when switched off, and reset by an edit, as WhatsApp does (§1.9, §5.1, §7.4).
6. **Accessibility:** the visible list is not a live region. A separate, throttled `role="log"` announces new incoming messages (a setting, as in Slack); `role="status"` carries connection and send state. Arrow-key navigation with a published shortcut sheet. Focus stays in the composer after sending. The floating composer must never hide the focused message (WCAG 2.2 SC 2.4.11) (§4).
7. **Real-time:** a 2-second grace before any "Reconnecting…" banner, open at the "New messages" line, a "3 new messages ↓" pill when scrolled up, Ctrl/⌘ J to the first unread, a virtualised list with exact scroll anchoring when older messages load (§5).
8. **Owner decisions before building (§7.9):** approve the hybrid from renders; your bubbles neutral or in the action colour; the DM "peek"; the @everyone and mentions-only thresholds; a new danger token.

## 1. How the best chat products design the conversation and inbox (2025–2026)

### 1.1 The inbox (conversation list)

- **Every mainstream personal messenger is an inbox: a list of conversations beside (desktop) or before (phone) the open conversation.** WhatsApp, Messenger, iMessage, Telegram, Instagram and Signal all work this way; Beeper sells the pattern itself as "One inbox for all your chats" (beeper.com, capture `beeper-home.jpg`, checked 2026-10-02).
- **Filters at the top of the list.** WhatsApp added three: All ("the default view"), Unread ("marked by you as unread or haven't been opened yet") and Groups ([WhatsApp blog, 2024-04-16](https://blog.whatsapp.com/find-messages-faster-with-chat-filters), checked 2026-10-02).
- **"Someone needs you" is marked separately from "unread".** WhatsApp shows an "@" next to an unread chat in the list when you were mentioned or someone replied to you ([WhatsApp FAQ, mentions](https://faq.whatsapp.com/521835819370205/?locale=en_US), checked 2026-10-02). This matches Realm's own rule: a neutral dot for new stuff, an accent count for "someone needs *you*" (`docs/UX-ARCHITECTURE.md`).
- **Muting is time-boxed.** WhatsApp offers 8 hours, 1 week or Always; muted chats still receive messages but don't make noise ([WhatsApp FAQ, mute](https://faq.whatsapp.com/694350718331007/?locale=en_US), checked 2026-10-02).
- **Strangers go to a separate place.** iOS 26 screens messages from unknown senders into "a dedicated folder" where they stay silenced until accepted ([Apple Newsroom, iOS 26, 2025-06](https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/), checked 2026-10-02). Realm's equivalent is a Requests filter, driven by the DM policy in Profiles.

### 1.2 Bubbles or flat rows

Two families exist, and they split by purpose, not by era:

| Family | Who | What it looks like | Evidence |
|---|---|---|---|
| **Bubbles** | iMessage, WhatsApp, Telegram, Messenger, Instagram, Signal, Snapchat | Mine on the right, theirs on the left. Telegram puts the time (and, in channels, the view count) inside the bubble's bottom-right corner, and shows the sender's avatar beside the *last* bubble of a run, not every bubble. | `telegram-public-channel-desktop.jpg` and `-phone.jpg` from [t.me/s/telegram](https://t.me/s/telegram), checked 2026-10-02 |
| **Flat rows** | Discord, Slack, Zulip | Everything left-aligned; avatar, name and time on the first message of a run, continuation lines with no header. Zulip right-aligns the time, puts an "EDITED" tag after the name, and groups messages under coloured topic bars. | `zulip-spectator-design.jpg` from [chat.zulip.org](https://chat.zulip.org/#narrow/channel/101-design), checked 2026-10-02 |

Discord offers both a "Cozy" (default, grouped, with avatars) and a "Compact" display (no avatars, one line per message, roughly twice as many messages on screen) **[third-party]** ([Discord community post](https://support.discord.com/hc/en-us/community/posts/360058405071-Discord-Message-Display-Format), checked 2026-10-04).

What this means for Realm: bubbles are the social-app signal and the owner already chose them ("chat as bubbles", PRODUCT.md; "bubble chat (others on the left, you on the right)", UX-ARCHITECTURE.md). Flat rows are the work-tool and Discord signal, which Realm is told to avoid. The real risk with bubbles is busy rooms with many speakers; Telegram's answer (name above the first bubble of a run, avatar beside the last) handles that without falling back to flat rows. A Compact density, already promised in UX-ARCHITECTURE, can tighten spacing and drop avatars but should stay bubbles **[inference]**.

### 1.3 Grouping, timestamps and dividers

- **Runs:** consecutive messages from one person collapse under one name and one avatar (Telegram capture; Zulip capture; Discord Cozy above).
- **Time:** Zulip shows a time on every message, right-aligned (capture). Telegram shows it inside every bubble (capture). Discord's Cozy mode only shows the time on the first message of a group, which users complain hides gaps of up to an hour **[third-party]** (same Discord community post).
- **Day dividers:** Zulip marks "TODAY" on the topic bar (capture); the earlier Realm mocks use a centred "Tonight" / "Today" label (`m1.webp`, `m3.webp`).
- Recommendation **[inference]**: break a run when the author changes, when 5 minutes pass, or at a day boundary; show the time inside the last bubble of each run and on hover/focus for every bubble, so a gap is never invisible.

### 1.4 The "new messages" line and jumping

- Slack draws a red line between read and unread messages when you open a channel ([Mozilla bug 1458665](https://bugzilla.mozilla.org/show_bug.cgi?id=1458665) describes it; [Slack help, send and read messages](https://slack.com/help/articles/201457107-Send-and-read-messages)), and **Ctrl/⌘ J jumps to the first unread message** ([Slack help, screen readers](https://slack.com/help/articles/360000411963-Use-Slack-with-a-screen-reader), checked 2026-10-04).
- Discord puts a "Mark As Read" bar at the top of a channel with many unread messages, and Esc marks the channel read and jumps to the latest message **[third-party]** ([Discord community post](https://support.discord.com/hc/en-us/community/posts/360040853031-Option-to-jump-to-present-when-clicking-on-Mark-As-Read-button-in-chat-channel), checked 2026-10-04). Users there complain that marking read does not also scroll to the present, which is a lesson: one control should do both.

### 1.5 Composer

- **The composer names where you are posting.** Zulip's reads "Message #design > Replace /try-zulip with a modal" (capture); all four earlier Realm mocks use "Message #general" or "Message Late Night Lobby".
- **Mentions:** type "@" and pick from a list; WhatsApp also offers "@all" ([WhatsApp FAQ, mentions](https://faq.whatsapp.com/521835819370205/?locale=en_US), checked 2026-10-02).
- **Expression keeps growing:** iOS 18 added formatting (bold, italic, underline, strikethrough), text effects and scheduled send, and iOS 26 added polls and per-chat backgrounds ([Apple Newsroom, iOS 18, 2024-06](https://www.apple.com/newsroom/2024/06/ios-18-makes-iphone-more-personal-capable-and-intelligent-than-ever/), checked 2026-10-04 via search summary; [iOS 26](https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/), checked 2026-10-02). None of these are in Realm's Phase 1 scope; the composer should leave room for them (a "+" menu) without showing them.

### 1.6 Reactions

- iOS 18 opened Tapbacks to "any emoji or sticker" ([Apple Newsroom, iOS 18](https://www.apple.com/newsroom/2024/06/ios-18-makes-iphone-more-personal-capable-and-intelligent-than-ever/), via search summary 2026-10-04). The direction everywhere is a short quick-pick row plus a full picker.
- The earlier Realm mocks show reactions as pills with counts under the bubble (`m1.webp`, `m2.webp`), which is the Discord/Telegram form and reads well at small sizes.

### 1.7 Edit and delete

| Product | Edit | Delete / unsend | What others see |
|---|---|---|---|
| WhatsApp | Up to 15 minutes; shows "edited", **no edit history** | Delete for me, or delete for everyone; group admins can delete others' messages | "This message was deleted" or an admin variant naming the admin ([FAQ, delete](https://faq.whatsapp.com/171615950782668/?locale=en_US); [blog, edit](https://blog.whatsapp.com/now-you-can-edit-your-whatsapp-messages); both checked 2026-10-02) |
| iMessage | Up to 5 times within 15 minutes; "Edited" label, tap to see earlier versions | Unsend within 2 minutes | Older OS versions get the original plus "Edited to …" follow-ups ([Apple Support](https://support.apple.com/guide/iphone/unsend-or-edit-messages-iphe67195653/ios), checked 2026-10-02) |
| Zulip | An "EDITED" tag after the sender's name | (not observed) | (capture) |

WhatsApp also resets read receipts when a message is edited, "so you can see who viewed your updates" ([FAQ, read receipts](https://faq.whatsapp.com/665923838265756/?locale=en_US), checked 2026-10-02). That is a small, clever detail Realm can copy.

### 1.8 Pins

WhatsApp allows up to four pinned messages per chat, shown as a banner at the top; the banner shows the count and cycles through them; pins expire after 24 hours, 7 days or 30 days; pinning posts a system message naming who pinned; group admins decide whether members may pin ([WhatsApp FAQ, pin](https://faq.whatsapp.com/294619079641794/?locale=en_US), checked 2026-10-02).

### 1.9 Delivery and read states

- WhatsApp: a **clock** means "not yet sent or delivered", one check sent, two grey delivered, two blue read. In groups, the second check appears when everyone has received it, and blue when everyone has read it ([FAQ, read receipts](https://faq.whatsapp.com/665923838265756/?locale=en_US), checked 2026-10-02).
- iMessage: a failed message shows a red exclamation mark and "Not Delivered"; tapping it offers "Try Again" ([Apple Support 118433](https://support.apple.com/en-us/118433), via search summary 2026-10-04).
- Signal: read receipts and typing indicators are each one global switch, and they are reciprocal: turn yours off and you stop seeing other people's **[third-party]** ([How-To Geek, read receipts](https://www.howtogeek.com/708646/how-to-turn-off-read-receipts-in-signal-or-turn-them-on/); [typing](https://www.howtogeek.com/708684/how-to-turn-off-typing-indicators-in-signal-or-turn-them-on/); checked 2026-10-04).

### 1.10 Typing

- WhatsApp shows three dots "in the chat thread", in one-to-one and group chats, but not in channels ([FAQ, typing](https://faq.whatsapp.com/1244276003970936/?locale=en_US), checked 2026-10-02).
- iMessage only gained typing indicators in group chats with iOS 26 ([Apple Newsroom, iOS 26](https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/), checked 2026-10-02). Friend-group chat now expects them in groups too.

### 1.11 Presence

- **Snapchat's presence is playful and specific:** when a friend is viewing your chat, their Bitmoji "peeks" in the bottom corner of the conversation ([Snapchat Support](https://help.snapchat.com/hc/en-us/articles/31119013165332-How-do-I-see-when-a-friend-is-viewing-our-Chat), via search summary 2026-10-04). It is the most "social app, not SaaS" presence signal in the survey.
- **Steam shows presence as activity:** friends in a game are grouped by game, rich presence says "where friends are in a game" and whether they are available for matchmaking, and the list can be "Grouped by party" ([Steam chat update](https://steamcommunity.com/updates/chatupdate), checked 2026-10-04).
- **Discord's "Active Now"** panel beside the friends list shows what friends are playing and for how long **[third-party]** ([Drexel CCI guide](https://support.cci.drexel.edu/getting-connected/discord/discord-friends-list/), checked 2026-10-04 via search summary). Discord's own forum has repeated requests to opt out of it, which is a reminder that presence needs a privacy control ([Discord community post](https://support.discord.com/hc/en-us/community/posts/360057746971-Opt-Out-of-Active-Now-Tab)).

Realm's Profiles phase already plans presence and read-receipt privacy settings (ROADMAP.md, Profiles), and DESIGN.md reserves the Presence green for "someone is here right now" and nothing else.

### 1.12 Link previews and images

- Telegram renders a link preview as a card inside the bubble: a coloured edge, the site name, a large image, a bold title and a two-line description (`telegram-public-channel-desktop.jpg`).
- For E2EE chats, Realm's own design says previews are generated by the sender's client and the server never fetches URLs (`docs/E2EE.md` §6). Phase 1 can fetch previews server-side, but should be built so the fetch can move to the client in Phase 2 **[inference]**.
- Image grids: no source checked; the common rule is one image at its own aspect ratio, two side by side, three or four in a 2×2 grid, five or more as a grid with "+N" on the last tile **[inference]**.

## 2. Group chats for friend groups

- **Size.** Discord caps group DMs at 10 people and points bigger groups to servers ([Discord Support, Group Chat and Calls](https://support.discord.com/hc/en-us/articles/223657667-Group-Chat-and-Calls), via search summary 2026-10-04). Realm's E2EE design caps group DMs at 100 members initially (`docs/E2EE.md` §2). Recommendation **[inference]**: Phase 1 group chats allow up to 100 so nothing breaks when MLS arrives, and creating a group of more than about 25 suggests "make this a Space instead".
- **Names and pictures.** An unnamed group should read as its members ("Kenji, Maya" in `m3.webp`). Apple now lets a group have its own background (iOS 26, as above), so a group has a look as well as a name. Recommendation **[inference]**: default name = first names; default picture = two member avatars overlapped; any member can rename or set a picture, and the change posts a system message ("Noor named the group Ranked night").
- **Members.** WhatsApp shows "groups in common" on a profile and lets admins approve people who join by link (WhatsApp groups blog, 2023-03-21, per first-run notes; capture `t-wa-groups-blog.jpg`). For small friend groups, roles beyond "creator" add little; Realm can keep one rule: anyone can add, only the person who added someone or the creator can remove **[inference]**.
- **@everyone etiquette.** WhatsApp lets any member use "@all" in groups of 32 or fewer, and only admins above that; a mention overrides a member's mute "unless they've also muted @all mentions" ([WhatsApp FAQ, mentions](https://faq.whatsapp.com/521835819370205/?locale=en_US), checked 2026-10-02). Steam group chats support @here and @all ([Steam chat update](https://steamcommunity.com/updates/chatupdate), checked 2026-10-04). Recommendation: copy WhatsApp's threshold idea: in group chats anyone may @everyone; in Spaces it is a permission, off for everyone but mods by default; and muting a conversation offers "also mute @everyone".
- **Notification defaults.** UX-ARCHITECTURE.md already says "all for small Spaces, mentions-only for big ones". A Discord-focused guide recommends "Only @mentions" as the default for large servers **[third-party]** ([discords.ai guide](https://www.discords.ai/wiki/discord-notifications-management), checked 2026-10-04). Recommendation: DMs and group chats notify for every message; Spaces notify for everything under 50 members and for mentions only at 50 or more **[inference: the threshold is a starting guess to tune]**; mute offers 1 hour, 8 hours, 1 week, Always (WhatsApp's set plus 1 hour for a gaming session).
- **Pins in groups** follow WhatsApp: anyone in a group chat, permission-gated in Spaces, with a system message naming who pinned.

## 3. Encryption labelling

### 3.1 How others say it

| Product | What is protected | How they tell you | Evidence |
|---|---|---|---|
| **WhatsApp** | All personal chats, automatically | "All of this happens automatically: no need to turn on any special settings." WhatsApp Web's landing carries a lock and "Your personal messages are end-to-end encrypted". Each 1:1 chat has a 60-digit security code and QR code; change notices are off unless you turn them on per device. | [FAQ, E2EE](https://faq.whatsapp.com/820124435853543); `whatsapp-web-landing.jpg`; [FAQ, security code](https://faq.whatsapp.com/1524220618005378); checked 2026-10-02 |
| **Messenger** | Personal chats, being moved to E2EE by default | "To check if a chat is end-to-end encrypted, look for End-to-end encrypted in the chat settings." Some things are explicitly not covered: business chats, Marketplace chats; per first-run notes, also chat customisations and messages from before a chat was upgraded. | [Messenger Help](https://www.facebook.com/help/messenger-app/786613221989782), `messenger-help-e2ee.jpg`, checked 2026-10-02 |
| **Instagram** | Nothing any more | "End-to-end encrypted messaging on Instagram is no longer supported as of May 8, 2026", with download instructions and a pointer to WhatsApp. | [Instagram Help](https://help.instagram.com/1224884341728748), `instagram-help-e2ee.jpg`, checked 2026-10-02 |
| **Telegram** | Only "secret chats": one-to-one, device-specific, not the default | The FAQ describes cloud chats and secret chats; it says secret chats "use end-to-end encryption", while cloud chat data is protected by keys split across jurisdictions. Matthew Green's critique: E2EE is not the default, takes several taps to reach, and doesn't exist for groups. | [Telegram FAQ](https://telegram.org/faq) (`telegram-faq.jpg`, checked 2026-10-02); [Green, 2024-08-25](https://blog.cryptographyengineering.com/2024/08/25/telegram-is-not-really-an-encrypted-messaging-app/) |
| **Discord** | Audio and video in DMs, group DMs, voice channels (DAVE, built on MLS); **not** text | The 2024 DAVE post says plainly that messages on Discord are not end-to-end encrypted; calls show a voice privacy code; from 2026-03-01 clients without DAVE can't join E2EE calls; stage channels stay transport-encrypted. | [Discord blog, 2024-09-17](https://discord.com/blog/meet-dave-e2ee-for-audio-video); [2025-09-02](https://discord.com/blog/bringing-dave-to-all-discord-platforms); per first-run notes, 2026-10-02 |
| **Apple RCS** | RCS chats with E2EE, in beta | "A new lock icon in their RCS chats", on by default. | [Apple Newsroom, 2026-05](https://www.apple.com/newsroom/2026/05/end-to-end-encrypted-rcs-messaging-begins-rolling-out-today-in-beta/), per first-run notes, 2026-10-02 |
| **Signal** | Everything | No per-chat label, because nothing is unprotected **[inference; not re-checked this run]**. | — |

### 3.2 What the research on labels says

- In-workflow security messages improved people's understanding in a one-off survey (n=461) but showed no significant improvement over a longitudinal study (n=61); salience and repetition matter more than one notice ([Akgul et al., USENIX Security 2021](https://www.usenix.org/conference/usenixsecurity21/presentation/akgul), per first-run notes).
- Matrix replaced crypto jargon with user-tested plain terms ("Confirmed" devices, "Digital identity", "Recovery key", "Identity reset") in MSC4161 ([GitHub, MSC4161](https://github.com/matrix-org/matrix-spec-proposals/pull/4161)), and its "invisible crypto" effort aims to show warnings only when something is actually wrong ([Matrix 2.0 announcement](https://matrix.org/blog/2024/10/29/matrix-2.0-is-here/)); both per first-run notes, 2026-10-02.
- Telegram is the cautionary tale. Its FAQ calls messages "securely encrypted" in general terms while true E2EE is a separate, non-default mode, and the security community calls this misleading (Green, above). **Realm must never use "encrypted" or a lock for Phase 1 DMs**, even though they are encrypted in transit and at rest: that is exactly the confusion Telegram is criticised for.
- Instagram shows that protection can also be withdrawn, and when it is, the honest move is a help page with a date and a way out. Realm's Phase 2 freeze of alpha plaintext DMs (ROADMAP.md) needs the same: a date, what happens, and what to do.

### 3.3 How Realm should say it in Phase 1

The vocabulary is fixed by `docs/E2EE.md` §1: "End-to-end encrypted" and "Encrypted in transit and at rest". The label for DMs and group chats until Phase 2 is **"Not end-to-end encrypted yet"**.

- **Where:** in every DM and group chat header, as a quiet status chip (dark pill, Ink 2 text, no icon, no warning colour). On phones, where the header is tight, it is the subtitle under the conversation name, and presence moves to the avatar's dot.
- **What it opens:** one tap opens a short sheet:
  > **Not end-to-end encrypted yet**
  > Messages here are encrypted between your device and Realm and stored encrypted, but Realm's systems can read them. End-to-end encryption for DMs and group chats is coming before Realm's public launch. When it arrives, we'll tell you in each chat.
  > [Learn more] (links to the privacy page)
- **Once per conversation:** the first time a conversation opens, a centred system line at the top of the history repeats the label with "What this means".
- **Never:** a lock, a shield, the word "secure" on its own, "private" as a security claim, a red or amber warning style, or a modal that blocks sending. The point is honesty without alarm: this is the normal state of most chat apps people already use (Discord text, Instagram DMs since May 2026), and the copy should sound like that.
- **Space rooms** are never E2EE (`docs/E2EE.md` §2). They carry no chip in the room header; the Space's info panel says "Encrypted in transit and at rest. Realm can read room messages for moderation and search." **[inference: wording]**

### 3.4 How it changes when MLS arrives (Phase 2)

- The chip becomes "End-to-end encrypted" with a lock, in the same position, and opens a sheet about devices, safety numbers and Secure Backup.
- Each upgraded conversation gets a system line at the point of change: "Messages after this point are end-to-end encrypted." Messenger's precedent shows that pre-upgrade messages stay unprotected and some actions stop working on them (first-run notes from Messenger Help), so the older part should be visibly separate and read-only, matching ROADMAP.md's "alpha plaintext DMs frozen read-only".
- Identity changes ("Noor's security details changed") appear as system lines, with the louder blocking treatment only for contacts you have verified, as `docs/E2EE.md` §5.3 already specifies.
- Marketing may say "end-to-end encrypted DMs" only from that release (`docs/E2EE.md` §1).

## 4. Accessibility

Target: WCAG 2.2 AA on core flows (ROADMAP.md exit criteria), full keyboard operation, correct live regions (PRODUCT.md).

### 4.1 What the patterns say

- **`role="log"`** is the ARIA role for "chat logs, messaging history". It is implicitly `aria-live="polite"` and `aria-atomic="false"`, so screen readers announce only the additions, when the user is idle. New information "is only added to the end of the log", and the log "is required to have an accessible name" ([MDN, log role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role), checked 2026-10-04).
- **The APG feed pattern** is for content that loads more as you scroll: articles inside `role="feed"`, each with `aria-labelledby`, `aria-posinset` and `aria-setsize` (−1 if unknown), `aria-busy="true"` while loading; Page Down / Page Up move between articles, Ctrl+End / Ctrl+Home leave the feed. The APG warns that because there is little convention, "providing easily discoverable keyboard interface documentation is especially important" ([W3C APG, feed](https://www.w3.org/WAI/ARIA/apg/patterns/feed/), checked 2026-10-04).
- **Slack** (the most documented real chat): opening a channel puts focus in the composer; ↑ enters the message list "on the most recent message"; ↑/↓ move between messages; Tab moves into a message's content; Page Up/Down scroll; Ctrl/⌘ J jumps to the first unread; F6 cycles between labelled regions; announcing incoming messages while in a conversation is **a user preference**, not forced ([Slack help](https://slack.com/help/articles/360000411963-Use-Slack-with-a-screen-reader), checked 2026-10-04).
- **WCAG 2.2, SC 4.1.3 Status Messages** covers results, waiting states, progress and errors "not delivered via a change in context", and lists `role="log"` as a technique for sequential updates ([W3C Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), checked 2026-10-04). Failed sends, "Reconnecting…" and upload progress are status messages.

### 4.2 The tension, and the fix

A `role="log"` on the visible list fails in two ways **[inference]**: loading older messages *prepends*, which a log is not meant to do and which some screen readers will read out as if new; and a busy room floods the user. The robust split:

1. **The visible list** is a labelled region ("Messages in #general"), not a live region. Each message is an `article` (or `listitem`) with `aria-labelledby` pointing at the sender and `aria-describedby` at the time and state, plus `aria-posinset` / `aria-setsize="-1"` while history is incomplete. Set `aria-busy="true"` on it while older messages load.
2. **A separate, visually hidden `role="log"`** announces only *new incoming* messages while the conversation is open, as "Noor: anyone on tonight?". Batch them: if more than three arrive within about 5 seconds, announce "4 new messages from Noor and Kenji" instead **[inference: numbers to tune]**. Never announce your own sends. Follow Slack and make "Announce new messages" a setting (on by default for DMs, off by default in Spaces above the mentions-only threshold **[inference]**).
3. **A `role="status"`** region carries connection and send state ("Reconnecting…", "Message failed to send. Press Enter on it to retry."). Use `role="alert"` only for a send that failed after you've left the composer.
4. **Typing indicators are not announced** by default; they change too often to be useful aloud **[inference]**.

### 4.3 Keyboard map (proposal)

| Where | Key | Does |
|---|---|---|
| Composer | Enter / Shift+Enter | Send / new line |
| Composer (empty) | ↑ | Edit your last message (a Slack and Discord habit **[inference: not re-checked]**) |
| Composer | Esc | Cancel reply or edit; a second Esc marks the conversation read and jumps to the latest (Discord's Esc, but doing both, see §1.4) |
| Composer | Alt+↑ or Shift+Tab | Move into the message list at the newest message (Slack uses ↑; Realm needs ↑ for "edit last") |
| Message list | ↑ / ↓ | Previous / next message (roving tabindex, one tab stop for the whole list) |
| Message list | Page Up / Page Down | Jump a screen; older history loads as needed (APG feed) |
| Message list | Home / End | Oldest loaded / newest |
| Message list | Enter or Shift+F10 | Open the message's actions (react, reply, edit, delete, pin, copy link, report) |
| Message list | R / E | Reply / react to the focused message **[inference: optional shortcuts; must be turn-off-able under WCAG 2.1.4 Character Key Shortcuts]** |
| Anywhere in the conversation | Ctrl/⌘ J | Jump to first unread (Slack's binding; doesn't clash with Travel's ⌘K) |
| Anywhere | F6 | Next region: inbox, conversation, composer, side panel (Slack's model) |

Publish this map in a "Keyboard shortcuts" sheet (Shift+?), as the APG asks.

### 4.4 Focus rules

- After sending, focus **stays in the composer**, cleared. Opening a conversation puts focus in the composer (Slack). Opening a conversation from a notification or "Jump to" puts focus on the target message.
- After deleting a message, focus moves to the next message (or the previous if it was the last), never to the top of the page **[inference]**.
- **WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum)** applies directly: the floating composer, the pinned-message banner, the "Jump to latest" pill and the reconnect banner must never cover the focused message. Scroll the focused message into the visible area above the composer (use `scroll-padding-bottom` equal to the composer height) **[spec requirement; not re-fetched today]**.
- The hover action bar must also appear on keyboard focus and stay while the pointer moves onto it (WCAG 1.4.13 Content on Hover or Focus, 2.1.1 Keyboard) **[spec requirements; not re-fetched today]**.

### 4.5 Names for reactions, receipts and states

| Thing | Accessible name (proposal) |
|---|---|
| Reaction pill | Button, `aria-pressed` true if you reacted: "🔥 fire, 3 reactions, including you" |
| Add reaction | "Add reaction to Noor's message" |
| Delivery state (yours) | Text, not an icon alone: "Sending", "Sent", "Delivered", "Seen 9:41 PM", "Failed to send" |
| Group seen | "Seen by Noor, Kenji and 2 others" (the faces are decorative) |
| Edited | "Edited" inside the message's description |
| Deleted | "Message deleted" (not "This message was deleted by…" unless a moderator did it) |
| Presence dot | Part of the person's name: "Noor, here now"; never colour alone |
| Unread badge | "Late Night Lobby, 3 unread, 1 mention" on the inbox row |
| Privacy chip | A button: "Not end-to-end encrypted yet. What this means" |

Reaction pills and other small controls must meet **SC 2.5.8 Target Size (Minimum)**, 24×24 CSS px, and 44px on touch per UX-ARCHITECTURE.md **[spec; not re-fetched today]**.

### 4.6 Motion

- Typing dots, reaction "pop" and message arrival are motion. Under `prefers-reduced-motion` and Realm's Pause motion switch: typing becomes a static "Noor is typing…" line; reactions and new messages appear with an opacity fade only (UX-ARCHITECTURE.md already says "opacity-only transitions").
- An animated typing indicator that runs for more than 5 seconds next to other content falls under **SC 2.2.2 Pause, Stop, Hide**; the Pause motion switch is the mechanism, so it must stop the dots too **[inference from the SC; not re-fetched today]**.
- No animation on keyboard-driven actions (UX-ARCHITECTURE.md).

## 5. Real-time UX

### 5.1 Sending: optimistic, with a visible outbox

- **Show the message instantly** in a pending state. WhatsApp's clock icon means "not yet sent or delivered… due to connectivity issues" ([FAQ, read receipts](https://faq.whatsapp.com/665923838265756/?locale=en_US), checked 2026-10-02).
- **Don't let a failure make the message vanish.** React's `useOptimistic` shows optimistic state only "while an Action is in progress" and rolls back automatically when it fails ([React docs](https://react.dev/reference/react/useOptimistic), checked 2026-10-04). That is right for a like button and wrong for a chat message someone typed. Keep a client **outbox** (a store keyed by a client-generated id) so a failed message stays in place, marked "Failed to send · Retry", like iMessage's red "Not Delivered" with "Try Again" ([Apple Support 118433](https://support.apple.com/en-us/118433), via search summary 2026-10-04) **[inference: architecture]**.
- **Idempotency:** the client id goes to the server with the send, so a retry after a dropped connection never creates a duplicate; the server's acknowledgement swaps the pending bubble for the real one in place, without re-rendering or moving it **[inference]**.
- **Order:** pending messages stay at the bottom, in the order typed, until acknowledged; messages from others that arrive meanwhile go above them **[inference]**.
- **Attachments** upload before the message is sent, with a progress ring on the thumbnail in the composer tray; the message is sent when uploads finish, and a failed upload keeps the draft **[inference]**.

### 5.2 Connection loss and reconnection

- Wait about 2 seconds before showing anything, so brief blips don't flash a banner **[inference]**.
- Then show a slim, neutral banner under the conversation header: "Reconnecting…" (a `role="status"`). Keep the composer usable; new messages queue in the outbox with the pending state.
- On reconnect: fetch what was missed since the last event id, merge, then show "Back online" for about 2 seconds and remove the banner. If messages arrived while offline, place the "New messages" line above them **[inference]**.
- After about 30 seconds offline, the banner gains "Retry now", and pending messages switch from "Sending" to "Waiting for connection" **[inference]**.

### 5.3 Long histories

- **Start at the bottom; follow new messages only if the reader is at the bottom.** That is the core contract of chat list components such as `@virtuoso.dev/message-list`, which anchors at the last item and offers "automatic scroll on new messages" based on an "atBottom" check ([Virtuoso message list](https://virtuoso.dev/message-list/), checked 2026-10-04; licence terms not checked).
- **Virtualise** once a conversation passes a few hundred rendered messages, so a mid-range phone browser stays smooth (PRODUCT.md principle 4) **[inference]**. Variable heights (images, previews, reactions) are the hard part; reserve image space from stored width and height so rows don't jump when images load.
- **Scroll anchoring:** the CSS `overflow-anchor` property, which keeps the view steady when content is inserted above, reached Baseline in 2026 per MDN ([MDN, overflow-anchor](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor), checked 2026-10-04). Even so, prepending older messages in a bottom-anchored list needs explicit compensation (measure the height added and adjust `scrollTop` in the same frame), which is what chat list libraries do **[inference]**.
- **Loading older messages:** trigger a page before the top is reached; show two or three skeleton bubbles at the top; set `aria-busy` (§4.2); keep the reader's position exactly.
- **Jump to latest:** when scrolled up and new messages arrive, show a pill above the composer, "3 new messages ↓"; pressing it scrolls to the newest and clears the line. When scrolled up with nothing new, show a plain "Jump to latest ↓" **[inference]**.
- **Jump to first unread:** when a conversation opens with unread messages above the fold, open at the "New messages" line, not at the bottom, and offer Ctrl/⌘ J (Slack) to return to it.

### 5.4 Live changes to existing messages

- Edits, deletes, reactions and pins arrive as events and update the message in place without moving the scroll position **[inference]**.
- An edit adds "Edited" and, in DMs, resets the read state (WhatsApp, §1.7).
- A delete for everyone replaces the bubble with a tombstone ("Message deleted"); a moderator removal says "Removed by a moderator" in Spaces (WhatsApp's admin variant, §1.7).

### 5.5 Typing and presence signals

- Send a typing event at most every 3 seconds while keys are pressed; show the indicator until 6 seconds after the last event or until the message arrives **[inference: numbers to tune]**.
- In groups: "Noor is typing…", "Noor and Kenji are typing…", "Several people are typing…" **[inference]**.
- Read state: mark read only when the conversation is visible *and* the window has focus, and the unread line has been on screen **[inference]**.

## 6. Verdict on layouts A, B and C

What the earlier mocks actually show (their look is the discarded world; only the structure matters here):

- **A "Floating"** (`.impeccable/mocks/decision/m1.webp`, title "Messaging A — Floating"): the dock, the conversation and the Here now panel as three separate rounded panels floating on the ground, with bubble chat and the composer as a floating pill. This is UX-ARCHITECTURE.md's Space layout. The brief also describes A as "chat as floating windows over the app", so both readings are judged below.
- **B "Party bar"** (`m2.webp`, "Messaging B — Stage"): a row of people cards across the top of the conversation ("Noor · In a match · 12m", "Kenji · Cutting a clip", "+ Invite"), over room tabs, with a sidebar that lists Spaces and Messages together.
- **C "Inbox"** (`m3.webp`, "Messaging C — Inbox"): a "Chats" column with search, filters (All, Spaces, People, Unread 4), a row of friends' avatars, and a list mixing Spaces and people; the conversation beside it. `m4.webp` is the phone version: list, conversation, and the Here now sheet.

### 6.1 A, floating windows: who does it and how it goes

| Product | What it does | Evidence |
|---|---|---|
| LinkedIn | Conversation windows pop up in the lower-right corner of every page; new conversations auto-open by default, with a setting to auto-minimise instead | [LinkedIn Help a563389](https://www.linkedin.com/help/linkedin/answer/a563389), via search summary 2026-10-04 |
| facebook.com | Chat windows dock along the bottom right; "Close all chats" and "Minimize open chats" collapse them to bubbles | [itgeared guide](https://www.itgeared.com/how-to-minimize-messenger-chat-box/) **[third-party]**; a Neowin piece is titled "Can't close Facebook chat windows in a desktop browser? Here is a simple workaround" ([Neowin](https://www.neowin.net/news/cant-close-facebook-chat-windows-in-a-desktop-browser-here-is-a-simple-workaround/)); both via search 2026-10-04 |
| Messenger | Meta retired the Messenger desktop app on 2025-12-15 and sent people to facebook.com (or messenger.com without a Facebook account) | [TechCrunch, 2025-12-15](https://techcrunch.com/2025/12/15/facebook-messengers-desktop-app-is-no-more/), via search summary 2026-10-04 |
| Steam | Chats dock "side-by-side" inside the expanded friends window, next to the friends list | [Steam chat update](https://steamcommunity.com/updates/chatupdate), checked 2026-10-04 |

**Verdict on floating windows:** they belong to products where chat is *secondary* to a main activity (a LinkedIn feed, a Facebook feed, a game in Steam). In Realm, Messages is one of five destinations and chat is the main activity for the launch audience. Floating windows also have no phone-browser equivalent (most of Realm's quick check-ins), no real URL for each open chat (UX-ARCHITECTURE.md requires real URLs and a working Back), they cover the content they float over, and the facebook.com example shows the clean-up cost users complain about **[inference from the sources above]**. **Not for Phase 1.** A small "quick reply" peek from a notification or from Home is worth reconsidering after Phase 2 **[inference]**.

**Verdict on floating panels** (what `m1` actually draws): this is a *look*, not a structure, and it suits DESIGN.md well: rounded frames with a hairline ring and a long black drop, sitting on the lit ink ground, are exactly DESIGN.md's app window frame. Keep the look; apply it to whichever structure wins.

### 6.2 B, the party bar: who does it

| Product | What it does | Evidence |
|---|---|---|
| Steam | Friends grouped by game and "Grouped by party"; rich presence says where a friend is in a game and whether they're open to matchmaking | [Steam chat update](https://steamcommunity.com/updates/chatupdate), checked 2026-10-04 |
| Discord | An "Active Now" panel beside the friends list shows what friends are playing and for how long | **[third-party]** [Drexel CCI guide](https://support.cci.drexel.edu/getting-connected/discord/discord-friends-list/); users ask to opt out ([Discord community](https://support.discord.com/hc/en-us/community/posts/360057746971-Opt-Out-of-Active-Now-Tab)) |
| Snapchat | A friend's Bitmoji appears in the chat while they are viewing it | [Snapchat Support](https://help.snapchat.com/hc/en-us/articles/31119013165332-How-do-I-see-when-a-friend-is-viewing-our-Chat), via search summary 2026-10-04 |

**Verdict:** presence-as-activity is the most "friend group, not SaaS" idea in the three mocks, and PRODUCT.md already commits to it ("the party lobby ('who's here now') is in"). But as a bar of cards *on top of every conversation* it costs about 90px of height on desktop and far more proportionally on a phone, it is nearly empty in a one-to-one DM (one card), and it doesn't scale past about six people **[inference]**. The `m2` sidebar that mixes Spaces and DMs also fights UX-ARCHITECTURE.md's "every feature has a home". **Keep the party, move it:** in Spaces it is the Here now panel (desktop) or the avatar stack that opens the Here now sheet (phone, as `m4` already shows); in Messages it is a "Here now" row of friends at the top of the inbox; in a DM it is a small playful touch inside the conversation (§7.4, "peek").

### 6.3 C, the inbox: who does it

Every personal messenger surveyed: WhatsApp (with All / Unread / Groups filters), Messenger, iMessage, Telegram, Signal, Instagram, and Beeper, which markets "One inbox for all your chats" (§1.1). On phones it is always list first, then the conversation pushed on top; on desktop, list and conversation side by side. UX-ARCHITECTURE.md already specifies this for Messages ("Messages shows the conversation list in the panel's place on the left of content").

**Verdict:** the right structure for the Messages destination on every screen size. Its weakness is that it is the most familiar and therefore the easiest to make generic; the identity has to come from the look (A's frames on the lit ground), the presence (B's party) and the details (§7), not from an unusual structure.

### 6.4 Decision table

| | Desktop (≥ 1024px) | Phone (< 768px) | Fit with PRODUCT/DESIGN/UX-ARCH |
|---|---|---|---|
| A, floating windows | Works, but competes with content; no URLs | Not possible in a browser | Poor |
| A, floating panels (look) | Strong; matches DESIGN.md frames | Frames go edge to edge; look carries via radii and ring | Strong |
| B, party bar over chat | Costly height; empty in DMs | Too tall; must collapse to a sheet | Idea strong, placement weak |
| C, inbox | Proven, fast, keyboard friendly | The only proven phone pattern | Strong |

### 6.5 Recommendation: the hybrid "C structure, A frames, B presence"

1. **Messages = C.** Inbox column plus conversation on desktop and tablet; list then conversation on phones.
2. **Dressed as A.** Inbox, conversation and the optional info panel are rounded frames floating on the lit ground, with the 0.6rem gaps of `m1`, not edge-to-edge panes with divider lines.
3. **B's party lives where it is cheap.** A "Here now" friends row at the top of the inbox; the Here now panel in Spaces (desktop) and its sheet (phone); a small "peek" of the other person in a DM when they're looking at it.
4. **Messages holds DMs and group chats only.** Spaces keep their own destination (room tabs plus Here now, per UX-ARCHITECTURE.md) and report their unread state on Home and in the Spaces grid. `m3`'s "All / Spaces / People" mix is dropped, because one feature should have one home.
5. **One message component everywhere** (DMs, group chats, Space rooms), so a friend group that moves from a group chat to a Space sees the same chat.

The owner asked to see rendered previews before choosing (PRODUCT.md, Process). This hybrid should be rendered against a pure C and a "B-forward" variant (party row inside the conversation header) in the new world before any build.

## 7. Recommendations: Messages destination and Space channel spec

Everything here uses DESIGN.md's tokens and rules; values in **bold brackets** are new proposals that need the owner's sign-off or a DESIGN.md addition.

### 7.1 Layout

**Desktop (≥ 1024px)**

```
┌────┬──────────────────┬──────────────────────────────────────────┬─────────────┐
│dock│ Messages      ✎  │ (N) Noor        [Not end-to-end encrypted yet] 📌 ⓘ │ info panel  │
│64px│ [Search people ] │     here now                              │ (toggle,    │
│    │ Here now: ◉ ◉ ◉ ◉│ ─ pinned: "ranked at 9" · 1 of 2 ───────  │  300px):    │
│    │ [All][Unread]    │            Today                          │ people,     │
│    │ [Groups][Requests│  Noor                                     │ pins,       │
│    │  ◉ Noor     9:04 │  ( anyone on tonight? )                   │ photos and  │
│    │   see you at 9 ❶ │  ( ranked at 9        ) 9:02              │ files,      │
│    │  ◎ Ranked n 8:51 │  🔥3  😂1                                 │ privacy,    │
│    │   Kenji: in   @  │                    ( same, give me ten )  │ notifications│
│    │  …               │                    Seen 9:05 PM           │             │
│    │                  │  ◉ Noor is typing…                        │             │
│    │                  │  ( + | Message Noor           ☺ | ➤ )     │             │
└────┴──────────────────┴──────────────────────────────────────────┴─────────────┘
```

- Frames: DESIGN.md "app window frame" treatment (Frame Surface, inset hairline ring, Frame drop shadow) on the lit ink ground, 0.6rem apart. Outer radius **[1.2rem, the box radius, rather than the landing's 1.8rem frame radius, so the app reads as tool rather than showcase]**.
- Inbox frame: **[340px wide, 300–380px range]**. Conversation: fills the rest; the message column is **[max 52rem, centred]** so your bubbles and theirs never sit a whole widescreen apart. Info panel: **[300px]**, off by default, toggled by ⓘ; it takes the Here now panel's slot in the shared frame (UX-ARCHITECTURE.md).

**Tablet (768–1023px):** dock plus conversation; the inbox becomes an overlay sheet from the left (opened by the Messages dock item or a back button); the info panel is a sheet from the right.

**Phone (< 768px):** bottom tabs (Home · Spaces · Feed · Messages · You, per UX-ARCHITECTURE.md). Messages shows the inbox full screen; a conversation pushes on top and hides the bottom tabs; the info panel is a full-height sheet. Use `100dvh`, keep the composer above the on-screen keyboard (visual viewport), keep text inputs at 16px or more so iOS doesn't zoom, and respect safe-area insets **[inference: standard mobile-web practice]**.

### 7.2 The inbox

- **Header:** "Messages" in Funnel Display (DESIGN.md's Two Voices Rule allows names and titles in Funnel) **[1.5rem, 800]**; a ghost icon button "New message" (✎). No action-colour fill here: the One Action Rule keeps that for Send.
- **Search:** filters people and group names; full message search is Phase 2 (ROADMAP.md).
- **Here now row:** friends who are here now, as 44px avatars with the Presence dot and first names; tap opens the DM. Hidden when nobody is around; respects each person's presence privacy setting.
- **Filters:** pills **All · Unread · Groups · Requests (n)** (WhatsApp's three plus Requests). Selected = Raised fill, Ink text, inset ring. Not the action colour.
- **Row (comfortable 72px, compact 56px):**
  - Avatar 44px; a group shows two overlapped 32px avatars or its own picture. Presence dot 10px Presence green with a 2px ground-coloured ring, DMs only.
  - Line 1: name (Atkinson bold 1rem, Ink) and time on the right (tag size 0.82rem, Ink 3, tabular figures).
  - Line 2: preview, one line, ellipsis. Groups prefix the sender ("Kenji: in", "You: lol no"). Live states replace the preview: "Noor is typing…", "Draft: …", "Failed to send" **[in the new danger token]**.
  - Trailing badge, following UX-ARCHITECTURE.md's rule (accent only when someone needs *you*): a DM's unread count is an action-colour pill (a DM is always addressed to you); a group's plain unread count is a neutral pill (Raised, Ink 2); an "@" action pill shows when you're mentioned or replied to (WhatsApp's "@" marker). Muted rows show a muted glyph and only a neutral dot, never an action colour, unless you're mentioned.
  - Unread rows: preview in Ink; read rows: preview in Ink 2.
  - Selected row: Raised fill plus inset hairline ring.
- **Row menu** (right-click, ⋯ on hover/focus, long-press): Mark read/unread, Pin to top, Mute (1 hour, 8 hours, 1 week, Always; "also mute @everyone"), Leave group or Close DM, Block, Report.

### 7.3 Conversation header

- Avatar 36px, name in Funnel **[1.25rem, 800]**, and a subtitle in Ink 2 0.82rem: "Here now", "Away since 6 PM", or for groups "5 people · 3 here now".
- **Privacy chip** (DMs and group chats only): DESIGN.md tag style (60% ink-ground pill, Ink 2 text, inset 12% ring), text "Not end-to-end encrypted yet", a button that opens the explainer sheet (§3.3). On phones the chip becomes the subtitle line and presence moves to the avatar's dot.
- Icon buttons (40px ghost): Pins (with count), Info, More (Mute, Leave, Block, Report).
- **Pinned banner** (only when pins exist): 44px, Raised, "📌 Noor: ranked at 9 · 1 of 2"; pressing it jumps to the message and cycles (WhatsApp's model). Group chats: anyone can pin; Spaces: a permission.

### 7.4 Message row anatomy

**Runs and bubbles**
- A run breaks when the author changes, after 5 minutes, or at a day boundary.
- Theirs: left. In group chats and Spaces the sender's name sits above the first bubble (Atkinson bold 0.9rem, Ink 2) and a 28px avatar sits beside the *last* bubble (Telegram's pattern). In one-to-one DMs neither name nor avatar is shown.
- Yours: right, no name, no avatar.
- Bubble: padding **[0.55rem 0.85rem]**; radius 1.2rem (DESIGN.md box) with the joined corners at **[0.4rem]** so a run reads as one shape; max width **[min(36rem, 78%)]** (about 60 characters, DESIGN.md's body measure).
- Text: Atkinson Hyperlegible Next **[1.0625rem / 1.5 comfortable; 1rem / 1.45 compact]**, Ink. Links are underlined.
- Their bubble: Frame Box (#1b1b22) with the 6% inset ring.
- Your bubble: **owner decision, render both**:
  - (a) **[Raised-plus neutral, e.g. #2a2a33 (the Rule tone), Ink text]**. Fully inside DESIGN.md's rules (the Light Is The Colour Rule, the One Action Rule). Quieter.
  - (b) **[Theme action fill with its "on" colour text]**, like iMessage's blue: the strongest "social app" signal and it changes with the profile theme, but it needs a written exception to the One Action Rule and turns busy chats into large fields of mint/orchid/aqua/ember.
  My lean is (a) plus the theme colour appearing in small, meaningful places (send button, your reactions' rings, mentions of you, the focus ring), but (b) should be seen rendered before it is ruled out.
- **Meta:** time inside the last bubble of a run, bottom right, **[0.75rem]** Ink 3, tabular figures; "edited" after the time. On hover or focus, every bubble shows its time.
- **Your delivery state** (under your latest message only): clock glyph plus "Sending…", then "Sent", "Delivered", and in DMs "Seen 9:05 PM"; in group chats "Seen by Noor, Kenji +2" with up to three 16px faces. Receipts are DMs and group DMs only (ROADMAP.md), off-switchable, and reciprocal like WhatsApp and Signal: turning yours off hides others' from you **[proposal; matches both products]**. An edit resets the seen state (WhatsApp).
- **Failed:** under the bubble, "Failed to send · Retry · Delete" in **[a new danger token, solved against the Worst Point Rule]**; the bubble itself keeps full contrast.

**Inside a bubble**
- **Reply quote:** at the top, a 3px Ink 3 bar, the quoted sender in bold 0.82rem and a one-line excerpt in Ink 2. Pressing it jumps to the original and rings it in Ink for 1.5s (no smooth scroll under reduced motion). A deleted original shows "Original message deleted".
- **Mentions:** "@Noor" in bold. A mention of *you* uses the action colour for the text, and the message gets an "@" marker in its row so the inbox and the "New messages" line can count it.
- **Images:** inset 0.35rem inside the bubble with a 0.9rem (card) radius, following DESIGN.md's nested-radius rule. One image keeps its aspect ratio **[within 320×360px desktop, full bubble width on phones]**; two side by side; three or four in a 2×2 grid; five or more in a grid with "+N". Space is reserved from stored dimensions so nothing jumps. Pressing opens a full-screen viewer (a dialog: Esc closes, arrows move, focus returns to the image).
- **Files:** a row with a type glyph, middle-truncated file name, size and a download button.
- **Link preview:** a card under the text (site name in Ink 3, bold title, two-line description in Ink 2, optional 16:9 image), Frame Surface fill, 0.9rem radius. The sender can remove it before sending. Fetched server-side in Phase 1, designed to move to the sender's client in Phase 2 (`docs/E2EE.md` §6).

**Around a bubble**
- **Reactions:** pills under the bubble on its side, **[28px tall]** (above the 24px minimum; 44px hit area on touch), emoji 16px plus count. Pills you've used carry a 1.5px action-colour ring and `aria-pressed="true"`. An "add reaction" pill appears on hover or focus only.
- **Action bar** (hover, focus, long-press): a small Raised pill with the Moment lift shadow at the bubble's top corner: three quick reactions (your most used), React, Reply, More (Edit, Delete, Pin, Copy link, Report; moderators also get "Remove"). On touch, long-press opens a sheet with a quick-reaction row and the same list; swiping a bubble right starts a reply, with the menu as the non-gesture alternative.
- **System lines:** centred, no bubble, Ink 3 0.82rem: "Noor pinned a message · View", "Kenji added Maya", "Noor named the group Ranked night", and the privacy line at the top of every DM's history.
- **Deleted:** an outline-only bubble (12% ring, no fill), Ink 3 "Message deleted"; in Spaces, a moderator's removal reads "Removed by a moderator".
- **Day divider:** a centred DESIGN.md tag pill: "Today", "Yesterday", "Tue 30 Sep".
- **New messages line:** a hairline across the list with a "New messages" tag at its end, in Ink 2 (plain unread is not the accent's job). It stays until you leave the conversation.
- **Typing:** under the last message on the left: a small bubble with three dots (static "…" under reduced motion or Pause motion) and "Noor is typing…" in Ink 3.
- **Peek (playful presence, optional):** in a DM, while the other person has the conversation open and both of you share presence, their 24px avatar sits just above the composer's left edge with a soft "here" label; it slides in over 200ms (fades only under reduced motion). The idea is Snapchat's (§1.11); it is the one place where B's "who's here" lives inside a DM. **[Owner decision; it must obey presence privacy settings.]**

### 7.5 Composer

- A floating pill, as UX-ARCHITECTURE.md says: min height **[52px]**, Frame Box fill with a 10% inset ring, sitting 12px above the frame's bottom edge; the list's bottom padding and `scroll-padding-bottom` equal the composer's height plus 12px so nothing focused hides behind it (WCAG 2.4.11).
- Left: "+" ghost button 40px → Photo, File (Phase 1); room for Poll, Clip and GIF later.
- Middle: an auto-growing textarea, up to 8 lines, then it scrolls; the pill's radius eases from pill to 1.2rem as it grows. Placeholder names the destination: "Message Noor", "Message Ranked night", "Message #general".
- Right: emoji ghost button, and Send: a 40px action-colour circle with the "on" colour arrow, enabled only when there's something to send (disabled = ghost ring, still visible and labelled).
- **Trays above the composer**, same width, one at a time plus attachments:
  - Reply: "Replying to Noor · anyone on tonight? ×".
  - Edit: "Editing message · Esc to cancel"; Enter saves.
  - Attachments: thumbnails with progress rings and remove buttons; paste and drag-and-drop add here (drop zone over the conversation).
  - Mention picker: an ARIA combobox with a listbox of up to 6 people (avatar, name, @username, presence); "@everyone · notifies 5 people" is the last row in group chats, and in Spaces only for people with the permission.
- Drafts persist per conversation and appear as "Draft: …" in the inbox.
- **[Character limit 4,000, with a counter from 3,600]** (number to confirm with the API).
- Keys as in §4.3.

### 7.6 States checklist

| State | What shows |
|---|---|
| First run, no conversations | Teaching empty state: "Message a friend" with New message; with no friends yet, "Add friends to message them" and a link to find people (UX-ARCHITECTURE.md: teaching empty states, not tours) |
| Desktop, nothing selected | The conversation frame shows "Pick a chat, or start one" and the Here now friends |
| New message | A people picker with chips; one person makes a DM, two or more a group with an optional name; groups over **[25]** suggest "Make this a Space" |
| New, empty conversation | Large avatar(s) and name, the privacy line, and a one-tap "Say hi 👋" |
| Loading history | 3–4 skeleton bubbles on alternating sides; no shimmer under reduced motion |
| History failed to load | "Couldn't load messages." plus Retry |
| Reconnecting | Slim neutral banner after 2s; outbox keeps sending state (§5.2) |
| Sending / failed | §7.4 |
| Message request | "Noor wants to message you" with Accept, Delete, Block; no read receipts are sent until accepted **[inference]** |
| Can't message (DM policy) | Composer replaced: "Noor only gets messages from friends" plus Add friend |
| Blocked | Composer replaced: "You blocked Noor" plus Unblock |
| Left a group | Composer replaced: "You left this group" |
| Deleted account | Name "Deleted account", no presence, no composer |
| Space read-only room | Composer replaced: "Only moderators can post in #announcements" |
| Timed out in a Space | Composer replaced: "You can post again in 10 min" |

### 7.7 Space channel view

The structure is UX-ARCHITECTURE.md's, unchanged; only the chat inside it is new.

- **Desktop:** dock | Space header (badge, name ▾ for the switcher, "4 here now" with an avatar stack, Travel, Invite) | room tabs (pills; a neutral dot for unread, an action count for mentions; `⋯ All rooms` for the rest) | the conversation (the same message component as DMs) | the Here now panel (280px: presence as activity, "Noor · In a match · 12m", with Message buttons; thread replies and profile peeks open in the same slot).
- **Room bar** under the tabs (or in the room's info): topic in Ink 2, Pins, notification bell (All / Mentions / Nothing, plus mute durations), members.
- **Differences from DMs:** no privacy chip (rooms are never E2EE; the Space info says "Encrypted in transit and at rest"); no read receipts; sender names on every run and avatars on the last bubble of each run; @everyone is a permission; moderators get Remove (tombstone "Removed by a moderator"); slow mode arrives in Phase 2.
- **Empty room:** "Nothing here yet. Start #general off." plus the room topic. Avoid Discord's "This is the start of the #channel" wording.
- **Phone:** Space header with the avatar stack (opens the Here now sheet, as `m4.webp` shows), horizontally scrolling room tabs, then the conversation and composer.

### 7.8 Motion

- Incoming message: **[160ms opacity plus a 6px rise, ease-out]**; under reduced motion or Pause motion, opacity only.
- Your own send: appears at once, no animation (UX-ARCHITECTURE.md: no animation on keyboard-driven actions).
- Reaction added: **[150ms scale from 0.9 to 1]**; static under reduced motion.
- Typing dots: **[1.2s loop]**, stopped by Pause motion (WCAG 2.2.2).
- Jump-to highlight: an Ink ring fading out over 1.5s.
- Theme changes cross-fade the action colour in chat with the rest of the world (DESIGN.md, 0.8s).

### 7.9 Decisions for the owner, before any build

1. Approve the hybrid layout (C structure, A frames, B presence) after seeing it rendered next to a pure C and a B-forward variant.
2. Your bubbles: neutral (a) or action-colour (b), rendered in all four themes.
3. The DM "peek": in or out.
4. Thresholds: @everyone for anyone in group chats; Spaces switch to mentions-only at **[50]** members; "Make this a Space" suggestion at **[25]**.
5. A danger token for failed sends and destructive actions, solved against the Worst Point Rule (DESIGN.md has none yet).

## Sources

"Checked" means opened directly (page text or screen capture). "Search summary" means the claim came from a web search result's summary of that page, not from opening it; treat those as slightly weaker. Captures are in `docs/research/phase1-captures/messaging/`.

**Opened directly, 2026-10-02 (first run, with captures)**
- Telegram public channel preview: https://t.me/s/telegram (`telegram-public-channel-desktop.jpg`, `-phone.jpg`)
- Zulip spectator view: https://chat.zulip.org/#narrow/channel/101-design (`zulip-spectator-design.jpg`)
- WhatsApp Web landing: https://web.whatsapp.com/ (`whatsapp-web-landing.jpg`)
- Beeper: https://www.beeper.com/ (`beeper-home.jpg`)
- Steam chat page: https://store.steampowered.com/chat/ (`steam-chat-page.jpg`; redirected to the store, not used)
- Messenger Help, E2EE: https://www.facebook.com/help/messenger-app/786613221989782 (`messenger-help-e2ee.jpg`)
- Instagram Help, E2EE: https://help.instagram.com/1224884341728748 (`instagram-help-e2ee.jpg`)
- Telegram FAQ: https://telegram.org/faq (`telegram-faq.jpg`)
- WhatsApp FAQ, E2EE: https://faq.whatsapp.com/820124435853543 (`whatsapp-faq-e2ee.jpg`)
- WhatsApp FAQ, delete: https://faq.whatsapp.com/171615950782668/?locale=en_US (`t-wa-delete.jpg`)
- WhatsApp FAQ, read receipts: https://faq.whatsapp.com/665923838265756/?locale=en_US (`t-wa-receipts.jpg`)
- WhatsApp FAQ, mentions: https://faq.whatsapp.com/521835819370205/?locale=en_US (`t-wa-mention.jpg`)
- WhatsApp FAQ, mute: https://faq.whatsapp.com/694350718331007/?locale=en_US (`t-wa-mute.jpg`)
- WhatsApp FAQ, pin a message: https://faq.whatsapp.com/294619079641794/?locale=en_US (`t-wa-pin.jpg`)
- WhatsApp FAQ, typing: https://faq.whatsapp.com/1244276003970936/?locale=en_US (`t-wa-typing.jpg`)
- WhatsApp FAQ, security code: https://faq.whatsapp.com/1524220618005378 (`t-wa-seccode.jpg`)
- WhatsApp blog, edit: https://blog.whatsapp.com/now-you-can-edit-your-whatsapp-messages (`t-wa-edit-blog.jpg`)
- WhatsApp blog, chat filters (2024-04-16): https://blog.whatsapp.com/find-messages-faster-with-chat-filters (`t-wa-filters-blog.jpg`)
- WhatsApp blog, groups (2023-03-21): https://blog.whatsapp.com/getting-more-out-of-groups-on-whatsapp (`t-wa-groups-blog.jpg`)
- Apple Support, unsend or edit: https://support.apple.com/guide/iphone/unsend-or-edit-messages-iphe67195653/ios (`t-apple-edit.jpg`)
- Apple Newsroom, iOS 26 (2025-06): https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/ (`t-apple-ios26.jpg`)

**From first-run notes, 2026-10-02 (opened then, not captured)**
- Apple Newsroom, E2EE RCS beta (2026-05): https://www.apple.com/newsroom/2026/05/end-to-end-encrypted-rcs-messaging-begins-rolling-out-today-in-beta/
- Discord blog, DAVE (2024-09-17): https://discord.com/blog/meet-dave-e2ee-for-audio-video
- Discord blog, DAVE on all platforms (2025-09-02): https://discord.com/blog/bringing-dave-to-all-discord-platforms
- Matthew Green, Telegram (2024-08-25): https://blog.cryptographyengineering.com/2024/08/25/telegram-is-not-really-an-encrypted-messaging-app/
- Akgul et al., USENIX Security 2021: https://www.usenix.org/conference/usenixsecurity21/presentation/akgul
- Matrix MSC4161: https://github.com/matrix-org/matrix-spec-proposals/pull/4161
- Matrix 2.0 announcement (2024-10-29): https://matrix.org/blog/2024/10/29/matrix-2.0-is-here/

**Opened directly, 2026-10-04**
- W3C APG, feed pattern: https://www.w3.org/WAI/ARIA/apg/patterns/feed/
- MDN, ARIA log role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role
- W3C, Understanding SC 4.1.3 Status Messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- Slack Help, screen readers: https://slack.com/help/articles/360000411963-Use-Slack-with-a-screen-reader
- Steam chat update: https://steamcommunity.com/updates/chatupdate
- MDN, overflow-anchor: https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor
- React, useOptimistic: https://react.dev/reference/react/useOptimistic
- Virtuoso message list: https://virtuoso.dev/message-list/

**Search summaries, 2026-10-04**
- Apple Newsroom, iOS 18 (2024-06): https://www.apple.com/newsroom/2024/06/ios-18-makes-iphone-more-personal-capable-and-intelligent-than-ever/
- Apple Support, can't send or receive messages: https://support.apple.com/en-us/118433
- Slack Help, send and read messages: https://slack.com/help/articles/201457107-Send-and-read-messages
- Mozilla bug 1458665 (Slack's unread line): https://bugzilla.mozilla.org/show_bug.cgi?id=1458665
- Discord Support, Group Chat and Calls: https://support.discord.com/hc/en-us/articles/223657667-Group-Chat-and-Calls
- Discord community posts: https://support.discord.com/hc/en-us/community/posts/360040853031 , https://support.discord.com/hc/en-us/community/posts/360058405071 , https://support.discord.com/hc/en-us/community/posts/360057746971
- Drexel CCI, Discord friends list: https://support.cci.drexel.edu/getting-connected/discord/discord-friends-list/
- discords.ai notifications guide: https://www.discords.ai/wiki/discord-notifications-management
- Snapchat Support, friend viewing chat: https://help.snapchat.com/hc/en-us/articles/31119013165332-How-do-I-see-when-a-friend-is-viewing-our-Chat
- How-To Geek, Signal read receipts: https://www.howtogeek.com/708646/how-to-turn-off-read-receipts-in-signal-or-turn-them-on/ ; typing: https://www.howtogeek.com/708684/how-to-turn-off-typing-indicators-in-signal-or-turn-them-on/
- LinkedIn Help, conversation windows: https://www.linkedin.com/help/linkedin/answer/a563389
- itgeared, minimise Messenger chat boxes: https://www.itgeared.com/how-to-minimize-messenger-chat-box/
- Neowin, closing Facebook chat windows: https://www.neowin.net/news/cant-close-facebook-chat-windows-in-a-desktop-browser-here-is-a-simple-workaround/
- TechCrunch, Messenger desktop app retired (2025-12-15): https://techcrunch.com/2025/12/15/facebook-messengers-desktop-app-is-no-more/

**Cited from the WCAG 2.2 Recommendation without re-opening it today:** SC 1.4.13, 2.1.1, 2.1.4, 2.2.2, 2.4.11, 2.5.8 (https://www.w3.org/TR/WCAG22/).

**Realm documents read:** PRODUCT.md, DESIGN.md, docs/ROADMAP.md, docs/UX-ARCHITECTURE.md (its visual-style section still describes the old world; its structure is current), docs/E2EE.md, and the mocks `.impeccable/mocks/decision/m1–m4` (src and webp).
