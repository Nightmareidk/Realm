# Messaging apps survey: looks, features and the shared baseline (2025–2026)

Status: research complete. Nothing here is built.
Date: 2026-10-10. Sources checked 2026-10-10 unless a line says otherwise.

This report extends `2026-10-phase1-messaging.md` (2026-10-04). That document already covers the inbox and filters, bubbles versus flat rows, grouping and timestamps, the new-messages line, the composer, reactions, edit and delete, pins, delivery and read states, typing, presence, link previews, group chats, encryption labelling, accessibility and real-time behaviour. None of that is repeated here. Where a fact found today changes something in that document, §8 says so.

**How to read this report**

- Official pages I opened directly carry no tag.
- **[search summary]**: the claim comes from a search engine's summary of an official page, not from opening it. Treat these as slightly weaker.
- **[third-party]**: the claim comes from a news site, blog, forum or guide, not the product's own pages.
- **[inference]**: my own reasoning, not something a source says.
- In the feature matrix (§3), **‡** marks a cell that rests on a third-party source, **†** marks a cell from general product knowledge that I could not re-check this run, and **?** means I could not establish it.

**Limits of the evidence.** Every app's real chat screens sit behind sign-in, and this research does not sign in. So the visual descriptions come from official announcements, help-centre instructions and press coverage of rollouts, not first-hand screenshots. Some 2025–26 visual changes (WhatsApp's and Instagram's adoption of Liquid Glass) were never announced on an official blog; they are known only from beta trackers and press. Two official sites refused automated reading today (discord.com returned a certificate error; support.signal.org returned 403), so their claims come from search summaries.

---

## Summary

1. **The look of 2025–26 is "glass and personal".** Apple's Liquid Glass in iOS 26 made floating, translucent tab bars and composers the norm, and Telegram (October 2025), WhatsApp (staged from October 2025 to about September 2026), Instagram and Slack followed on iOS. At the same time almost every app made the chat itself personal: WhatsApp chat themes (February 2025), iMessage conversation backgrounds (iOS 26), Telegram's animated and gift wallpapers, and Meta AI-generated themes.
2. **There are two models for chat looks.** WhatsApp and Signal keep a chat's colours and wallpaper private to you. iMessage shares one background with everyone in the conversation, and anyone can change it. Realm can offer both (§7, R1).
3. **Friend-group planning tools became standard.** Polls arrived in iMessage (iOS 26) and Signal (November 2025) and grew in Telegram (2026). WhatsApp added events with "maybe" replies and a live online count in group headers. WhatsApp, Telegram and Signal all added per-group member tags or labels in early 2026.
4. **Reacting got cheaper.** WhatsApp added double-tap to react (January 2025) and tap-to-join reactions (April 2025). KakaoTalk went from 6 reaction types to 114 (May 2026), LINE opened reactions to all owned LINE emoji (May 2025), and Snapchat says reaction use grew 44% in 2025.
5. **Numbers converged.** Pinned messages settled on three per chat (Instagram, Signal, WhatsApp, with WhatsApp testing a fourth). Edit windows settled on 15 minutes (WhatsApp, iMessage, Instagram, Messenger, and LINE's 2026 trial).
6. **Translation and transcription went on-device** (WhatsApp, September 2025; iOS 26 Live Translation).
7. **Noise control replaced "mute everything".** WhatsApp's "Highlights" notification mode, Beeper's Low Priority, iMessage's unknown-sender screening and Instagram's text-only message requests all let people stay in a chat without being pinged by all of it.
8. **Redesigns can backfire.** KakaoTalk's September 2025 overhaul turned the Friends list into an Instagram-style feed; ratings fell and Kakao promised a rollback within a week. Discord's 2025 refresh drew complaints that DMs were buried under shortcuts.

The recommendations for Realm are in §7: shared chat backdrops with a private override; reactions one gesture away; "plan it" cards (polls and a ready check); status notes on the Here now row; per-group member tags; three notification levels; a "glass-lite" look with a Reduce effects switch; and the converged numbers.

---

## 1. What changed in 2025–2026, across all apps

| Shift | Evidence |
|---|---|
| Floating, translucent chrome | iOS 26 introduced Liquid Glass, a translucent material that "reflects and refracts" what is behind it; tab bars float above content and shrink while you scroll ([Apple Newsroom, 2025-06-09](https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/)). Telegram's iOS bars, keyboard and sticker panel went semi-transparent on 2025-10-10 ([Telegram blog](https://telegram.org/blog/comments-in-video-chats-threads-for-bots)). WhatsApp, Instagram and Slack followed on iOS (§2) **[third-party]**. |
| Personal chat looks | WhatsApp chat themes ([2025-02-13](https://blog.whatsapp.com/chat-themes-to-reflect-your-style)) and Meta AI themes ([About Meta, 2025-09-29](https://about.fb.com/news/2025/09/live-motion-photos-meta-ai-chat-themes-video-call-backgrounds-more-whatsapp/)); iMessage conversation backgrounds ([Apple Support](https://support.apple.com/guide/iphone/add-backgrounds-iph605fa06e4/ios) **[search summary]**); Telegram gift wallpapers (August 2025) **[third-party]**. |
| Planning inside chat | Polls in iMessage (iOS 26), Signal ([2025-11-19](https://signal.org/blog/polls/) **[search summary]**), Telegram "Mighty Polls" (2026); WhatsApp events with "maybe" and pinning ([2025-04-09](https://blog.whatsapp.com/new-feature-roundup-updates-to-group-chats-events-calls-channels-and-more)); Telegram checklists ([2025-07-01](https://telegram.org/blog/checklists-suggested-posts) **[search summary]**). |
| Group identity | Member tags on WhatsApp (January 2026) **[third-party]**, Telegram (March 2026, per the [blog index](https://telegram.org/blog)) and Signal member labels ([2026-03-19](https://signal.org/blog/)). |
| Cheaper reactions | WhatsApp double-tap ([2025-01-14](https://blog.whatsapp.com/new-year-new-ways-to-chat-on-whatsapp)) and tappable reactions (2025-04-09, above); Kakao 6 → 114 types; LINE expanded set; Snapchat reactions +44% ([Snap recap, 2025-12-15](https://newsroom.snap.com/snapchat-recap-2025)). |
| Late arrivals of basics | Snapchat edit (5 min), KakaoTalk edit (24 h, September 2025), LINE edit trial (15 min, 2026), Signal pins (January 2026). |
| On-device language tools | WhatsApp translation ([2025-09-23](https://blog.whatsapp.com/introducing-message-translations)); iOS 26 Live Translation (Apple Newsroom, above). |
| Triage instead of mute | WhatsApp "Notify for: Highlights / All" (2025-04-09, above); iMessage Unknown Senders ([Apple Support](https://support.apple.com/en-us/125068) **[search summary]**); Beeper Low Priority ([Beeper Help](https://help.beeper.com/en_US/ios/beeper-ios-managing-your-inbox)). |

---

## 2. Visual design, app by app

Each entry lists what the sources show about the chat list, the conversation and bubbles, colour and themes, backgrounds, the header, the composer and attach menu, the pickers, the reaction UI, motion, and 2025–26 changes. Details nobody documents publicly are marked "not verified this run".

### 2.1 WhatsApp

- **Overall look (2024 refresh, still current).** WhatsApp announced a "fresh new look" on 2024-05-09. Green is now kept for accents (text highlights, notifications, badges, icons), with more neutral surfaces, a darker, higher-contrast dark mode, rounder outlined icons, more playful animated illustrations and a refreshed default doodle wallpaper. On Android the tab bar moved to the bottom; iOS got a new attachment menu **[third-party]** ([TechRadar](https://www.techradar.com/phones/whats-happened-to-whatsapp-a-big-redesign-is-rolling-out-now-heres-whats-new); [Tom's Guide](https://www.tomsguide.com/computing/instant-messengers/whatsapp-drops-surprise-design-update-its-rounder-and-darker-now)).
- **Chat list.** A filter bar (All, Unread, Favorites, Groups) that became user-made **Lists**, created from a "+" at the end of the filter bar ([WhatsApp blog, 2024-10-31](https://blog.whatsapp.com/focus-on-what-matters-with-custom-lists) **[search summary]**). Searching for a contact also shows the groups you share with them ([About Meta, 2025-09-29](https://about.fb.com/news/2025/09/live-motion-photos-meta-ai-chat-themes-video-call-backgrounds-more-whatsapp/)).
- **Themes and wallpapers.** Preset themes change bubble colour and background together, or you can mix your own; 30 new wallpapers; your own photo still works; set a default or a per-chat theme; "only visible to you" ([WhatsApp blog, 2025-02-13](https://blog.whatsapp.com/chat-themes-to-reflect-your-style)). Press reports count 22 presets **[third-party]** ([Gulf News](https://gulfnews.com/technology/media/whatsapp-rolls-out-chat-themes-feature-what-it-is-how-to-use-it-and-more-1.500037150)). Meta AI can now generate a chat theme (2025-09-29, above).
- **Header.** Group chats show a live count of members online just below the group name ([2025-04-09](https://blog.whatsapp.com/new-feature-roundup-updates-to-group-chats-events-calls-channels-and-more)). On iOS, voice and video call buttons merged into one (January 2026) **[third-party]** ([says.com](https://says.com/my/tech/whatsapp-new-group-chat-features-member-tags-2026)).
- **Composer and attach.** The attach tray holds document scanning (iPhone April 2025, Android September 2025), polls and events. The camera inside chat got the 30 call backgrounds, filters and effects; you can turn a selfie into a sticker and share sticker packs ([2025-01-14](https://blog.whatsapp.com/new-year-new-ways-to-chat-on-whatsapp)). Several photos can share one caption, and people can react or reply to the whole set or to one item ([2025-06-12](https://blog.whatsapp.com/new-feature-roundup-updates-to-stickers-calls-channels-status-and-more)).
- **Reactions.** Long-press shows six quick emoji (👍 ❤️ 😂 😮 😢 🙏) and a "+" for any emoji; on desktop, hovering shows a small smiley button; one reaction per person per message **[third-party]** ([Android Police](https://www.androidpolice.com/how-to-use-whatsapp-message-reactions/)). Since January 2025 you can **double-tap a message to react**, then scroll through your most-used reactions (2025-01-14, above). Since April 2025 you can view everyone's reactions and **tap one to send the same** (2025-04-09, above).
- **Motion.** Emoji animate when sent (2025-06-12, above); illustrations animate (2024 refresh).
- **Liquid Glass (iOS, no official post).** A small test began in October 2025 on the tab bar and parts of the Chats tab; a broader stage in May 2026 added the top bar and some in-chat elements; around September 2026 the full chat screen (chat bar, navigation bar, message menu, bubbles) began rolling out. The tab bar and input bar float with a frosted, translucent background **[third-party]** ([9to5Mac, 2026-05-15](https://9to5mac.com/2026/05/15/whatsapp-finally-starts-rolling-out-liquid-glass-more-broadly-on-ios/); [WABetaInfo](https://wabetainfo.com/whatsapp-is-widely-rolling-out-the-full-liquid-glass-experience/); [Ubergizmo, 2026-09](https://www.ubergizmo.com/2026/09/whatsapp-for-ios-gets-full-liquid-glass-redesign/)).
- **Other 2025–26.** Translation (§2 summary, 2025-09-23). Username reservations opened in June 2026 (3–35 characters, an optional "username key" a stranger must know before messaging you) **[third-party]** ([BleepingComputer](https://bleepingcomputer.com/news/security/whatsapp-rolls-out-usernames-to-help-users-hide-their-phone-number)). WhatsApp Web gained calls with screen sharing and a waiting room for group call links ([About Meta, 2026-07-28](https://about.fb.com/news/2026/07/whatsapp-web-calling-new-features/)).

### 2.2 Telegram

- **Chat list.** Folders show as tabs; free users can pin 5 chats in the main list (10 with Premium) and create 10 folders (20 with Premium) **[third-party]** ([tginfo](https://tginfo.me/telegram-premium-en/)). The chat list shows an unread counter with a separate **blue mention indicator** beside it; inside the chat an **@ button** steps back through unread mentions one tap at a time, and a long-press on it marks them all read ([Telegram API docs, mentions](https://core.telegram.org/api/mentions) **[search summary]**). A similar button jumps to unread reactions ([bug tracker](https://bugs.telegram.org/c/14245) **[third-party]**).
- **Bubbles and colour.** Rounded bubbles with the time inside (Phase 1 doc §1.2). Premium users choose a **name colour** (a colour or combination) and an icon **pattern**; these appear on their name in groups, on links they send, and as the background when others reply to or quote them ([Telegram blog, 2023-10-28](https://telegram.org/blog/reply-revolution)). Some collectible gifts unlock unique reply styles ([2025-10-10](https://telegram.org/blog/comments-in-video-chats-threads-for-bots)).
- **Backgrounds.** Animated multicolour gradient wallpapers that shift each time you send a message; choose 3 or 4 colours plus an optional pattern; on iOS the background shows through the header and footer ([Telegram blog, Animated Backgrounds](https://telegram.org/blog/animated-backgrounds) **[search summary]**). Owners of certain collectible gifts get wallpapers built from the gift's model and backdrop (August 2025) **[third-party]** ([Releasebot](https://releasebot.io/updates/telegram)).
- **Glass.** On 2025-10-10 the iOS navigation bar, keyboard and sticker panel became semi-transparent with a refraction effect as you scroll (blog, above). On 2026-01-03 Telegram said iOS "fully supports" Liquid Glass and added a way to reduce interface effects in Settings › Power Saving for speed and battery ([Telegram blog](https://telegram.org/blog/new-design-ai-summaries)). Android got its own redesign with a new bottom bar on 2026-02-09 ([Telegram blog](https://telegram.org/blog/crafting-android-design-and-more) **[search summary]**).
- **Composer and pickers.** AI-powered sticker search (February 2025) and emoji and sticker search over 100 million items (May 2026), per the [blog index](https://telegram.org/blog). The GIF panel searches more than 350 million GIFs privately, and a rich text editor adds tables, lists and headings, with a 32,000-character limit ([2026-07-14](https://telegram.org/blog/communities-editor-invisible-messages) **[search summary]**).
- **Reactions.** Double-tap sends your quick reaction (👍 by default, changeable in settings); in groups and channels, admins decide which reactions are allowed **[third-party]** ([GSMArena](https://m.gsmarena.com/telegram_adds_reactions_spoilers_and_message_translation-news-52496.php)). Users repeatedly ask for a way to switch double-tap off because it fires by accident, especially for left-handed and disabled users **[third-party]** ([bug tracker](https://bugs.telegram.org/c/12966)).
- **Replies.** You can quote just part of a message, and tapping the quote animates to the exact spot; you can also reply in a different chat ([2023-10-28](https://telegram.org/blog/reply-revolution)).
- **Empty chat.** A greeting sticker suggestion (added January 2021) appears in a chat with no messages; one tap sends it **[third-party]** ([bug tracker](https://bugs.telegram.org/c/1569)).
- **Other 2025–26.** Checklists (July 2025), repeated messages (November 2025), member tags (March 2026), polls with media, revoting and durations (March 2026), communities that bundle several chats into one list entry (July 2026), per the blog index and posts above. Telegram says it shipped over 75 features in 13 updates in 2025 (2026-01-03 post).

### 2.3 iMessage (iOS 26, now iOS 27)

- **Overall look.** Liquid Glass throughout; controls and tab bars float above content ([Apple Newsroom, 2025-06-09](https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/)). Early users noted thicker list rows and search moved to the bottom **[third-party]** ([Michael Tsai](https://mjtsai.com/blog/2025/06/10/ios-26-announced)).
- **Chat list.** Up to **9 pinned conversations**, shown as larger icons at the top ([Apple Support 104982](https://support.apple.com/en-us/104982) **[search summary]**). A **Filters** button switches views and holds **Unknown Senders**; muted chats show a Hide Alerts icon on their row ([Apple Support 108127](https://support.apple.com/en-us/108127) **[search summary]**).
- **Backgrounds.** Open the contact or group icon › Backgrounds: built-in Color, Sky, Water or Aurora, a photo, or an Image Playground creation. Everyone in the conversation sees the background and **anyone can change it**; removing it removes it for all; switching the feature off in Settings only hides backgrounds for you ([Apple Support](https://support.apple.com/guide/iphone/add-backgrounds-iph605fa06e4/ios) **[search summary]**).
- **Bubbles.** Blue for iMessage, green for SMS/RCS, grey for incoming † (not verified this run).
- **Composer.** The apps button holds Send Later; a **scheduled message shows a dashed outline** with its send time above it, up to 14 days ahead ([Apple Support](https://support.apple.com/guide/iphone/schedule-text-messages-to-send-later-iph5ae9a7be6/ios) **[search summary]**). iOS 27 lets you choose what the button at the right of the field does: record audio, dictation or nothing **[third-party]** ([9to5Mac, 2026-09-17](https://9to5mac.com/2026/07/23/heres-everything-new-for-messages-in-ios-27/)).
- **Reactions.** Touch and hold for Tapbacks: heart, thumbs up, thumbs down, ha ha, !!, ?, plus any emoji, sticker or Memoji since iOS 18 ([Apple Support, Mac guide](https://support.apple.com/en-euro/guide/messages/react-with-tapbacks-icht504f698a/14.0/mac/15.0) **[search summary]**). Swipe a bubble right to reply ([Apple Support](https://support.apple.com/guide/iphone/send-and-reply-to-messages-iph82fb73ba3/ios) **[search summary]**).
- **Motion.** Eight animated text effects since iOS 18 (Big, Small, Shake, Nod, Explode, Ripple, Bloom, Jitter), applied to a word or a whole message **[third-party]** ([MacRumors](https://macrumors.com/how-to/use-new-text-effects-messages)).
- **Groups (iOS 26).** Typing indicators, polls (Apple Intelligence can suggest one), Apple Cash in groups (U.S.) (Newsroom, above).
- **iOS 27** (public release 2026-09-14 **[third-party]**, [ETV Bharat](https://www.etvbharat.com/en/technology/apple-confirms-ios-27-release-date-heres-when-it-lands-on-your-iphone-enn26091003097)): failed messages **retry automatically**; multiple tapbacks produce fewer notifications; RCS chats with Android gain inline replies and proper Tapbacks; a Drawing app; thumbnails for offloaded media **[third-party]** (9to5Mac, above). One outlet reports the send-progress indicator now sits under the bubble **[third-party, single source]** ([Jang](https://jang.com.pk/en/69759-apple-to-launch-ai-centric-messages-app-with-ios-27-news)).

### 2.4 Instagram DMs

- **Inbox.** A row of **Notes** at the top: up to 60 characters of text and emoji, one at a time, visible for 24 hours, to followers you follow back or Close Friends; only you see who liked it, and a reply opens a private chat ([Instagram, Direct features](https://about.instagram.com/features/direct)). Notes later gained prompts and friend tags **[third-party]** ([Android Central](https://www.androidcentral.com/apps-software/instagram-notes-several-features-rollout)). Up to 3 pinned chats ([Instagram, 2025-02-19](https://about.instagram.com/blog/announcements/new-instagram-dm-update-2025)).
- **Requests.** Messages from people who don't follow you are **text-only until accepted** (Direct features page, above).
- **Look.** Message effects, custom reactions, stickers, GIFs, polls, background colours and themes (Direct features page). The outgoing purple-to-blue gradient bubble is † (not verified this run).
- **Composer.** Press and hold Send to **schedule** a message ([2025-02-19](https://about.instagram.com/blog/announcements/new-instagram-dm-update-2025)), up to 29 days ahead **[third-party]** ([Business Today](https://businesstoday.in/technology/news/story/instagram-unveils-new-dm-upgrades-music-translation-and-scheduling-added-465498-2025-02-21)). The sticker tray has **Music**: a 30-second preview shown as a spinning record (2025-02-19). Late 2024 added 17 sticker packs (300+ stickers), AI stickers and photo "Cutouts" **[third-party]** ([Smartprix](https://www.smartprix.com/bytes/instagram-adds-new-features-to-dms-300-new-emojis-nicknames-and-live-location-sharing/)).
- **Pins and translation.** Pin up to 3 messages, shown at the top of the chat; press and hold › Translate shows the translation under the original (2025-02-19). Press reports say 99 languages and that translated messages are shared with Meta **[third-party]** (Business Today, above).
- **Reactions.** Double-tap sends ❤️ by default; you can change the double-tap emoji and the long-press row **[third-party]** ([Guiding Tech](https://www.guidingtech.com/change-double-tap-or-default-reaction-on-instagram-messages/)).
- **Glass.** A smaller Liquid Glass tab bar that floats over content while you scroll was tested from October 2025 and rolled out gradually into 2026; nothing documents the DM screens themselves **[third-party]** ([onlinemarketing.de](https://onlinemarketing.de/social-media-marketing/liquid-glass-instagram-neue-navigationsleiste); [iGeneration](https://www.igen.fr/app-store/2026/05/instagram-le-liquid-glass-arrive-doucement-la-version-ipad-remaniee-156005)).
- **Encryption.** E2EE ended on 2026-05-08 (Phase 1 doc §3.1).

### 2.5 Facebook Messenger

- **Features page.** Edit within 15 minutes; unsend at any time; disappearing messages; HD photos; shared albums in groups; files up to 100 MB; Notes and Stories that last 24 hours; themes including artist, holiday and special-occasion ones ([messenger.com/features](https://www.messenger.com/features)). AI-generated chat themes were announced in September 2024 ([About Meta](https://about.fb.com/news/2024/09/metas-ai-product-news-connect/) **[search summary]**); Messenger Communities in October 2024 ([About Meta news list](https://about.fb.com/news/category/technologies/messenger/)).
- **Reactions.** A long-press tray of six emoji that you can customise **[third-party]** ([Guiding Tech](https://www.guidingtech.com/how-react-to-messages-in-facebook-messenger-different-emojis/); [Tech Advisor](https://www.techadvisor.com/article/742358/how-to-change-the-default-reaction-emoji-in-facebook-messenger.html)); and a per-chat **quick reaction** button beside the composer (👍 by default) that sends an emoji in one tap and can be changed per conversation **[third-party]** ([Adweek](https://origin-wpe.adweek.com/media/facebook-messenger-heres-how-to-change-a-conversations-emoji/)).
- **Calls.** AI backgrounds, HD video by default on Wi-Fi, noise suppression, and "Record message" when a call goes unanswered ([About Meta, 2024-11-20, updated 2025-06-26](https://about.fb.com/news/2024/11/introducing-ai-backgrounds-noise-suppression-and-more-messenger-calling/) **[search summary]**).
- **2025–26.** I found almost no chat-surface changes: Meta's Messenger news in this period is teen-account restrictions (2025) and football promotions (2026), and the desktop app was retired in December 2025 (Phase 1 doc §6.1). **[inference]** Meta's messaging design effort in 2025–26 went to WhatsApp and Instagram.

### 2.6 Signal

- **Look.** Chat colour (including gradients) and wallpaper per chat or as a default, **visible only to you**; in groups, each member's name colour is assigned for the highest contrast between people ([Signal Support](https://support.signal.org/hc/en-us/articles/360007320951-How-do-I-change-colors-) **[search summary]**). Wallpaper presets were 12 solid colours and 9 gradients at launch in 2021 **[third-party]** ([Android Police](https://www.androidpolice.com/2021/01/28/signal-starts-catching-up-to-whatsapp-by-adding-custom-wallpapers-and-animated-stickers-apk-download/)).
- **Reactions.** Touch and hold for a quick set you can customise or reset; "more" opens the full emoji list ([Signal Support](https://support.signal.org/hc/articles/360039929972-Message-Reactions) **[search summary]**).
- **2025–26 additions** ([Signal blog index](https://signal.org/blog/)):
  - Secure Backups (2025-09-08).
  - **Polls** (2025-11-19): from the "+" button, up to 10 options, single or multiple choice, encrypted but **not anonymous** ([signal.org/blog/polls](https://signal.org/blog/polls/) **[search summary]**).
  - **Pinned messages** (2026-01-29): up to 3 per chat; pick 24 hours, 7 days, 30 days or forever; pinning a fourth unpins the one pinned longest; in groups, admins choose who may pin; a pin only shows to people who have the original message in their history ([Signal blog](https://signal.org/blog/pinned-messages/)).
  - Member labels in groups (2026-03-19); more linked devices, including Android phones and tablets (2026-08-04).
  - Chat folders (Android December 2024; desktop October 2025) **[third-party]** ([AlternativeTo](https://alternativeto.net/news/2024/12/signal-launches-chat-folders-feature-for-android-users)).
- **[inference]** Signal remains the reference for a calm chat: few colours, no animation for its own sake.

### 2.7 Snapchat

- **Structure.** "Simple Snapchat", shown at Snap's Partner Summit (September 2024), cut five tabs to three: Chat (with Stories at the top), Camera and Spotlight; it was rolled out gradually as a test **[third-party]** ([Digit](https://www.digit.in/news/apps/snapchat-unveils-a-new-3-tab-interface-ditches-5-tab-menu-know-more.html); [Net Influencer](https://www.netinfluencer.com/simple-snapchat-simplified-interface-snap-partner-summit/)).
- **Conversation.** Snapchat chat does not use classic bubbles; messages run under sender name labels † (not verified this run). **Chat Effects:** while typing, two arrows appear beside the text; drag up to make the message bigger, down to make it smaller, then release to send ([Snapchat Support](https://help.snapchat.com/hc/en-us/articles/17791249939220-How-do-I-change-the-size-of-my-Chat-messages)). **Customoji**, text stickers that feature your Bitmoji and your words, appear next to the text box as you type ([Snapchat Support](https://help.snapchat.com/hc/en-us/articles/40748398177044-What-is-a-Customoji-and-how-do-I-create-one)). A friend's Bitmoji peeks in when they are viewing the chat (Phase 1 doc §1.11).
- **Actions.** Swipe right on a message, or press and hold › Chat Reply ([Snapchat Support](https://help.snapchat.com/hc/en-us/articles/7012338497172-How-do-I-reply-to-a-Snap-in-Chat) **[search summary]**). Edit within 5 minutes, marked "(Edited)"; deleting leaves a visible notice that a message was deleted ([Snapchat Support](https://help.snapchat.com/hc/en-us/articles/27270627813652-How-do-I-edit-a-Chat-message) **[search summary]**).
- **Groups.** Up to 201 people, including you ([Snapchat Support](https://help.snapchat.com/hc/en-us/articles/7012337635604-How-do-I-add-Snapchat-friends-to-a-Group-Chat) **[search summary]**).
- **Usage signals (2025).** Chat reaction use up 44%, ❤️ the most used; over 5 billion voice notes sent in the U.S.; people messaging group chats up more than 5% ([Snap, 2025-12-15](https://newsroom.snap.com/snapchat-recap-2025)). AI text stickers and expiring "Snap Modes" for Snapchat+ ([Snap, 2025-02-06](https://newsroom.snap.com/february-product-bundle)).

### 2.8 Discord DMs

- **2025 desktop refresh (2025-03-25).** Four free base themes (Light, Ash, Dark, Onyx), three density settings (Compact, Default, Spacious), the Inbox moved into the title bar, call controls gathered into one bar, and a resizable channel list ([Discord changelog](https://discord.com/blog/discord-update-march-25-2025-changelog) **[search summary]**). Forum users said even Spacious felt cramped and that the DM column was crowded by shortcuts (requests, shop, Nitro) above the actual conversations **[third-party]** ([Discord community post](https://support.discord.com/hc/sv/community/posts/30928210948247-New-Discord-UI-March-2025)).
- **2026 mobile alignment.** A shape rule of **circles for people, squircles for things**, more breathing room around the chat bar, and an Ash theme with better contrast ([Discord blog](https://discord.com/blog/improving-mobile-with-squircles-styles-and-spacing) **[search summary]**). A confirmation step was added to the call buttons in DM headers to stop accidental calls ([patch notes, 2026-06-04](https://discord.com/blog/discord-patch-notes-june-4-2026) **[search summary]**); a September 2026 update lets you leave inactive group DMs in bulk **[third-party]** ([Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-news/discord-september-2026-changelog-adds-new-features-and-fixes)).
- **Conversation.** Flat rows with avatars (Phase 1 doc §1.2). Hovering a message shows a bar with three frequently used reactions; users complain it covers nearby messages and can't be customised **[third-party]** ([Discord community post](https://support.discord.com/hc/vi/community/posts/26876293537175-The-quick-emoji-suggestions-in-the-hover-bar-are-very-distracting-and-cover-parts-of-the-text)).
- **Reactions.** Super Reactions (Nitro only) play an animation; the documented way to stop it is the "Play Animated Emoji" accessibility switch ([Discord Support](https://support.discord.com/hc/en-us/articles/12102061808663-Reactions-and-Super-Reactions-FAQ) **[search summary]**), which users say doesn't always work **[third-party]**.
- **Limits.** Group DMs up to 10 (Phase 1 doc §2); voice messages up to 20 minutes, sent from mobile only; polls up to 10 answers in DMs and groups; forward to up to 5 places, labelled as forwarded ([Discord Support: Voice Messages](https://support.discord.com/hc/en-us/articles/13091096725527-Voice-Messages), [Polls FAQ](https://support.discord.com/hc/en-us/articles/22163184112407-Polls-FAQ), [Forwarding](https://support.discord.com/hc/en-us/articles/24640649961367-Message-Forwarding), all **[search summary]**).

### 2.9 Slack DMs

- A DM is one-to-one or up to 9 people; beyond that, convert it to a private channel ([Slack Help](https://slack.com/intl/en-gb/help/articles/212281468-What-is-a-direct-message) **[search summary]**).
- Flat rows. Hovering shows **three one-click reactions**; admins set the workspace defaults and each member can override them; on mobile, long-press shows frequently used reactions at the top ([Slack Help](https://slack.com/help/articles/360056881694) **[search summary]**).
- Save for later, with reminders, in a private "Later" view; pause notifications for a chosen time or a custom period; while you are paused, a sender can push one urgent DM through, once a day ([Slack Help](https://slack.com/help/articles/214908388) **[search summary]**). The red badge with a number marks notifications ([Slack glossary](https://slack.com/intl/en-fi/help/articles/213817348-Slack-glossary) **[search summary]**).
- 2025–26: on iOS 26 a "glass" composer and a floating search; split view returned **[third-party]** ([University of Michigan IT](https://its.umich.edu/communication/collaboration/slack/support/updates)).

### 2.10 LINE and KakaoTalk (brief)

- **LINE.** Reactions began as six face stamps (2021) and in May 2025 opened to every LINE emoji you own **[third-party]** ([Jetstream](https://jetstream.blog/2025/05/29/line-reaction-feature-expands-to-all-emojis/)). Unsend within 24 hours since 2017 **[third-party]** ([TechCrunch](https://techcrunch.com/?p=1577613)). In 2026 LINE began a free "LINE Labs" trial of editing within 15 minutes, marked "Edited", which LINE says will later become a paid Premium feature **[third-party]** ([Thairath](https://en.thairath.co.th/lifestyle/tech/2954173)). Sticker culture is the core of its look †.
- **KakaoTalk.** The 2025-09-23 update, its largest in 15 years, turned the Friends list into an Instagram-style grid feed and added a short-video "Now" tab. Users objected to colleagues' photos being pushed at them and to ads in the feed; the Google Play rating fell to 2.8, and on 2025-09-29 Kakao announced it would restore the list, later as a choice in settings **[third-party]** ([Korea JoongAng Daily](https://www.koreajoongangdaily.com/business/kakaotalk-updates-spark-user-backlash-over-interface-and-privacy/11927865); [Korea Times](https://www.koreatimes.co.kr/amp/business/tech-science/20250929/kakao-to-restore-kakaotalks-friends-list-after-widespread-complaints)). The same update added editing within 24 hours. In August 2025 the delete-for-everyone window grew from 5 minutes to 24 hours, and the deleter's identity is now hidden **[third-party]** ([Asia Economy](https://view.asiae.co.kr/en/article/2025081311055213271)). In May 2026 reactions grew from 6 types to 114, with up to 30 on one bubble **[third-party]** ([Digital Today](https://www.digitaltoday.co.kr/en/view/55676/kakao-kakaotalk-regular-update-expands-chat-bubble-reactions-to-114)).

### 2.11 Beeper

- Relaunched in July 2025 on an on-device architecture after merging with Texts.com. The paid Plus tier adds scheduling, chat reminders, reading without sending receipts, and Whisper-based voice-note transcription **[third-party]** ([AlternativeTo](https://alternativeto.net/news/2025/7/beeper-relaunches-with-on-device-model-new-features-and-text-com-merged-services)).
- **Inbox model** ([Beeper Help](https://help.beeper.com/en_US/ios/beeper-ios-managing-your-inbox)): pinned chats as bubble icons at the top; **Archive** keeps notifications on and brings a chat back when a new message arrives; **Low Priority** hides a chat and silences it except for @mentions and replies; mark read/unread; configurable swipe actions (read/unread, archive, mute); muted rows show a silent-bell icon; search grouped into Chats, Groups, Media and Messages, with filters by network, inbox status and file type; custom labels.
- **[inference]** Beeper is useful to Realm as an inbox-hygiene reference, not as a visual one.

---

## 3. Feature matrix

**Key:** Y = yes, N = no, P = partial, ? = not established. Plain cells come from official sources (§2 and Sources); ‡ = third-party source; † = general product knowledge, not re-checked this run. "net" = Beeper inherits what the bridged network supports. Columns: WA WhatsApp, TG Telegram, iM iMessage, IG Instagram, Ms Messenger, Sg Signal, Sn Snapchat, Dc Discord DMs, Sl Slack DMs, LN LINE, KK KakaoTalk, Bp Beeper.

### 3.1 Conversations and the inbox

| Feature | WA | TG | iM | IG | Ms | Sg | Sn | Dc | Sl | LN | KK | Bp |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DMs and group chats | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | net |
| Group size cap | 1,024‡ | 200,000 | 32‡ | 250 (one help page says 32) | 250 (2018 figure) | 1,000 | 201 incl. you | 10 | 9 | 500† | ? | net |
| Message requests / spam filter | P: rate-based unknown-sender block; Requests folder in beta‡ | P: non-contact limits† | Y: Unknown Senders | Y: text-only until accepted | Y† | Y† | P: friends-first† | Y† | P† | P† | P† | Y: Requests filter‡ |
| Pin chats | Y (3)† | Y (5; 10 Premium)‡ | Y (9) | Y (3) | ? | Y (4)† | Y† | P‡ | P (sections)† | Y† | Y† | Y |
| Archive | Y† | Y† | N† | ? | Y† | Y‡ | N† | N† | P† | Y† | ? | Y |
| Folders / filters | Y: All, Unread, Favorites, Groups, custom Lists | Y: folders (10; 20 Premium)‡ | P: Filters menu | P: Primary/General/Requests† | P† | Y: folders‡ | N† | N (server folders only)† | Y: custom sections | Y† | Y: folders‡ | Y: labels, Low Priority |
| Mute (durations) | 8 h, 1 wk, Always; plus "Highlights" mode | Y; mentions and replies still notify | Hide Alerts (no timer) | Y† | Y† | Y (8 h, 1 wk, Always; sources conflict)‡ | Y† | 15 min, 1 h, 3 h, 8 h, 24 h, until off‡ | Y; pause for a set time | Y† | Y† | Y; Low Priority |
| Mark unread | Y | Y† | Y† | Y† | Y† | Y† | ? | Y† | Y† | ? | ? | Y |

### 3.2 Acting on messages

| Feature | WA | TG | iM | IG | Ms | Sg | Sn | Dc | Sl | LN | KK | Bp |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Reactions | Any (6 quick‡) | Any; admins can limit in groups‡ | Any emoji or sticker, plus 6 classic | Any; row customisable‡ | Any; 6 customisable‡ | Any; quick set customisable | Any‡ | Any, custom, Super Reactions | Any, custom; 3 one-click | Owned LINE emoji (was 6)‡ | 114 types, up to 30 per bubble‡ | net |
| Replies / quotes | Y | Y; partial quotes; reply in another chat | Y (inline) | Y† | Y† | Y† | Y | Y† | Y (in thread) | Y† | Y† | net |
| Threads | P: groups, beta‡ | P: topics, comments† | P: inline reply view† | N† | N† | N† | N† | P: servers only† | Y | N† | N† | net |
| Edit (window) | 15 min | 48 h‡ | 15 min, 5 edits | 15 min | 15 min | 24 h, 10 edits‡ | 5 min | No limit† | Admin setting† | 15 min, trial‡ | 24 h‡ | net |
| Unsend / delete for everyone | About 2½ days‡ | Y, no limit stated | 2 min | Y, no limit stated | Any time | Y, window not confirmed | Y; friends see a deletion notice | Any time† | Admin setting† | 24 h‡ | 24 h (was 5 min)‡ | net |
| Forward | Y† | Y† | Y† | Y | Y (to 5 chats at once)† | Y† | P† | Y (to 5 places) | Y† | Y† | Y† | net |
| Pin messages | 3; 4th in beta‡ | Y† | N | 3 | Y† | 3, with expiry | N† | Y† | Y† | Y† | Y† | net |
| Saved / starred | Y† | Y: Saved Messages | N† | N† | N† | P: Note to Self† | Y: save in Chat | ? | Y: Later | Y: Keep† | Y† | P: reminders‡ |

### 3.3 Status and presence

| Feature | WA | TG | iM | IG | Ms | Sg | Sn | Dc | Sl | LN | KK | Bp |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Read receipts (can switch off?) | Y (yes) | Y; read *time* hidden with Last Seen; reciprocal unless Premium | Y (yes)† | Y (yes)† | Y (yes)‡ | Y (yes, reciprocal) | Y (no)† | N | N | Y (no)† | Y: unread count (no)† | net; "incognito" read in Plus‡ |
| Typing indicators | Y | Y | Y, groups since iOS 26 | Y† | Y† | Y | Y† | Y† | Y† | ? | ? | net |
| Online / last seen | Y, with controls | Y; approximate when hidden | N | Y† | Y | N | P: Bitmoji in chat; green dot on avatars | Y | Y | N† | N† | net |
| Nicknames | N; usernames from 2026‡ | P: contact names; private contact notes | P: contact names† | Y‡ | Y† | Y† | Y† | ? | N | Y† | Y† | ? |
| Per-group member tags (2026 trend) | Y‡ | Y | N | N† | N† | Y: member labels | N† | P: server roles† | N | ? | ? | net |

### 3.4 Media and expression

| Feature | WA | TG | iM | IG | Ms | Sg | Sn | Dc | Sl | LN | KK | Bp |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Voice messages (transcription) | Y (Y) | Y (2 free a week; unlimited Premium‡) | Y (Y†) | Y (?) | Y (?) | Y (N†) | Y (?) | Y, up to 20 min, sent from mobile (N) | Y: clips† (Y†) | Y (?) | Y (?) | net (Y in Plus‡) |
| Video notes | Y† | Y (round)† | N† | ? | P: only after a missed call | N† | Y: Snaps | N† | Y: clips† | ? | ? | net |
| Photo / video / file sharing | Y | Y | Y | P: no general files† | Y (files to 100 MB) | Y | P† | Y | Y | Y | Y | net |
| Stickers | Y | Y | Y | Y | Y | Y† | Y (incl. Customoji) | Y† | N: custom emoji instead | Y | Y | net |
| GIFs | Y† | Y (350M searchable) | Y† | Y | Y† | Y† | Y† | Y† | P: app† | ? | ? | net |
| Polls | Y | Y (media, revoting, durations) | Y | Y | Y† | Y (up to 10 options) | ? | Y (up to 10 answers) | P: apps† | Y† | Y† | net |
| Location sharing | Y† | Y† | Y† | Y (live, 1 h)‡ | Y† | P: static† | Y: Snap Map | N | N | Y† | Y† | net |
| Scheduled send | N† | Y (and repeating) | Y (up to 14 days) | Y (29 days‡) | N† | P: Android only† | N† | N† | Y† | ? | ? | Y (Plus‡) |
| Disappearing messages | Y† | Y† | N | Y: vanish mode | Y | Y | Y (default) | N | P: retention rules† | ? | ? | net |
| View-once media | Y† | Y (incl. one-time voice) | N | Y | ? | Y† | Y | N | N | ? | ? | net |
| Chat themes / wallpapers | Y, private to you | Y: animated, gift wallpapers | Y, shared with the chat | Y | Y (incl. AI) | Y, private to you | P† | P: app-wide themes | P: app-wide† | Y† | Y† | ? |

### 3.5 Finding, talking and trust

| Feature | WA | TG | iM | IG | Ms | Sg | Sn | Dc | Sl | LN | KK | Bp |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mentions / @everyone | Y / Y (@all) | Y / N† | Y / N† | Y† / ? | Y† / Y† | Y / N† | ? | Y / P (servers) | Y / Y (@channel, @here) | Y / Y (@All)† | Y† / ? | net |
| Search in chat / everywhere | Y / Y | Y / Y | Y / Y | Y† / P† | Y† / Y† | Y† / Y† | ? | Y / Y† | Y / Y | Y / Y† | Y / Y† | Y / Y, with filters |
| Link previews | Y | Y (size and position adjustable) | Y | Y† | Y | Y† | Y† | Y | Y | Y† | Y† | net |
| Translation | Y (on device) | Y† | Y (on device) | Y (99 languages‡) | ? | N† | ? | N† | ? | Y† | ? | ? |
| Voice and video calls | Y | Y | Y | Y (up to 8) | Y | Y | Y | Y | Y | Y | Y | P† |
| Screen share | Y (also on Web) | Y† | Y: SharePlay† | ? | Y† | Y† | N† | Y | Y† | Y† | ? | N† |
| E2EE status | All personal chats | Secret 1:1 chats only; "extra-secure" group calls (April 2025)† | iMessage yes; RCS in beta | None since May 2026 | Personal chats by default‡ | Everything | P: Snaps; text unclear‡ | Calls only (DAVE), not text | N† | Y (Letter Sealing)† | P: opt-in Secret Chat† | Inherits network; on-device since July 2025‡ |
| Multi-device | Y† | Y | Y | Y | Y (web; desktop app retired) | Y (incl. Android phones and tablets, 2026) | P† | Y | Y | P† | P† | Y |

**Reading the matrix [inference].** Rows where every standalone app says Y are the floor (§4). Rows that split the field show positioning: read receipts (personal apps yes, community apps no), threads (only Slack fully), scheduled send (iMessage, Instagram, Telegram, Slack), and themes (private versus shared).

---

## 4. What they all have in common

"Table stakes" here means at least eight of the ten standalone messengers have it (Beeper is excluded because it inherits features). "Delighters" are features one or a few apps have that people visibly enjoy.

### 4.1 Table stakes in 2026

A user opening any new chat app in 2026 will assume all of these **[inference from the matrix]**:

1. An inbox sorted by latest activity, with unread counts, pinned chats at the top and mute.
2. One-to-one and group chats; groups have a name and a picture.
3. Text with link previews; photos, video and files; voice messages.
4. Reply with a quote of the original, reached by long-press, hover or swipe.
5. Reactions with any emoji, plus a short quick-pick row.
6. Edit for a while after sending (15 minutes is now the common window), labelled "Edited"; delete for everyone.
7. Forward.
8. Typing indicators; delivery or read state in personal apps.
9. Mark as unread.
10. Search inside a chat and across all chats.
11. Stickers and GIFs.
12. **Polls** (new to the list in 2025: iMessage and Signal joined).
13. **Pinned messages** (Signal joined in January 2026; three per chat is the norm).
14. A separate place for strangers: message requests or unknown-sender screening.
15. Mentions in groups.
16. Voice and video calls.
17. Use on more than one device.

**Becoming table stakes** (about half the field, growing fast): chat themes or backgrounds, translation, voice-message transcription, scheduled send, disappearing messages, and per-group member tags.

### 4.2 Delighters

| Delighter | Who | Why it works **[inference]** |
|---|---|---|
| Shared conversation background, changeable by anyone | iMessage | The chat looks like *your group's* place |
| Animated gradient background that shifts as you send | Telegram | The room reacts to you; a cheap, ambient bit of life |
| Double-tap quick reaction | Telegram, WhatsApp, Instagram | The fastest possible "seen it, love it" |
| Tap someone's reaction to add the same | WhatsApp | Joining in costs one tap, no picker |
| Text effects (Big, Shake, Explode…) | iMessage | Tone of voice, in text |
| Drag-to-resize text before sending | Snapchat | Shouting or whispering without capitals |
| Customoji / avatar stickers made from what you type | Snapchat | Personal, instant, no searching |
| Friend's avatar peeks in when they're reading | Snapchat | Presence that feels like company |
| Notes row at the top of the inbox | Instagram | A low-stakes "what I'm up to" that opens a DM |
| 30-second music preview as a spinning record | Instagram | Sharing taste, not just links |
| Greeting sticker in an empty chat | Telegram | Removes the blank-page problem |
| Live "N online" under the group name | WhatsApp | Tells you whether now is a good time to post |
| "Highlights" notification mode | WhatsApp | Stay in a busy group without the noise |
| Name colours and patterns on replies | Telegram | Identity carries into quotes |
| Dashed outline on a scheduled message | iMessage | The state is obvious without a label |
| Events with "maybe" and plus-ones; checklists | WhatsApp, Telegram | Plans happen where people already talk |

---

## 5. The patterns that make each feel friendly (with numbers)

### 5.1 Getting to message actions

| App | Phone | Desktop | Quick-reaction row |
|---|---|---|---|
| WhatsApp | Long-press | Hover shows a smiley button **[third-party]** | 6: 👍 ❤️ 😂 😮 😢 🙏, then "+" **[third-party]** |
| iMessage | Touch and hold | (Mac) same Tapback menu | 6 classic Tapbacks, then any emoji or sticker |
| Messenger | Long-press | Hover † | 6, customisable **[third-party]** |
| Instagram | Long-press | Hover **[third-party]** | A customisable row **[third-party]** |
| Signal | Touch and hold | Hover † | A customisable set; count not confirmed |
| Slack | Long-press (frequent reactions at the top) | Hover bar | **3** one-click reactions |
| Discord | Long-press | Hover bar | **3** frequently used **[third-party]** |
| Telegram | Long-press | Hover/right-click † | A row set by you and, in groups, by admins **[third-party]** |

The pattern **[inference]**: phones show about six; desktop hover bars show three, because the bar sits over the conversation and must stay small (Discord's users complain when it covers text). Phase 1 doc §7.4 already proposes three on hover, which matches Slack and Discord.

### 5.2 Swipe to reply

Swiping a bubble sideways starts a reply in iMessage (swipe right; Apple Support), Snapchat (swipe right; Snapchat Support) and WhatsApp (swipe right **[third-party]**, [Technipages](https://www.technipages.com/whatsapp-reply-specific-message/)). Telegram has the gesture but sources disagree on the direction **[third-party]** ([Android Police](https://www.androidpolice.com/2020/06/15/5-telegram-gestures-and-shortcuts-you-should-be-using/)). The tapped reply quote scrolls back to the original in every app that documents it.

### 5.3 Double-tap

- Telegram: double-tap sends your quick reaction (👍 by default, changeable) and double-tapping again removes it; there is no switch to turn the gesture off, and users report accidental reactions **[third-party]**.
- WhatsApp (since 2025-01-14): double-tap reacts, and you can scroll through your most-used reactions.
- Instagram: double-tap sends ❤️ by default; you can choose another emoji **[third-party]**.
- iMessage: some guides describe double-tap as opening the Tapback menu rather than reacting directly **[third-party]**.

### 5.4 Bubble grouping, timestamps and edit labels (additions to Phase 1 doc §1.3)

- Telegram shows the exact time a message was read in one-to-one chats, follows your Last Seen privacy, and deletes read times after 7 days ([Telegram blog](https://telegram.org/blog/new-saved-messages-and-9-more) **[search summary]**).
- Snapchat puts "(Edited)" next to an edited chat; iMessage shows "Edited" with earlier versions; Kakao now hides who deleted a message in groups and shows deletions as a feed-style line rather than a bubble **[third-party]**.
- WhatsApp lets several photos share one caption, and each item can be reacted to or replied to on its own (2025-06-12).
- iMessage marks a scheduled message with a dashed outline and its send time above it.

### 5.5 How unread and mentions are marked in the list

| App | Unread | "Someone needs you" |
|---|---|---|
| Telegram | Counter on the row; muted chats' counters are quieter † | A **blue mention indicator** beside the counter; an **@ button** in the chat that steps through mentions, with long-press to clear them all ([API docs](https://core.telegram.org/api/mentions) **[search summary]**); a matching button for unread reactions |
| WhatsApp | Count badge; Unread filter | "@" next to the chat (Phase 1 doc §1.1); "Highlights" mode notifies only for @mentions, replies and saved contacts ([2025-04-09](https://blog.whatsapp.com/new-feature-roundup-updates-to-group-chats-events-calls-channels-and-more)) |
| Slack | Bold channel name †; All unreads view (⌘/Ctrl ⇧ A) | Red numbered badge ([Slack Help](https://slack.com/intl/en-fi/help/articles/226410907-View-all-your-unread-messages) **[search summary]**) |
| iMessage | Blue dot † | Hide Alerts icon on muted rows; Unknown Senders stay silent until accepted |
| Beeper | Badge and emphasis; mark read/unread | Low Priority rows stay silent except @mentions and replies; muted rows show a silent bell |

This confirms the Phase 1 rule (a neutral marker for "new", an accent for "needs you") and adds two ideas: a way to **step through** your mentions inside a chat (Telegram's @ button) and a notification level between "all" and "off" (WhatsApp's Highlights).

### 5.6 Empty states and first messages

- Telegram offers a greeting sticker in an empty chat; one tap sends it **[third-party]**. Telegram Business lets a business customise the empty-chat start page with text and a sticker (same source).
- Instagram's Notes row keeps the top of the inbox alive even when no chat is new.
- WhatsApp lets you create a group with just a name and invite people afterwards (2025-06-12), so an empty group is a normal first step.
- iMessage suggests a poll when the conversation looks like a decision (Apple Newsroom, iOS 26).
- Phase 1 doc §7.6 already plans "Say hi 👋" for new DMs, which matches Telegram's idea.

### 5.7 Safety that feels friendly

- iMessage stops treating someone as unknown once you have replied to them three times ([Apple Support 125068](https://support.apple.com/en-us/125068) **[search summary]**).
- Instagram requests are text-only until accepted (Direct features page).
- WhatsApp's unknown-sender block only triggers on spam-like volumes, not on every stranger **[third-party]**; its usernames can require a "key" before a stranger can message you **[third-party]**.
- Slack lets a sender push one urgent DM through a paused person's notifications, once a day (Slack Help).

---

## 6. What users pushed back on (lessons)

| What happened | Lesson for Realm **[inference]** |
|---|---|
| KakaoTalk turned its Friends list into a photo feed with ads (September 2025); ratings fell to 2.8 and Kakao promised a rollback within a week **[third-party]** | Never turn the people list or inbox into a feed. Feed belongs in Feed. |
| Discord's 2025 refresh: DMs crowded below shop, Nitro and request shortcuts; density "still cramped" **[third-party]** | DMs must be the first thing in Messages; no upsell rows above conversations. |
| Discord's hover bar covers nearby messages; quick emoji can't be customised **[third-party]** | Keep the hover bar inside the message's own gutter; learn the quick emoji from use, and let people change them. |
| Discord Super Reactions: paid, animated, hard to switch off **[third-party]** | No paid reactions; every animation obeys Reduce motion and a "Reduce effects" switch. |
| Telegram double-tap fires by accident; no off switch **[third-party]** | Any gesture shortcut needs a setting to change or disable it. |
| Discord forwards don't tell the author and can't be disabled **[third-party]** | Show "Forwarded" clearly; consider letting group chats opt out (owner decision). |
| Telegram's glass needed a Power Saving switch to cut interface effects (2026-01-03) | Glass and motion cost battery and frames; ship the off switch with the effect. |

---

## 7. Recommendations for Realm

All eight are my reasoning from the evidence above **[inference]**. They extend the Phase 1 doc rather than replace it; each says which part it builds on. None copies one app's look: each takes a pattern several apps converged on and gives it Realm's own form.

### R1. Shared chat backdrops, with a private "just for me" override

- **What:** each DM and group chat can have a backdrop, picked from a small built-in set drawn from Realm's world themes (for example 6–8 gradients and textures, CSS only). In group chats the backdrop is **shared**: anyone can change it, and the change posts a system line ("Noor changed the backdrop · Undo"). Anyone can also choose "Use my default here", which overrides it for them alone.
- **Why:** personal chat looks are now nearly universal (WhatsApp, iMessage, Telegram, Messenger, Signal, Instagram). iMessage's shared model makes a group chat feel like the group's own place, which suits friend groups; WhatsApp's and Signal's private model avoids fights and protects readability. Offering both costs little.
- **Rules:** bubbles and text keep their normal colours on every backdrop, which sits behind a scrim tuned for contrast, so readability never depends on the backdrop; no photos in Phase 1 (moderation load); no live blur.
- **Builds on:** Phase 1 doc §7.1 (frames) and §7.4 (bubble colours, owner decision 2).

### R2. Reactions one gesture away, never in the way

- **What:** long-press (touch) opens a sheet with **6 quick emoji** learned from your use, then "+" for any. The desktop hover bar keeps the Phase 1 doc's **3**. Add: **tap an existing reaction pill to add the same** (WhatsApp, April 2025); **double-tap on touch** sends your chosen quick reaction, with a setting to change the emoji or switch the gesture off.
- **Guards:** the hover bar sits in the bubble's own gutter and never overlaps another message; a single small "pop" when *you* react, none when others do, all off under Reduce motion; no paid or special reactions.
- **Builds on:** Phase 1 doc §7.4 (action bar) and §4.6 (motion).

### R3. "Plan it" cards for friend groups and gamers

- **What:** two message types from the composer's "+": a **poll** (up to 10 options, single or multiple choice, votes visible, the creator can close it; Signal's and Discord's shape) and a **ready check** ("Ranked at 9?" with In / Maybe / Out, an optional time, auto-pinned until it starts, with a system line when it ends). The ready check can show how many "In" people are here now.
- **Why:** polls became table stakes in 2025; WhatsApp events and Telegram checklists show planning has moved into chat. A ready check is the gaming-native version, and nothing in the survey does it in DMs **[inference]**. This is where Realm can be distinctive rather than a clone.
- **Phase:** design now so the message model allows "card" messages; ship the poll first.
- **Builds on:** Phase 1 doc §1.5 (the "+" menu leaves room for Poll).

### R4. Status notes on the Here now row

- **What:** each person can set one short note (up to 60 characters, emoji allowed) that lasts 24 hours and shows under their avatar in the inbox's Here now row ("queueing ranked, join?"). Tapping it opens a DM with the note quoted. Audience follows presence privacy.
- **Why:** Instagram's Notes prove the format (same limits); in Realm it joins presence and plans, which is the "party lobby" idea from the product brief.
- **Builds on:** Phase 1 doc §7.2 (Here now row).

### R5. Per-group member tags

- **What:** in group chats, each person may set a tag for that group only (about 20 characters), shown after their name above a run of bubbles ("support main", "host"). Set by the person themselves; no permissions.
- **Why:** WhatsApp, Telegram and Signal all shipped this in early 2026. It gives friend groups playful identity without Space-style roles.
- **Builds on:** Phase 1 doc §7.4 (sender names above the first bubble).

### R6. Three notification levels, and quiet strangers

- **What:** every conversation offers **All · Highlights · Off**. Highlights notifies for @mentions of you, replies to you and people you've starred (WhatsApp's model). Off keeps the Phase 1 durations (1 h, 8 h, 1 week, Always). Big group chats default to Highlights **[threshold to tune, e.g. 25 members]**.
- **Strangers:** requests are text-only until accepted (Instagram); no typing or read receipts are sent until accepted (Phase 1 doc §7.6); a person becomes "known" once you accept or reply (a simpler version of Apple's three-replies rule).
- **Inside a chat:** an @ button above the composer steps through unread mentions of you (Telegram's pattern), with long-press to clear them.
- **Builds on:** Phase 1 doc §2 (notification defaults) and §7.2 (row badges).

### R7. A "glass-lite" look with a Reduce effects switch

- **What:** take the 2025–26 look (a floating composer and header over the conversation) but render it with solid, slightly translucent tints and a hairline highlight, **not** live backdrop blur over the scrolling list. Add one **Reduce effects** switch (Telegram's Power Saving idea) that removes backdrops' animation, animated emoji and translucency together.
- **Shape rule:** borrow the idea, not the details, of Discord's rule: **circles for people, rounded squares for Spaces and group chats**, so a glance tells you who versus where.
- **Why:** glass is what "modern" looks like in 2026, but live blur over a scrolling list is expensive on integrated GPUs, which Realm has already had trouble with on its landing page; Telegram had to add an off switch after the fact.
- **Builds on:** Phase 1 doc §7.1 (frames) and §7.5 (floating composer).

### R8. Use the converged numbers

- **Pins:** 3 per chat, with 24 hours, 7 days, 30 days or forever; pinning a fourth replaces the oldest (Signal's rule). The Phase 1 doc's banner design stays.
- **Edit:** 15 minutes, labelled "Edited", with earlier versions viewable (the iMessage, WhatsApp, Instagram and Messenger window).
- **Delete for everyone:** allowed for your own messages, leaving the Phase 1 tombstone; the time window is an **owner decision** (any time, as in Instagram and Messenger, or 24 hours, as in LINE and KakaoTalk), because it interacts with moderation and reports.
- **Failed sends:** retry automatically once on reconnect before showing "Failed to send · Retry" (iOS 27 now retries automatically).
- **Scheduled send (later):** if added, mark scheduled messages with a dashed outline and their send time (iMessage).
- **Builds on:** Phase 1 doc §1.7, §1.8, §5.1, §7.4.

**Things not to do** (from §6): no feed in the inbox, no upsell rows above DMs, no paid or unstoppable animations, no gesture without an off switch, no hover bar that covers other messages.

---

## 8. Updates to the Phase 1 messaging doc

| Phase 1 doc says | Found today | Suggested change |
|---|---|---|
| §1.8: WhatsApp allows up to **four** pinned messages (FAQ, checked 2026-10-02) | Press reports say three since 2024, with a fourth rolling out to some Android beta users from September 2026 **[third-party]** ([WABetaInfo](https://wabetainfo.com/whatsapp-is-rolling-out-support-for-up-to-4-pinned-messages/)); Instagram and Signal use three | Treat four as WhatsApp's new limit, not the norm; Realm uses 3 (R8) |
| §1.1 and §2: mute is 8 h / 1 wk / Always | WhatsApp added a "Highlights / All" notification setting (2025-04-09) | Add the Highlights level (R6) |
| §1.6 and §7.4: three quick reactions on hover | Matches Slack and Discord (3 on hover); phones show about 6 (WhatsApp, iMessage, Messenger); WhatsApp added double-tap and tap-to-join | Keep 3 on hover; use 6 on the touch sheet; add tap-to-join and an optional double-tap (R2) |
| §5.1: failed sends show "Failed to send · Retry" | iOS 27 retries failed messages automatically **[third-party]** | Retry once on reconnect, then show Failed (R8) |
| §1.10: iOS 26 is the current iMessage | iOS 27 shipped 2026-09-14 **[third-party]** | Cite iOS 27 for new claims |
| §2: Discord caps group DMs at 10; Realm proposes 100 | Other caps: Slack 9, Snapchat 201, Signal 1,000, WhatsApp 1,024 **[third-party]**, Telegram 200,000 | No change; 100 sits in the friend-group range |

---

## Sources

"Opened" means I fetched and read the page today. "Search summary" means the claim came from a search engine's summary of the page. Dates are publication dates where the source gives one.

**Official, opened 2026-10-10**
- WhatsApp blog, Chat themes (2025-02-13): https://blog.whatsapp.com/chat-themes-to-reflect-your-style
- WhatsApp blog, New year, new ways to chat (2025-01-14): https://blog.whatsapp.com/new-year-new-ways-to-chat-on-whatsapp
- WhatsApp blog, Feature roundup: group chats, events, calls (2025-04-09): https://blog.whatsapp.com/new-feature-roundup-updates-to-group-chats-events-calls-channels-and-more
- WhatsApp blog, Feature roundup: stickers, calls, channels (2025-06-12): https://blog.whatsapp.com/new-feature-roundup-updates-to-stickers-calls-channels-status-and-more
- WhatsApp blog, Message translations (2025-09-23): https://blog.whatsapp.com/introducing-message-translations
- About Meta, WhatsApp Live/Motion Photos, Meta AI chat themes (2025-09-29): https://about.fb.com/news/2025/09/live-motion-photos-meta-ai-chat-themes-video-call-backgrounds-more-whatsapp/
- About Meta, WhatsApp Web calling (2026-07-28): https://about.fb.com/news/2026/07/whatsapp-web-calling-new-features/
- About Meta, Messenger news list: https://about.fb.com/news/category/technologies/messenger/
- Messenger features page: https://www.messenger.com/features
- Instagram blog, New ways to stay close in DMs (2025-02-19): https://about.instagram.com/blog/announcements/new-instagram-dm-update-2025
- Instagram, Direct features: https://about.instagram.com/features/direct
- Telegram blog index (2025–2026 titles and dates): https://telegram.org/blog
- Telegram blog, Comments in Group Calls, Notes for Contacts (2025-10-10): https://telegram.org/blog/comments-in-video-chats-threads-for-bots
- Telegram blog, AI Summaries, New Design (2026-01-03): https://telegram.org/blog/new-design-ai-summaries
- Telegram blog, Replies 2.0, Name Colors (2023-10-28): https://telegram.org/blog/reply-revolution
- Telegram FAQ: https://telegram.org/faq
- Apple Newsroom, iOS 26 (2025-06-09): https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/
- Signal blog index: https://signal.org/blog/
- Signal blog, Put a pin in it (2026-01-29): https://signal.org/blog/pinned-messages/
- Snap Newsroom, February product bundle (2025-02-06): https://newsroom.snap.com/february-product-bundle
- Snap Newsroom, Snapchat recap 2025 (2025-12-15): https://newsroom.snap.com/snapchat-recap-2025
- Snapchat Support, Chat message size: https://help.snapchat.com/hc/en-us/articles/17791249939220-How-do-I-change-the-size-of-my-Chat-messages
- Snapchat Support, Customoji: https://help.snapchat.com/hc/en-us/articles/40748398177044-What-is-a-Customoji-and-how-do-I-create-one
- Beeper Help, Managing your inbox (iOS): https://help.beeper.com/en_US/ios/beeper-ios-managing-your-inbox

**Official, via search summary 2026-10-10**
- WhatsApp blog, Custom lists (2024-10-31): https://blog.whatsapp.com/focus-on-what-matters-with-custom-lists
- Telegram blog: Animated Backgrounds https://telegram.org/blog/animated-backgrounds ; Checklists, Suggested Posts (2025-07-01) https://telegram.org/blog/checklists-suggested-posts ; Android Redesign (2026-02-09) https://telegram.org/blog/crafting-android-design-and-more ; Rich Text Editor, Communities (2026-07-14) https://telegram.org/blog/communities-editor-invisible-messages ; Saved Messages 2.0, read time https://telegram.org/blog/new-saved-messages-and-9-more ; Evolution timeline https://telegram.org/evolution
- Telegram API docs, mentions: https://core.telegram.org/api/mentions ; Premium limits: https://core.telegram.org/api/premium
- Apple Support: backgrounds https://support.apple.com/guide/iphone/add-backgrounds-iph605fa06e4/ios ; schedule https://support.apple.com/guide/iphone/schedule-text-messages-to-send-later-iph5ae9a7be6/ios ; reply https://support.apple.com/guide/iphone/send-and-reply-to-messages-iph82fb73ba3/ios and https://support.apple.com/en-us/104974 ; pins https://support.apple.com/en-us/104982 ; unknown senders https://support.apple.com/en-us/125068 and https://support.apple.com/guide/iphone/screen-and-filter-texts-iph203ab0be4/26/ios/26 ; notifications https://support.apple.com/en-us/108127 ; Tapbacks (Mac) https://support.apple.com/en-euro/guide/messages/react-with-tapbacks-icht504f698a/14.0/mac/15.0
- Signal: Polls (2025-11-19) https://signal.org/blog/polls/ ; Support, reactions https://support.signal.org/hc/articles/360039929972-Message-Reactions ; Support, colours https://support.signal.org/hc/en-us/articles/360007320951-How-do-I-change-colors- ; Support, group size https://support.signal.org/hc/articles/360007319331
- Discord: changelog (2025-03-25) https://discord.com/blog/discord-update-march-25-2025-changelog ; Squircles, Styles, and Spacing (2026) https://discord.com/blog/improving-mobile-with-squircles-styles-and-spacing ; Patch notes (2026-06-04) https://discord.com/blog/discord-patch-notes-june-4-2026 ; Support: Voice Messages https://support.discord.com/hc/en-us/articles/13091096725527-Voice-Messages , Polls FAQ https://support.discord.com/hc/en-us/articles/22163184112407-Polls-FAQ , Forwarding https://support.discord.com/hc/en-us/articles/24640649961367-Message-Forwarding , Super Reactions FAQ https://support.discord.com/hc/en-us/articles/12102061808663-Reactions-and-Super-Reactions-FAQ
- Slack Help: DMs https://slack.com/intl/en-gb/help/articles/212281468-What-is-a-direct-message ; one-click reactions https://slack.com/help/articles/360056881694 ; pause notifications https://slack.com/help/articles/214908388 ; all unreads https://slack.com/intl/en-fi/help/articles/226410907-View-all-your-unread-messages ; glossary https://slack.com/intl/en-fi/help/articles/213817348-Slack-glossary
- Snapchat Support: group chats https://help.snapchat.com/hc/en-us/articles/7012337635604-How-do-I-add-Snapchat-friends-to-a-Group-Chat ; edit https://help.snapchat.com/hc/en-us/articles/27270627813652-How-do-I-edit-a-Chat-message ; reply https://help.snapchat.com/hc/en-us/articles/7012338497172-How-do-I-reply-to-a-Snap-in-Chat
- Instagram Help, group size: https://help.instagram.com/411911025604515
- About Meta: Instagram DM updates (2024-03) https://about.fb.com/news/2024/03/instagram-dm-updates/ ; Messenger calling (2024-11-20) https://about.fb.com/news/2024/11/introducing-ai-backgrounds-noise-suppression-and-more-messenger-calling/ ; Meta AI at Connect (2024-09) https://about.fb.com/news/2024/09/metas-ai-product-news-connect/ ; Messenger group chats (2018-03) https://about.fb.com/news/2018/03/youre-in-charge-messenger-group-chats-are-now-better-than-ever/
- Beeper Help, Android inbox: https://help.beeper.com/en_US/android/beeper-android-how-does-inbox-work

**Third-party, 2026-10-10**
- WhatsApp: TechRadar redesign https://www.techradar.com/phones/whats-happened-to-whatsapp-a-big-redesign-is-rolling-out-now-heres-whats-new ; Tom's Guide https://www.tomsguide.com/computing/instant-messengers/whatsapp-drops-surprise-design-update-its-rounder-and-darker-now ; Gulf News themes https://gulfnews.com/technology/media/whatsapp-rolls-out-chat-themes-feature-what-it-is-how-to-use-it-and-more-1.500037150 ; 9to5Mac Liquid Glass (2026-05-15) https://9to5mac.com/2026/05/15/whatsapp-finally-starts-rolling-out-liquid-glass-more-broadly-on-ios/ ; WABetaInfo Liquid Glass https://wabetainfo.com/whatsapp-is-widely-rolling-out-the-full-liquid-glass-experience/ ; Ubergizmo (2026-09) https://www.ubergizmo.com/2026/09/whatsapp-for-ios-gets-full-liquid-glass-redesign/ ; WABetaInfo four pins https://wabetainfo.com/whatsapp-is-rolling-out-support-for-up-to-4-pinned-messages/ ; Android Police reactions https://www.androidpolice.com/how-to-use-whatsapp-message-reactions/ ; Technipages swipe https://www.technipages.com/whatsapp-reply-specific-message/ ; Tribune delete window https://www.tribuneindia.com/news/science-technology/whatsapp-now-lets-you-delete-messages-for-everyone-even-after-2-days-420326 ; Green-API group size https://green-api.com/en/docs/faq/why-are-members-not-being-added-to-the-group/ ; MacRumors threads https://macrumors.com/2025/07/09/whatsapp-testing-threaded-replies-on-ios/ ; Sammyfans requests folder https://www.sammyfans.com/2025/11/08/whatsapp-tests-new-requests-folder-feature-to-filter-unknown-messages/ ; says.com member tags https://says.com/my/tech/whatsapp-new-group-chat-features-member-tags-2026 ; BleepingComputer usernames https://bleepingcomputer.com/news/security/whatsapp-rolls-out-usernames-to-help-users-hide-their-phone-number
- Telegram: 9to5Mac Liquid Glass (2025-10-13) https://9to5mac.com/2025/10/13/telegram-adopts-a-liquid-glass-like-design-no-ios-26-required/ ; tginfo Premium limits https://tginfo.me/telegram-premium-en/ ; Releasebot https://releasebot.io/updates/telegram ; GSMArena reactions https://m.gsmarena.com/telegram_adds_reactions_spoilers_and_message_translation-news-52496.php ; bug tracker (double-tap) https://bugs.telegram.org/c/12966 , (reactions button) https://bugs.telegram.org/c/14245 , (greeting sticker) https://bugs.telegram.org/c/1569 ; Android Police gestures https://www.androidpolice.com/2020/06/15/5-telegram-gestures-and-shortcuts-you-should-be-using/ ; PhoneArena transcription https://www.phonearena.com/news/Telegram-expands-voice-transcription-to-free-users-and-adds-new-features_id153129
- Apple: 9to5Mac iOS 27 Messages (2026-09-17) https://9to5mac.com/2026/07/23/heres-everything-new-for-messages-in-ios-27/ ; ETV Bharat iOS 27 date https://www.etvbharat.com/en/technology/apple-confirms-ios-27-release-date-heres-when-it-lands-on-your-iphone-enn26091003097 ; Jang iOS 27 https://jang.com.pk/en/69759-apple-to-launch-ai-centric-messages-app-with-ios-27-news ; MacRumors text effects https://macrumors.com/how-to/use-new-text-effects-messages ; Michael Tsai iOS 26 notes https://mjtsai.com/blog/2025/06/10/ios-26-announced ; iPhone Life group size https://iphonelife.com/content/how-many-people-can-join-group-text-iphone-or-ipad
- Instagram: Business Today https://businesstoday.in/technology/news/story/instagram-unveils-new-dm-upgrades-music-translation-and-scheduling-added-465498-2025-02-21 ; Smartprix nicknames and stickers https://www.smartprix.com/bytes/instagram-adds-new-features-to-dms-300-new-emojis-nicknames-and-live-location-sharing/ ; Guiding Tech double-tap https://www.guidingtech.com/change-double-tap-or-default-reaction-on-instagram-messages/ ; Android Central Notes https://www.androidcentral.com/apps-software/instagram-notes-several-features-rollout ; onlinemarketing.de Liquid Glass https://onlinemarketing.de/social-media-marketing/liquid-glass-instagram-neue-navigationsleiste ; iGeneration https://www.igen.fr/app-store/2026/05/instagram-le-liquid-glass-arrive-doucement-la-version-ipad-remaniee-156005
- Messenger: Tech Advisor reactions https://www.techadvisor.com/article/742358/how-to-change-the-default-reaction-emoji-in-facebook-messenger.html ; Adweek quick reaction https://origin-wpe.adweek.com/media/facebook-messenger-heres-how-to-change-a-conversations-emoji/ ; Android Central E2EE default (2023-12) https://www.androidcentral.com/apps-software/messenger-e2ee-default-edit-messages
- Signal: Android Police wallpapers (2021) https://www.androidpolice.com/2021/01/28/signal-starts-catching-up-to-whatsapp-by-adding-custom-wallpapers-and-animated-stickers-apk-download/ ; AlternativeTo chat folders https://alternativeto.net/news/2024/12/signal-launches-chat-folders-feature-for-android-users ; TelecomTalk delete window https://telecomtalk.info/how-to-delete-messages-signal/343178/
- Snapchat: Digit, Simple Snapchat https://www.digit.in/news/apps/snapchat-unveils-a-new-3-tab-interface-ditches-5-tab-menu-know-more.html ; Net Influencer https://www.netinfluencer.com/simple-snapchat-simplified-interface-snap-partner-summit/
- Discord: community posts https://support.discord.com/hc/sv/community/posts/30928210948247-New-Discord-UI-March-2025 and https://support.discord.com/hc/vi/community/posts/26876293537175-The-quick-emoji-suggestions-in-the-hover-bar-are-very-distracting-and-cover-parts-of-the-text ; Android Authority mute https://www.androidauthority.com/block-mute-discord-3147814/ ; Outlook Respawn (2026-09) https://respawn.outlookindia.com/gaming/gaming-news/discord-september-2026-changelog-adds-new-features-and-fixes
- Slack: University of Michigan IT updates https://its.umich.edu/communication/collaboration/slack/support/updates
- LINE: Jetstream reactions (2025-05-29) https://jetstream.blog/2025/05/29/line-reaction-feature-expands-to-all-emojis/ ; Thairath edit trial https://en.thairath.co.th/lifestyle/tech/2954173 ; TechCrunch unsend https://techcrunch.com/?p=1577613
- KakaoTalk: Korea JoongAng Daily https://www.koreajoongangdaily.com/business/kakaotalk-updates-spark-user-backlash-over-interface-and-privacy/11927865 ; Korea Times https://www.koreatimes.co.kr/amp/business/tech-science/20250929/kakao-to-restore-kakaotalks-friends-list-after-widespread-complaints ; Asia Economy delete window https://view.asiae.co.kr/en/article/2025081311055213271 ; Digital Today reactions https://www.digitaltoday.co.kr/en/view/55676/kakao-kakaotalk-regular-update-expands-chat-bubble-reactions-to-114
- Beeper: AlternativeTo relaunch (2025-07) https://alternativeto.net/news/2025/7/beeper-relaunches-with-on-device-model-new-features-and-text-com-merged-services ; TechCrunch redesigned apps (2025-02-24) https://techcrunch.com/2025/02/24/automattic-owned-beeper-is-releasing-redesigned-desktop-and-ios-apps

**Realm document read:** `docs/research/2026-10-phase1-messaging.md`.
