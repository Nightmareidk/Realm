# Phase 1 research: Spaces, posts and feed, safety basics

Status: complete (first pass), 2026-10-04
Scope: ROADMAP Phase 1 "Communities", "Posts & feed" and "Safety basics". In user-facing copy a community is a **Space** and a channel is a **room**.
Dates: each source in the list at the end carries the date it was checked. Pages captured by the earlier, interrupted run were checked on 2026-10-02; everything added in this run was checked on 2026-10-04.

## Top recommendations (summary)

1. **Make a Space in one field.** Ask for a name and "Just us / Anyone" (default: private). Land in a working Space with `# general` and `▤ posts`, with the invite link already on screen. Reveal categories, custom roles and discovery as the Space grows (§5a). Steam and Discord show that the fastest flows skip setup; Discord's own onboarding guide admits newcomers "just leave" when overwhelmed [ST-chat][DC-create][DC-onboard].
2. **Keep the Discord-grade permission engine; hide the matrix.**
   - Each room asks only "Who can see it" and "Who can post".
   - The matrix uses words (*Allow / Deny / Same as Space*), not ✗ / ✓.
   - Rooms follow their category unless tagged "Custom access".
   - A **"Check access"** tool explains any person's result with a "because" line from the shared resolver.
   Discord's overwrite order and "allow beats deny between roles" rule are what confuse people [DC-dev-perm][DC-permfaq].
3. **Private stays private.** No private→public switch in Phase 1. Facebook needed a 3-day review window and "past content stays private" to do it safely [META-groups-2025].
4. **Invites:** 7 days and unlimited uses by default, with a short list of other options. A server-rendered `/i/{code}` page shows the Space, who invited you, live counts and the first rules, with one "Join Space" action. Invites can be paused during a raid [DC-invites][DC-raids].
5. **Moderation that explains itself.**
   - Timeout uses Discord's six durations.
   - Kick and ban take a reason picked from the Space's own rules.
   - The affected person always gets a statement of reasons (DSA Art. 17).
   - The activity log is written in plain sentences and kept at least a year (Discord keeps 45 days) [DC-timeout][DC-audit][DSA].
6. **Feed = For you · Following · Spaces.**
   - Every For you item carries a one-line *true* reason taken from the ranking terms.
   - A "Why am I seeing this?" sheet gives the plain formula and controls.
   - Feeds have real stopping points ("You're caught up", "That's today's picks"), with no autoplay and no auto-insert.
   This answers the front-page promise and the patterns the EU named against TikTok on 6 Feb 2026 [EC-TikTok][DSA Art. 27][TT-why][META-why].
7. **Threads:** per-comment collapse, "Collapse all / Expand all", named sorts with one-line explanations, no public downvote count, an optional "hide scores for the first hour", and depth 8 then "Continue this thread" [LM-thread][TL-topic][RD-settings][HN-faq].
8. **Report from every item's More menu** in three short steps. Realm snapshots the evidence itself. The confirmation says *who* will read it (Space mods or Realm's safety team) and offers Block, Mute and Leave. Reporters get a "Your reports" status list [DC-report][RD-report][DSA Art. 16]. Add a `community_rule` report reason.
9. **Mute and block are explained as "what you stop seeing / what they can't do".** Both lists stay private (Bluesky's blocks are public [EFF-bsky]). Teen accounts get Discord-style defaults now: message requests on, a stranger-friend warning, a limited profile audience, no adding to groups without consent [DC-teen][EC-Art28].
10. **Limit reach, not friendship.**
    - Rate limits and new-account limits fall on DMs to strangers, mass mentions, links in public boards and public Space creation, never on chatting where you were invited.
    - Every limit says when it lifts.
    - Spaces get Discord-like "Who can post" levels, a Reddit-like new-member filter, slowmode and pause invites [DC-verif][RD-crowd].
11. **The mod queue shows context, history and claims.** Each item shows the surrounding conversation, the author's Space history and past actions. A live "Noor is reviewing" claim prevents collisions (74.5% of surveyed Reddit mods had them). Items stay open until "Done" [ARXIV-modqueue][RD-modqueue].

**Inconsistencies found in the project docs (need an owner decision):**
- Feed tab names differ across ROADMAP (Home / Following / Communities), ARCHITECTURE §5.7 (Following / Communities / Home blend) and UX-ARCHITECTURE (Following / For you). Proposal in §5b.
- ROADMAP puts "invite links with rich previews" in Phase 3, but Phase 1 needs an invite page to join at all. Proposal: build the page now, with cheap OG tags.
- `reports.reason` has no value for "breaks this Space's rule".
- UX-ARCHITECTURE still describes the old visual world (aurora inks, lime accent, Unbounded, "Atlas"), which DESIGN.md has replaced. Space colours should come from the four theme palettes.
- Legal scope: DSA Arts. 19–28 (including 25, 27 and 28) exempt micro and small enterprises, but Arts. 16–17 (notice and action, statement of reasons) apply to Realm now [DSA].

## 1. Spaces

How to read citations: a key in square brackets, such as [DC-invites], points to the Sources list at the end, which gives the URL and the date it was checked. Captures sit in `docs/research/phase1-captures/spaces-feed-safety/`. "Inference" marks my own reading of the evidence rather than something a source says.

### 1.1 Creating a community

- **Discord.** "Add a Server" opens a choice between a blank server and a template, then an optional question ("for a club or community" or "for me and my friends") that "you can always skip", then a name and icon, then Create; the help page's last step is "send your friends an invitation" [DC-create]. Discord quietly runs two products: "Friend Servers" and "Community Servers". Forum channels, onboarding and the in-list Members page need Community switched on [DC-forum][DC-members][DC-verif].
- **Reddit.** The name "cannot be changed once created, including capitalization" [RD-create]. There are three types: public, restricted (anyone can read, only approved people post) and private. Changing the type after creation "you'll need to submit a request" [RD-settings]. The 500-character description is the only thing shown for a private community, so Reddit advises using it to say how to get an invite [RD-settings]. Reddit also keeps two separate switches: whether the community appears in r/all and trending lists, and whether Reddit may "promote" it. It warns that support communities may want to stay small [RD-settings].
- **Facebook Groups.** Public and private groups differ in who can see posts, see members and join without approval. A public group can't go private once it has 10,000+ members and is 30+ days old [FB-privacy]. Since November 2025, a private group can go public, with safeguards. All admins are notified. Any admin can cancel during a three-day review window. Everything posted while the group was private stays visible only to people who were members then. The member list becomes visible to admins only. Members are notified, and see a reminder the first time they post publicly [META-groups-2025].
- **Circle.** Each space inside a community is Open, Private or Secret. Private spaces can show a lock icon and their own landing page to non-members. Hiding a space from the sidebar doesn't stop its URL working [CI-space][CI-private].
- **Slack.** The person who creates a channel automatically becomes its channel manager. Managers can restrict posting and member actions per channel, and a channel can have up to 100 of them [SL-managers]. Org-wide "system roles", such as Channels admin and Roles admin, sit above that [SL-roles]. This is a simple *per-place* model, not a permission matrix.
- **Telegram.** Topics were added on 5 Nov 2022 and are "intended specifically for large groups". Each topic is its own chat with its own media and notification settings. Admins switch topics on and control who may create them; Telegram promised "a different set of tools, tailored to small groups" [TG-topics]. In other words, small groups stay one flat chat and structure is opt-in.
- **Steam.** Any ad-hoc chat can be saved "with a title and avatar" so it becomes a persistent group. It's "one click to create a channel, one click to join, and one click to leave". Invite links open in the Steam client or a web browser [ST-chat]. This is the strongest model for a friend group: the group exists before anyone sets it up.
- **Guilded and Geneva (cautionary).** Guilded's gaming-focused Discord rival was shut down at the end of 2025 [GU-wiki]. Geneva was folded into Bumble BFF in September 2025, after Bumble said Geneva "had not generated any revenue" [TC-geneva]. Neither has a living product to copy. Guilded's archived help is still useful for its permission pitfalls (§1.3).

### 1.2 Invites and rich previews

- **Discord invites** last 7 days by default. You can change how long a link lasts (down to 30 minutes, or forever in a Community server) and how many times it can be used. There's also an option to "grant temporary membership". Invites can be **paused** during a raid, and a deleted code "can not be remade" [DC-invites][DC-raids]. Moderators can filter members by **join method** (which invite code, Discovery, vanity URL) [DC-members].
- **The Discord invite page** (capture `discord-invite-preview.jpg`) shows the icon, "You've been invited to join", the name with a verified badge, live online and member counts, and the server banner as the page background. A logged-out visitor gets sign-up (display name and date of birth) right on the same card.
- **Telegram invite links** can have an expiry date, a use limit, a **title** and "request needed" (admin approval). Each join records who approved it, and admins get a live count of pending requests. For large groups a link can return a *peek*, so a non-member can read recent messages until it expires [TG-invites].
- **Discord Discovery** (captures `discord-discovery*.jpg`) lists categories with counts, a search box and cards. Each card has a banner, icon, name, one-line description, a "Verified" chip and online/member counts. A footnote admits that "Member counts may be up to one week out of date" [DC-discovery].

### 1.3 Roles, permissions and channel overwrites

**Discord's model (the one Realm's engine already copies, per ARCHITECTURE §5.2).** `@everyone` sets the base. Role permissions are OR'd together. Channel overwrites then apply in a fixed order: @everyone deny, then @everyone allow, then role denies, then role allows, then member deny, then member allow. ADMINISTRATOR bypasses everything [DC-dev-perm]. Two rules surprise people:

1. Role *position* doesn't decide overwrite conflicts: "A denies VIEW_CHANNEL… B allows… The user would ultimately be able to view the channel, regardless of the role positions" [DC-dev-perm].
2. Channels are "synced" or "not synced" with their category. Change one permission on a channel and it silently stops following the category [DC-permfaq].

The UI shows each permission as a three-state switch drawn as ✗, / and ✓ [DC-chperm] (capture `discord-help-channel-permissions-101.jpg`).

**Evidence of confusion.**
- Discord's own onboarding guide says newcomers feel "cannon-blasted into a strange, foreign land", ask "Why are there so many channels?!", don't understand "what roles do", and "they just leave" [DC-onboard].
- Discord has had to add a "View Server As Role" tool, which its help centre lists next to the permission articles [DC-chperm].
- Reader ratings on the help pages are weak. "Setting Up Permissions FAQ": 29,473 of 48,816 found it helpful (60%). "Channel Permissions Settings 101": 270 of 606 (45%). "Invites 101": 3,925 of 7,450 (53%) [DC-permfaq][DC-chperm][DC-invites]. *Inference:* roughly 4 in 10 readers looking for help with permissions didn't get it.
- Discord's community forum has a user thread titled "Fix the hierarchy of role permissions so they work again" [DC-community-post] (title only; not opened).

**Simpler models.**
- **Guilded** (archived) had an owner with everything, a default Member role and "no separate built-in admin role". It offered one-click "turn on/off all permissions for a role", Ctrl-click to toggle a whole section, and Clone role. It still warned that category permissions override server ones and that "you may lock those roles out" [GU-perm][GU-chperm].
- **Reddit's** mod permissions come in a few plain groups ("Everything", Manage users, Manage settings, Manage posts & comments, Mod mail and so on). A mod can only remove or edit mods *below* them in the list. Every mod, even one with no permissions, can read the mod log [RD-modperm].
- **Slack** and **Circle** avoid overwrites entirely: access is per place (channel manager; Open, Private or Secret) [SL-managers][CI-space].

*Inference:* the matrix is not the problem. Showing it first is. The engine can stay Discord-grade while the UI answers two questions per room, "who can see it" and "who can post", with an "explain this person's access" tool for the hard cases.

### 1.4 Member lists and moderation actions

- **Timeout (Discord).** The durations are 60 s, 5 min, 10 min, 1 h, 1 day and 1 week. Timeout is always Space-wide. The reason is written to the audit log. A timed-out person can still read but can't send, react or join voice. Only mods see the timeout icon [DC-timeout].
- **Audit log (Discord).** Viewing it needs its own permission. Each entry has a reason of 1–512 characters. Entries are kept for **45 days** [DC-audit].
- **Members page (Discord).** It shows join date, join method and whether someone accepted the rules, plus "signals": unusual DM activity, suspected spam, timed out, quarantined by AutoMod. There's bulk ban, which "require[s] [you] to enter their 2FA code or password", and an experimental "Mod View" with a member's message history [DC-members].
- **Lemmy** puts the community's rules, its visibility ("Public") and a public **Modlog** link in the sidebar of every post (capture `lemmy-ml-thread.jpg`) [LM-thread].

### 1.5 A friend group's Space in under a minute, and how it scales

The fastest real flows are Steam's (promote an existing chat to a group) and Discord's (template, which you can skip, then name, create and invite) [ST-chat][DC-create]. Each scaling tool turns up only when it's needed:
- Telegram topics only for large groups [TG-topics];
- Discord onboarding only for Community servers, with at least 5 public channels [DC-onboard];
- Reddit Crowd Control for when a post goes viral [RD-crowd].

*Inference for Realm:* create with **one field (the name)** and a privacy choice that defaults to private. Land straight in a working Space with a chat room and a board, invite link already on screen. Then reveal categories, custom roles, onboarding questions and discovery as the Space grows (UX-ARCHITECTURE principle 3: "simple by default, deep on demand").

## 2. Boards and posts

### 2.1 Post anatomy and threads

- **Lemmy** (capture `lemmy-ml-thread.jpg`). The post sits above the comments. Comment sorts are *Hot, Top, Controversial, New, Old* plus a flat *Chat* view. Each comment has a collapse control, author@instance, a link icon, **separate up and down counts** (for example ↑111 ↓1) and its age. Replies are indented with left rails. The sidebar carries rules, visibility and a public Modlog link [LM-thread]. The sorts are documented in plain words: *Active* (score plus time of latest comment, with decay), *Hot* (like Active but by publish time), *Scaled* ("gives a boost to less active communities"), *Controversial* [LM-ranking].
- **Hacker News** (capture `hn-thread-nested.jpg`). The FAQ says ranking "divides points by a power of the time since a story was submitted", and that comments rank the same way. Other factors include flags, anti-abuse software and "software which demotes overheated discussions". Stories have no down arrows. Comments get them only after a karma threshold, and never on direct replies to you. Downvoted comments fade. [flagged] and [dead] are shown, and users can "vouch" to bring a post back. Threads close to new comments after two weeks. New accounts show in green [HN-faq].
- **Tildes** (captures `tildes-games-listing.jpg`, `tildes-topic-thread.jpg`). The topic list sorts by *Activity, Votes, Comments, New*, with time windows from "last 1 hour" to "all time". Each topic shows its type ("Text", "Ask"), word count, comment count and vote count, with no downvote count. A thread opens with "**Collapse replies / Expand all**" and "Comments sorted by relevance", and marks the author "(OP)" [TL-games][TL-topic].
- **Discord forum channels.** Each post is its own thread, with optional **required tags**, written post guidelines, a *List* or *Gallery* layout and search. Inactive posts move to "Older Posts" automatically. Forums need Community switched on [DC-forum].
- **Reddit (settings that shape threads).** Mods can set the default comment sort. They can **hide comment scores for up to 24 hours** ("to encourage redditors to focus on the content before being swayed by its karma score"). They can collapse deleted and removed comments by default [RD-settings].
- **Bluesky and Threads threads** were not captured this round. The Bluesky docs host returned a certificate error on 2026-10-04. Treat them as a gap. *Inference:* their reply trees are shallow by design, which suits a profile feed more than a board.

*Takeaways for Realm:*
- Collapse per comment plus "collapse all" are table stakes.
- Name the sorts and explain each one.
- Don't show a separate downvote count.
- Let a Space hide scores for a while.
- Close or lock old threads instead of letting them rot.
- Mark the post's author in the thread.

### 2.2 Link previews, saves and sharing

- All four boards above render link posts as a title plus domain. Image posts render inline (Lemmy captures).
- Realm's `posts.link_url` and the media pipeline (ARCHITECTURE §5.6) let a worker fetch the page's title, site and image server-side. That avoids client-side scraping and leaking the reader's IP to the linked site (*inference*).
- Saves are private on every product checked here (*inference from the absence of any public "saved" views*). DATA-MODEL already has a private `saves` table.

### 2.3 Infinite scroll and natural stopping points

- **EU, 6 Feb 2026.** The European Commission preliminarily found TikTok in breach of the DSA for "addictive design". It cited infinite scroll, autoplay, push notifications and a highly personalised recommender, said these features shift users' brains "into 'autopilot mode'", and pointed to measures such as disabling infinite scroll over time, screen-time breaks (including at night) and changing the recommender [EC-TikTok].
- **EU, 14 Jul 2025.** The Commission's Art. 28 guidelines on minors recommend switching off by default "features that contribute to excessive use, like communication 'streaks,' ephemeral content, 'read receipts,' autoplay, or push notifications". They also ask platforms to "prioritise explicit signals from children over behavioural signals". The guidelines don't apply to micro and small enterprises [EC-Art28].
- **US states (secondary sources, not checked against the statutes):**
  - New York's SAFE for Kids Act rules were finalised on 28 Jul 2026 and take effect in January 2027. They restrict algorithmic feeds and overnight notifications for minors without parental consent [NY1-SAFE].
  - California's SB 976 targets "addictive feeds" for minors; parts of it remain enjoined [AVPA-states].
  - Virginia's SB 854 one-hour default for under-16s was preliminarily enjoined on 27 Feb 2026 [AVPA-states].
  Have counsel confirm all three before launch.
- **Long-standing self-limits.** Hacker News's "noprocrast" setting limits visits to 20 minutes at a time with 3 hours away by default [HN-faq].

*Takeaway:* chronological feeds already have a natural end, the last thing you saw. Ranked feeds need an artificial one. Realm can make both explicit (§5b) and stay well clear of the patterns regulators now name.

### 2.4 Explainable recommendations

- **Bluesky** made the feed itself a choice. Users get "a few default feeds" and can install others from "an open marketplace of feeds", "instead of using a black box algorithm that leaves users guessing how posts are ranked" [BS-feeds].
- **TikTok** added "Why this video" on 20 Dec 2022. It lists reasons such as "user interactions, such as content you watch, like or share" [TT-why].
- **Meta** (29 Jun 2023) published 22 "system cards" for Facebook and Instagram and expanded "Why Am I Seeing This?" to Instagram Reels and Explore. It also pointed to "Show more, Show less" controls and a non-ranked feed option [META-why].
- **The EU DSA Art. 27** says platforms using recommender systems must set out "in plain and intelligible language, the main parameters" and "why certain information is suggested". Where there are several ranking options, a way to switch must be "directly and easily accessible from the specific section of the online platform's online interface where the information is being prioritised" [DSA].
- **Scope caveat.** Art. 19 exempts micro and small enterprises from Section 3 (Arts. 19–28, except 24(3)) [DSA]. *Inference:* Realm probably isn't legally bound by Arts. 25, 27 or 28 yet. Its front-page promise ("For you says why it picked each one") holds it to the same standard anyway, and growth ends the exemption.

*Takeaway:* the honest version of "why this" is cheap for Realm, because Phase 1 ranking is a formula (ARCHITECTURE §5.7: followed people, joined Spaces, hot rank). Each reason shown can be a direct readout of the terms that scored the item. Nothing has to be explained after the fact.

## 3. Safety

### 3.1 Report flows and categories

- **Discord** (capture `discord-safety-reporting.jpg`; page last updated 22 Jan 2026).
  - Flow: right-click or long-press → pick a broad violation type → a second screen for the specific policy. "You can always click back and change your first answer". Profile reports let you pick several parts of the profile at once.
  - Discord points people to the server's own moderators and to ignore/block.
  - It warns against false reports, duplicate reports and "ask[ing] a group of users to report the same content".
  - It lists crisis resources (Crisis Text Line in the US, ThroughLine elsewhere).
  - Review targets: "High harm" (child safety, extremism, imminent harm) within 24–48 hours; "Lower harm" (harassment, hate speech) within a week; complex cases days to weeks.
  - "We will let you know if we identified a violation". The reporter's identity is never shared with the reported account "unless we are legally required to do so".
  - EU DSA reports need a message URL and get a system DM or email confirmation [DC-report].
- **Reddit** lets you report posts, comments, messages, or parts of a profile (username, display name, picture, banner, bio). A reported message is deleted from your inbox. The page suggests blocking or turning off messages, and links to Crisis Text Line [RD-report].
- **Bluesky's** moderation is "stackable".
  - Everyone is subscribed to Bluesky's own moderation service by default and can add independent ones. Moderation services "can also accept reports". Ozone, Bluesky's open-source tool, gives a team "a reporting queue" [BS-stack].
  - Labels carry a severity (*alert*, *inform*, *none*), and each user chooses *hide*, *warn* or *ignore* per label. Clients must not send reports to a labeler that doesn't accept that subject or reason type [BS-docs].
  - Ozone's queue actions include Acknowledge, Escalate, Label, Tag and a queue "Mute" [OZ-guide] (search summary; not opened).
- **Realm's schema** already has a good reason list (`spam, harassment, hate, sexual_minors, violence, self_harm, impersonation, ip, other`) and per-Space routing (`community_id`). The one gap is "breaks this Space's own rule" (§5c).

### 3.2 What happens after a report, and to the reported person

- **DSA Art. 16** requires notice mechanisms that are "easy to access and user-friendly". The provider must confirm receipt "without undue delay" and tell the notifier its decision, "providing information on the possibilities for redress" [DSA].
- **DSA Art. 17** requires "a clear and specific statement of reasons" to the affected user for removals, demotions and suspensions [DSA]. Arts. 16–17 sit outside the small-enterprise exemption, so they apply to Realm from day one (*inference from the structure of the Regulation*).
- **Discord's warning system** is a good model for the affected person.
  - A system DM card summarises the violation and links to the policy.
  - An **Account Standing** page shows *All good / Limited / Very limited / At risk / Suspended*.
  - Most violations expire after 90 days.
  - Restrictions are proportionate (for example losing image posting for hours or days).
  - A suspended user can still log in to see why and ask for a review [DC-warn].

### 3.3 Block vs mute vs restrict

- **Instagram Restrict:**
  - the restricted person's new comments are visible only to them until you approve;
  - they can't see when you're online or have read their messages;
  - their chat moves to Message requests;
  - you get no notifications from them [IG-restrict].
- **Discord Ignore** hides someone's messages and notifications from you without unfriending or alerting them; block is the hard boundary (secondary reports [DC-ignore]).
- **Bluesky** keeps the list of muted accounts private, but "your Blocked accounts are public" [EFF-bsky].
- **Realm's schema** has `relationships.type = blocked`, which removes the reverse friendship, and a `mutes` table with an optional `until`.

*Takeaways:*
- Explain each control as what *you* stop seeing and what *they* can no longer do.
- Keep both lists private.
- Restrict can follow in Phase 2.

### 3.4 Teen protections (Realm is 13+)

- **Discord's teen age group (13–17)**, from the help page checked 2026-10-02:
  - sensitive media blurred or blocked;
  - age-restricted servers and channels blocked;
  - **message requests on**, and a teen can't turn them off;
  - a friend-request alert for "unfamiliar users", meaning no mutual friends and no shared server under 200 members;
  - profile and activity visible only to friends and small servers;
  - speaking in Stage channels blocked [DC-teen].
  On 25 Sep 2026 Discord began placing users into age groups automatically "using account signals… we don't look at your messages". It says "more than 90%" of users won't be asked to confirm their age, and notes it has launched age assurance in Texas and Brazil, with the UK and Australia handled separately [DC-blog-teen].
- **UK Online Safety Act.** Ofcom's Protection of Children Codes came into force on **25 Jul 2025**, with children's risk assessments due by 24 Jul 2025. Services with a recommender system and a medium or high risk of harmful content must filter the most harmful content out of children's feeds [WC-ofcom]. Ofcom's own page was behind a bot check on 2026-10-04, so this rests on a law-firm summary.
- **EU DSA Art. 28.** Platforms "accessible to minors" must ensure "a high level of privacy, safety, and security of minors". They may not show profiling-based ads to known minors, and aren't required to collect extra data to find minors [DSA]. The **14 Jul 2025 guidelines** add:
  - private-by-default accounts for minors;
  - the ability to block and mute any user;
  - **no adding children to groups without their explicit consent**;
  - excessive-use features off by default;
  - prompt feedback on reports.
  Micro and small enterprises are exempt [EC-Art28].
- **US.** COPPA sets Realm's 13+ floor (ARCHITECTURE §10). The state laws in §2.3 add feed and notification limits for minors, several of them tied up in court.

*Inference:* Discord's teen defaults overlap almost one-to-one with the EU guidelines and the Ofcom codes. Copying them for every account under 18 now is cheaper than retrofitting them per region in Phase 2.

### 3.5 Rate limits and new-account friction that doesn't punish real people

- **Discord verification levels:** *None* ("better suited for private servers amongst your buddies"), *Low* (verified email), *Medium* (email verified for more than 5 minutes), *High* (also a server member for more than 10 minutes), *Highest* (verified phone). "Having a verified phone number supersedes all other requirements" [DC-verif].
- **Discord's raid tools:**
  - AutoMod mention-spam limits;
  - removing @everyone mentions from ordinary roles;
  - **pause invites**;
  - slowmode;
  - an automatic CAPTCHA for new joiners for an hour after a detected raid [DC-raids].
- **Reddit Crowd Control** collapses or holds comments, and holds posts, from people "who aren't trusted members within their community yet". It has three levels: negative community karma; plus new accounts; plus non-members [RD-crowd].
- **Hacker News** gates downvotes, flags and vouches behind karma thresholds and marks new accounts in green [HN-faq].
- **Discord's Members page** flags "Unusual DM Activity", meaning many DMs to non-friend server members [DC-members].

*Takeaway:* every one of these targets **reach**: strangers, mass mentions, links, DMs to non-friends, joining many places at once. None of them targets talking inside a group you were invited into. That's the line for Realm (§5c).

### 3.6 Mod queue design

- **Reddit's queue** ("Needs Review") gathers user reports and filtered posts and comments.
  - Actions: approve, remove, spam, lock, copy link, and "ignore reports and approve".
  - Filters by type; sorts by oldest, newest and most reported; card or compact view; bulk actions.
  - In card view, other mods see in real time who acted.
  - Removal reasons come from saved responses, and machine-learning suggestions now propose one [RD-modqueue][RD-saved].
- **The modqueue study** (arXiv 2509.07314, 9 Sep 2025; 110 mods covering 400+ subreddits) found:
  - mods leave the queue to see **surrounding conversation**, the **user's history** and **prior mod actions**;
  - **74.5%** had experienced a collision with another mod on the same item;
  - items "disappear before mods are fully done with them" when a case needs several steps;
  - sort-by-reports "didn't actually work well";
  - mods juggle "too many interfaces" [ARXIV-modqueue].

## 4. Accessibility and honesty

### 4.1 Accessible vote, collapse and report controls

The W3C pattern pages (WAI-ARIA Authoring Practices) were behind a bot check on 2026-10-04 and weren't fetched. The points below come from the WCAG 2.2 and WAI-ARIA 1.2 specifications as I know them; check them against [WCAG22] and [ARIA12].
- **Vote and like** are toggle buttons with `aria-pressed`. The accessible name includes the count and state, for example "Upvote, 14 points, pressed". Up and down are two separate buttons in one labelled group, and the score is not a third focus stop.
- **Count changes** from other people update silently. Only the person's own action is announced, through a polite live region ("Upvoted"). This avoids a stream of announcements in a busy thread, in line with WCAG 4.1.3 Status Messages.
- **Collapse** buttons use `aria-expanded` and say what they hide ("Collapse Noor's comment and 4 replies"). The thread is a list of lists, so screen readers announce nesting depth for free.
- **Targets:** WCAG 2.2's 2.5.8 sets a floor of 24×24 CSS px. UX-ARCHITECTURE already sets 44 px on touch, which is better. Keep it for vote, collapse and More.
- **Report and block sheets:** focus moves into the sheet and comes back to the button that opened it. Every step has a visible heading. Choices are radio rows, not icon tiles. Nothing requires dragging (WCAG 2.5.7).
- **Colour never carries meaning alone.** "Removed", "Locked", "New account" and "Custom access" are words on dark pills (DESIGN.md tag style), not a red or amber tint.
- **Keyboard (UX-ARCHITECTURE: "chat is keyboard-heavy").** In a thread: `J`/`K` next and previous item, `Enter` open, `[`/`]` collapse and expand, `.` opens More. Every shortcut is listed in Travel. *(start)*

### 4.2 Plain-language rules

- **DSA Art. 14** requires terms and moderation rules in clear, plain, intelligible language. Where a service is used mainly by minors, the provider must explain its conditions "in a way that minors can understand" [DSA].
- Discord's onboarding advice is to keep answer options "short and sweet" and not to offer too many [DC-onboard]. Reddit caps a community's description at 500 characters [RD-settings].

For Realm:
- Space rules are a list of **title plus one-sentence body** (the schema already stores `{title, body}`). Cap it at *(start)* 10 rules of 100 characters each for the body shown on the invite page.
- The same rule titles are the report choices, the removal reasons and the timeout banner text. A member meets each rule in exactly one wording.

### 4.3 No dark patterns (DSA Art. 25)

**Art. 25** bans interfaces that "deceive or manipulate" or "materially distort or impair" free and informed decisions. It names three practices: giving one choice more prominence, asking repeatedly after a choice is made, and making termination harder than signing up [DSA]. (The small-enterprise exemption applies, §2.4, but the standard is right.) Concretely:
- **Leaving a Space is as easy as joining:** one item in the Space menu, one confirm, no "Are you sure? Your friends will miss you".
- **Mute, block and report are never ranked against each other** with colour. All are ghost pills, and the destructive action wording is literal.
- **The "Why this" sheet's "Switch to Following"** gets the same visual weight as "Show fewer".
- **Notification and "Show in Explore" prompts** are asked once, and "Not now" is remembered.
- **No fake urgency or social proof:** member counts and "here now" are live or dated (§5a). Never round up.
- **Labels are honest.** Spaces and posts are "not end-to-end encrypted" (PRODUCT.md). A report confirmation says who will read it. A limit says when it lifts.

## 5. Recommendations for Realm

These are Phase 1 specs. They follow DESIGN.md:
- one action colour per screen (the theme's `--acc`);
- full pills for anything you press or read as a status;
- ruled rows instead of card grids;
- Funnel Display only for statements and names, Atkinson for everything read;
- hairline inset rings and black shadows only;
- the Presence dot only for "here now".

They also follow the five-destination dock (Home, Spaces, Messages, Feed, Explore) and UX-ARCHITECTURE's levels: settings and tools sit at level 4, shown only to people who can use them. Numbers marked *(start)* are proposed starting values to tune, not findings.

### 5a. Spaces: create, join, roles, invites, moderation, audit log

**Create a Space (target: under 30 seconds)**
1. Entry points: `+` Create → "Space"; the Spaces destination's "New Space" pill; Travel ("new space").
2. A sheet asks two things:
   - **Name** (2–64 characters).
   - **"Who's it for?"** as two large radio rows: "**Just us**: private, people join with an invite" (default) and "**Anyone**: public, people can find it in Explore".
   - Optionally, a Space colour from the four theme palettes (Mint, Orchid, Aqua, Ember) for its badge and header light. *Note:* UX-ARCHITECTURE still says "aurora inks"; that's the old world and needs updating.
   - The slug is made from the name, can be edited later, and old slugs redirect *(start: 30 days)*. Don't copy Reddit's "can never be renamed" [RD-create].
3. **Create** (the one action pill). You land in the Space with two rooms already made, `# general` (chat) and `▤ posts` (board), the Here now panel showing you, and the **invite sheet already open** (below). The empty states teach (UX-ARCHITECTURE rule 5): "Say hi in #general", "Post the first thing in #posts".
4. Templates (Gaming squad, Study group, Club) can be an optional third step later. Discord lets you skip its template step [DC-create]; Realm shouldn't make anyone choose one.

**Public and private**
- Map the UI choice onto the schema like this: *private* = `visibility=private, join_policy=invite`; *public* = `visibility=public, join_policy=open`. `request` waits for Phase 2 (`join_requests` is P2 in DATA-MODEL).
- Keep **"Show in Explore"** as a separate switch from "public", off until the Space has rules and *(start)* at least 5 members. Reddit separates these two decisions, and so should Realm [RD-settings].
- **Public → private:** allowed at any time.
- **Private → public: not in Phase 1.** Offer "Make a public Space" instead. Facebook needed a three-day review window, notices to every admin and member, and "past content stays private" to do this safely [META-groups-2025]. That is the Phase 2 design if it's wanted. Flipping a friend group's history public without it would break "Private means private".
- Spaces are never end-to-end encrypted. The Space settings privacy line should say so plainly ("Space rooms aren't end-to-end encrypted") to match PRODUCT.md's encryption truth.

**Invites**
- The **invite sheet** (from the Space header's Invite pill, or right after creation) has:
  - the link with a Copy pill;
  - "Send to…" (friends and recent DMs, which sends a DM card);
  - the device share sheet on phones;
  - one quiet "Link settings" row: lasts *30 min / 1 h / 1 day / 7 days (default) / never*; uses *1 / 5 / 10 / 25 / no limit (default)*.
  - These defaults match Discord's 7 days [DC-invites]; the schema already has `max_uses`, `expires_at` and `revoked_at`.
- **The invite page** `/i/{code}`, for everyone, signed in or not, rendered on the server:
  - Space badge and name (Funnel), one-line description, member count, "N here now" with the Presence dot, **who invited you** (avatar and name), and the first three rule titles;
  - one action pill, "**Join Space**" (logged out: "**Sign up to join**", which joins automatically after verification and lands in `#general`), and a ghost "Not now".
  - A private Space shows no member list and no content before joining.
  - Dead links say what happened in plain words: "This invite has expired. Ask {inviter} for a new one."
  - Add Open Graph tags (name, description, badge) so links unfurl in other apps. ROADMAP puts "invite links with rich previews" in Phase 3, but the page has to exist in Phase 1 for joining to work, and the tags cost little (owner's call).
- **Invites list** in Space settings: ruled rows (code, made by, uses/limit, expires, a Revoke pill). There's a **Pause invites** switch for raids [DC-raids]. Members can be filtered by the invite they used [DC-members].

**Explore → Spaces (basic discovery)**
- Ruled rows, not a card grid. Each row has the badge, name, one-line description, topic chips, members, and "N here now" or "active today".
- Sorts: *Active now*, *New*, *Most members*. Each sort explains itself in its menu ("Active now: most people here in the last hour").
- Every row says why it's listed ("Public · 1.2k members · active today"). Discord's discovery has to warn that its counts can be a week out of date [DC-discovery]; Realm's counts should be live or say how old they are.

**Rooms and categories**
- Room tabs work as UX-ARCHITECTURE says. Categories exist only inside the "All rooms" sheet.
- Creating a room: name; type (*Chat* or *Board*); "**Who can see it**": *Everyone in the Space* (default) / *Only some roles*… ; "**Who can post**": *Everyone who can see it* (default) / *Only some roles*…
- These two questions write channel overwrites underneath. Most people never see the matrix.

**Roles and permissions UI**
- **Starter roles:** *Owner* (a flag, not a role), *Mods* and *Everyone* (`@everyone`, always shown as "Everyone"). Friend groups need nothing else.
- **Role editor** (Space settings → Roles):
  - name, colour, "Show separately in Here now" (`hoist`) and "Can be @mentioned";
  - permissions in **five plain groups** of at most seven switches each: *Space*, *Rooms*, *Members*, *Moderation*, *Advanced*;
  - Guilded-style "Turn all on/off" per group [GU-perm], and Clone role.
- **Dangerous permissions** carry a one-line plain warning in Ink 2, not a red badge. ADMINISTRATOR is labelled "**Full control**: ignores every room rule". Owners can only grant permissions they hold, and can only edit roles below their own highest role [DC-dev-perm][RD-modperm].
- **Room access** (room settings → Access): the two questions above. "Customise…" opens the matrix. The matrix uses **words, not glyphs**: *Allow / Deny / Same as Space* per permission per role or person, instead of Discord's ✗ / ✓ [DC-chperm].
- **Category inheritance:** a room follows its category unless it has been customised. Customised rooms carry a "Custom access" tag in the All rooms sheet, with a "Match category" action. This replaces Discord's silent "not synced" state [DC-permfaq].
- **"Check access"** (the key piece). Pick a person or role and see, for each room, *can see / can post / can moderate*, with a "because" line built from the shared resolver in `contracts` (ARCHITECTURE §5.2). For example: "Can't post in #announcements because *Everyone* is denied **Post** there." Discord's overwrite order and its "allow beats deny between roles" rule [DC-dev-perm] become something you can read, not puzzle out.

**Moderation actions**
- **Where:** the item's "More" menu, the profile peek opened from Here now or a message, and the Members list in Space settings. The Members list is ruled rows with joined date, join method, roles, a timeout/ban state and search, per Discord's Members page [DC-members]. Only people with the matching permission see these.
- **Timeout:** 60 s, 5 min, 10 min, 1 h, 1 day, 1 week [DC-timeout]. The person can read but can't post, react, vote or comment. They see a plain banner: "You're timed out in {Space} until 21:40 · Rule 2: No spoilers".
- **Remove from Space (kick):** a confirm sheet with an optional reason.
- **Ban:** a reason (the Space's rules as choices, plus "Other"), an optional "Also delete their last *1 h / 24 h / 7 days* of messages", and an optional expiry. `bans.expires_at` exists.
- **Statements of reasons:** every action tells the affected person what happened, which rule, who acted ("{Space} mods", never a named mod), how long, and how to ask for a review. That follows DSA Art. 17's statement of reasons [DSA] and Discord's warning-system DMs [DC-warn].
- **Destructive bulk actions** (bulk ban, deleting the Space) ask for the password again. Discord asks for 2FA or a password on bulk bans [DC-members], and Realm has no 2FA until Phase 2. **Deleting a Space** means typing its name, then a 7-day soft delete with Restore *(start)*. `deleted_at` exists.

**Audit log ("Activity log" in Space settings)**
- Ruled rows in plain sentences: "**Noor** timed out **Kenji** for 1 hour · Rule 2 · today 21:40", with a disclosure showing before/after for settings changes (`changes` jsonb).
- Filters: person, action type, date.
- Visible to the Owner and roles with *View activity log*. Append-only. Keep it **at least 1 year** *(start)*. Discord keeps 45 days [DC-audit], and both Reddit mods and the modqueue study show mods going back to past actions to decide [RD-modperm][ARXIV-modqueue].

### 5b. Board post, comment thread, feed tabs and "why this"

**Board post**
- **Composer**: from `+` Create (in a Space, it defaults to "post in this board" per UX-ARCHITECTURE).
  - Fields: where (board or your profile); **title** (required on boards, as in DATA-MODEL); body (restricted Markdown); up to *(start)* 10 images, each with an **alt text** field shown inline, not hidden; or a link, which the server unfurls into title, site and image *(worker fetch, no client-side scraping)*.
  - Toggles: Spoiler, and 18+ (hidden for teen accounts).
- **In a list**: one ruled row per post.
  - Author avatar, name, room and time on one line (Ink 2); the title in Atkinson bold (titles are read, so not Funnel); 3 lines of body; media at its own aspect ratio, capped in height.
  - Then the **shared action bar** in the fixed order from UX-ARCHITECTURE: *vote / like · comment · share · save · more*.
- **Votes:** board posts use up and down arrows around the score only if the Space turned on downvotes (DATA-MODEL allows this per Space). Otherwise boards and profile posts use "Like". Downvote counts are never shown separately to readers. Lemmy shows ↑111 ↓1 [LM-thread], which invites pile-ons (*inference*).
- **Optional "Hide scores for the first hour"** Space setting. Reddit allows up to 24 h "to encourage redditors to focus on the content before being swayed" [RD-settings].
- **Saves** are private and listed under avatar menu → Saved.
- **Share**: Copy link (a real URL), Send to a DM or room (an in-app card), and the device share sheet on phones.

**Comment thread**
- Indent with a hairline rail per level, up to **depth 8** (DATA-MODEL already collapses past 8). Below that, "Continue this thread →" opens that branch as its own view with a back link.
- Every comment has a **Collapse** control (a button with `aria-expanded`, labelled "Collapse Noor's comment and 4 replies"), like Lemmy and Hacker News [LM-thread][HN-thread]. The top of the thread has "**Collapse all replies / Expand all**" and the sort, like Tildes [TL-topic].
- **Sorts:** *Top* (default), *New*, *Old*. The author gets an "OP" tag.
- Removed comments collapse to "Removed by {Space} mods · Rule 3"; deleted ones show "Deleted by its author". Their replies stay [RD-settings].
- Lock thread (`locked_at`) shows "Comments are closed" in place of the composer.

**Feed tabs.** *There's an inconsistency in the docs.* ROADMAP says "Home / Following / Communities feeds", ARCHITECTURE §5.7 defines *Following*, *Communities* and a *Home* blend, and UX-ARCHITECTURE says Feed has *Following* and *For you*. The front page promises "For you says why it picked each one". Proposal:
- The **Feed** destination has three tabs: **For you** · **Following** · **Spaces**.
  - *For you* is ARCHITECTURE's "Home" blend, renamed so it doesn't clash with the Home destination.
  - *Following* is reverse-chronological from people you follow.
  - *Spaces* is hot-ranked from your Spaces' boards.
  - The **Home** destination stays the hub (friends online, unread, "continue where you left off"), not a feed.
- The last tab used is remembered. A Clips tab joins in Phase 3.

**"Why this" on For you** (the front-page promise, and the DSA Art. 27 standard [DSA])
- Every For you item carries a one-line reason above the author line, in Ink 2, picked from a **fixed set of true templates**, each tied to a real ranking term:
  - "Because you follow **Noor**";
  - "From **Late Night Lobby**, a Space you're in";
  - "**Kenji** (your friend) commented", shown only if that activity is already visible to you;
  - "Popular in **Late Night Lobby** today · 14 upvotes in 2 h";
  - "New in a Space you joined this week".
- Never "Recommended for you" with nothing after it.
- The item's More menu has "**Why am I seeing this?**". It opens a sheet with:
  - the reason or reasons and the plain formula ("For you mixes posts from people you follow and Spaces you're in. Newer posts and posts with more votes come first. Nothing is based on how long you look at things.");
  - controls: *Show fewer from this Space*, *Hide this post*, *Mute {person} in Feed*, and a *Switch to Following* link.
- This follows TikTok's "Why this video" [TT-why], Meta's "Why Am I Seeing This?" and "Show more, Show less" [META-why] and Bluesky's feed choice [BS-feeds]. Art. 27 also wants the "main parameters" in plain language in the terms and a way to change options "directly and easily accessible" where the ranking happens [DSA]. The tab bar is that switch.
- A **Help → "How Feed works"** page states the main parameters.
- Don't call any of it "personalised AI" (ARCHITECTURE §5.7). It doesn't use dwell or watch time, and the Art. 28 guidelines tell platforms to prefer explicit signals for minors [EC-Art28].

**Infinite scroll with stopping points**
- **Following**: when you reach what you'd already seen, a ruled marker says "**You're caught up**, that's everything since yesterday 21:10". Older posts load only after a "Show older" pill.
- **For you**: batches of *(start)* 30. After two batches, an end row says "**That's today's picks**", with links to Following, your Spaces and Explore. Nothing loads by itself after that.
- **Spaces**: "That's the top posts from your Spaces today", then Show more.
- New posts arrive as a "**N new posts**" pill at the top, never pushed in above where you're reading. Native scroll, no pull-to-refresh hijack, scroll position restored on Back.
- No autoplay (Phase 1 has no video anyway; carry the rule into Clips).
- Why: the European Commission's preliminary TikTok findings (6 Feb 2026) name infinite scroll, autoplay, push notifications and a highly personalised recommender as addictive design, and ask for infinite scroll to be disabled over time and for screen-time breaks [EC-TikTok]. The Art. 28 guidelines ask for excessive-use features to be off by default for minors [EC-Art28]. Hacker News has offered a "noprocrast" limit for years (20 minutes on, 3 hours off by default) [HN-faq]. An optional "Take a break after N minutes" reminder in Settings → Feed fits Realm's attention-span promise (PRODUCT.md).

**Board sorts:** *Hot* (default), *New*, *Top (today / week / month / all)*. Each sort explains itself in the menu, like Lemmy's documented sorts [LM-ranking] ("Hot: votes, with newer posts counting more").

### 5c. Report, block and mute flows, and the Space mod queue

**Report (everywhere; never themeable, per ROADMAP)**
- **Entry:** "Report" sits last in every item's More menu (post, comment, message, profile, Space). It's never hidden behind a second menu.
- **Step 1, "What's wrong?"**: at most 9 plain rows:
  - *Spam or a scam*
  - *Bullying or harassment*
  - *Hate*
  - *Sexual content involving someone under 18*
  - *Violence or threats*
  - *Self-harm or suicide*
  - *Pretending to be someone*
  - *Breaks this Space's rules* (expands to that Space's rules by title)
  - *Something else*
  The back button keeps your choice, as Discord's does [DC-report].
- **Step 2:** an optional box, "Anything the reviewers should know?". For a profile, a "Which part?" checklist (name, picture, bio, posts or messages), the way Discord and Reddit allow several parts [DC-report][RD-report]. For messages and comments, Realm snapshots the content automatically (`evidence` jsonb), so the reporter never has to copy links. Discord makes DSA reporters paste a message URL [DC-report]; Realm shouldn't.
- **Step 3, confirmation**, which says who receives it:
  - "Sent to **Late Night Lobby's mods**" (Space-rule reports), or
  - "Sent to **Realm's safety team**" (the platform categories, which also go to the Space's mods for content in their Space, *except* the under-18 sexual content category, which goes only to Realm).
  - It then offers **Block**, **Mute** and **Leave Space** as ghost pills.
  - For self-harm it shows crisis resources, as Discord and Reddit do [DC-report][RD-report].
  - "Your name isn't shared with the person you reported" [DC-report].
- **Data model gap:** `reports.reason` has no "breaks this Space's rule" value. Add `community_rule` plus a `rule_index`.
- **Afterwards:** Settings → Safety → **Your reports** lists each report as a ruled row: *Received* → *Reviewed: action taken* / *Reviewed: no rule broken*, with dates. A notification arrives when it's decided. This mirrors Discord's "we will let you know if we identified a violation" [DC-report] and the DSA's confirmation of receipt and decision for notices [DSA Art. 16(4)–(5)].
- **Report rate limit** *(start: 20 a day, 5 an hour)*, with plain copy if it's hit. Discord forbids mass and false reporting [DC-report].

**Block and mute.** Each confirm sheet explains itself in two lines, in the second person.
- **Mute {name}**: "You won't see their posts, comments or messages in Feed and Spaces, and you won't get notifications from them. They aren't told and can still see your things." Optional duration: 24 h, 7 days, until I unmute (`mutes.until` exists). Muted content collapses to "Muted · Show" in shared rooms.
- **Block {name}**: "They can't message you, see your profile or posts, comment on your posts, mention you or send friend requests. You'll stop being friends. They aren't told, but they may notice." In shared Spaces, their messages collapse to "Blocked message · Show" for you. Keep **block lists private**. Bluesky's blocks are public records [EFF-bsky], which suits a protocol, not a friend group (*inference*).
- **Mute a Space or room** lives in notification settings, not here.
- **Restrict** (Instagram: their comments are visible only to them unless you approve, no read or online status, their messages go to Requests [IG-restrict]) is a good Phase 2 addition for people who can't block a classmate without drama. Discord's newer "Ignore" serves the same need (secondary reports only [DC-ignore]).

**Teen defaults (13–17, from the sign-up age gate)**, adapted from Discord's teen group [DC-teen][DC-blog-teen] and the Art. 28 guidelines [EC-Art28]:
- DMs from non-friends go to **Requests** (a teen can't switch this off);
- a warning before accepting a friend request from someone with no mutual friends and no shared small Space *(start: under 200 members, as Discord uses)*;
- full profile and Here now activity visible only to friends and small Spaces;
- 18+ Spaces and rooms not reachable;
- For you uses only explicit signals (follows, joins, votes), never dwell time;
- nobody can add a teen to a group DM or Space without the teen accepting.

**Rate limits and new-account limits (limit reach, not friendship)**
- Per-account limits in Valkey *(start values)*:

  | Action | Limit |
  |---|---|
  | Posts | 10 per hour |
  | Comments | 60 per hour |
  | Messages | 30 per 10 s |
  | DMs to non-friends | 20 per day |
  | Friend requests | 50 per day |
  | Spaces created | 5 per day |
  | Invites created | 20 per day |
  | Reports | 20 per day |

- New accounts, until 72 h old *and* email verified *(start)*:
  - message requests to non-friends: 5 a day;
  - no `@everyone` mentions;
  - links in **public** Space boards held for mod review if the Space turns on "**Hold new members' links**";
  - public Spaces can't be created.
  - Nothing limits chatting and posting in Spaces you were invited to.
- Space-level options, copied from proven tools:
  - "**Who can post**": *anyone who joined* / *verified email* / *members for 10+ minutes*, in the spirit of Discord's verification levels [DC-verif];
  - "**New member filter**": off / collapse comments from accounts under 7 days old / hold them for review, like Reddit Crowd Control [RD-crowd];
  - **Slowmode** (`slowmode_seconds` exists) and **Pause invites** [DC-raids].
- **Always say the limit and when it lifts.** For example: "New accounts can send 5 message requests a day. This lifts on Thu 8 Oct." No shadow limits. Hacker News marks new accounts in green [HN-faq]. Realm should not label new people publicly (*inference:* in a friend group that singles them out). Mods see "New account" in the queue.

**Space mod queue** (Space settings → Moderation → **Queue**, plus a count in the Space header for mods only)
- **Rows**, ruled, newest first by default. Filters: *All / Posts / Comments / Messages*; sorts: *Oldest*, *Newest*, *Most reports* [RD-modqueue]. Each row shows:
  - the item with its **context** (parent post, or the 3 messages before and after, expandable);
  - report reasons with counts, but **not reporter names** (*inference:* in a 10-person Space a name is identifying);
  - an **author strip**: joined date, "New account" if any, and past actions in this Space from the audit log ("1 timeout, 2 removals in 30 days").
  The modqueue study found mods mostly leave the queue to get exactly these three things: conversation context, user history and past mod actions [ARXIV-modqueue].
- **Actions** in one panel: *Keep* (dismiss reports), *Remove* (pick a rule; tell the author, on by default), *Lock thread*, *Timeout*, *Ban*, *Send to Realm*. The item **stays open until "Done"**, so remove-and-ban is one visit. Mods in the study complained items vanish after the first action [ARXIV-modqueue].
- **Claiming:** opening an item marks it "**Noor is reviewing**" for other mods in real time over the gateway. 74.5% of surveyed mods had collided with another mod on the same report [ARXIV-modqueue]. Every decision shows "Removed by Noor · 21:40" to other mods, the way Reddit does [RD-modqueue], and writes to the audit log.
- **Saved reasons:** a Space's rules double as removal reasons, and mods can save extra reply templates [RD-saved].
- **Sources of items:** user reports, the new-member filter and held links. Phase 2 AutoMod-style filters feed the same queue.

## Sources and captures

"Checked" is the date the page was read. "Search summary" means only a web-search result summary was seen, not the page itself; treat those as leads to verify.

**Discord**
- [DC-create] How do I create a server? https://support.discord.com/hc/en-us/articles/204849977-How-do-I-create-a-server (checked 2026-10-04)
- [DC-invites] Invites 101. https://support.discord.com/hc/en-us/articles/208866998-Invites-101 (2026-10-02; capture `discord-help-invites-101.jpg`)
- [DC-permfaq] Setting Up Permissions FAQ. https://support.discord.com/hc/en-us/articles/206029707-Setting-Up-Permissions-FAQ (2026-10-02; `discord-help-permissions-faq.jpg`)
- [DC-chperm] Channel Permissions Settings 101. https://support.discord.com/hc/en-us/articles/10543994968087-Channel-Permissions-Settings-101 (2026-10-02; `discord-help-channel-permissions-101.jpg`)
- [DC-dev-perm] Permissions (developer docs). https://docs.discord.com/developers/topics/permissions (2026-10-02; `discord-dev-permissions.jpg`)
- [DC-audit] Audit Logs Resource. https://docs.discord.com/developers/resources/audit-log (2026-10-02)
- [DC-members] Members Page. https://support.discord.com/hc/en-us/articles/15946797617431-Members-Page (2026-10-02; `discord-help-members-page.jpg`)
- [DC-onboard] Community Onboarding FAQ. https://support.discord.com/hc/en-us/articles/11074987197975-Community-Onboarding-FAQ (2026-10-02; `discord-help-onboarding-faq.jpg`)
- [DC-timeout] Time Out FAQ. https://support.discord.com/hc/en-us/articles/4413305239191-Time-Out-FAQ (2026-10-02)
- [DC-raids] How to Protect Your Server from Raids 101. https://support.discord.com/hc/en-us/articles/10989121220631-How-to-Protect-Your-Server-from-Raids-101 (2026-10-02)
- [DC-verif] Verification Levels. https://support.discord.com/hc/en-us/articles/216679607-Verification-Levels (2026-10-04)
- [DC-forum] Forum Channels FAQ. https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ (2026-10-04; `discord-help-forum-channels.jpg`)
- [DC-report] How to Report Abusive Behavior to Discord (last updated 22 Jan 2026). https://discord.com/safety/360044103651-reporting-abusive-behavior-to-discord (2026-10-02; `discord-safety-reporting.jpg`)
- [DC-warn] Discord Warning System. https://support.discord.com/hc/en-us/articles/18210965981847-Discord-Warning-System (2026-10-02)
- [DC-teen] What Protections Do You Get in the Teen Age Group? https://support.discord.com/hc/en-us/articles/42178056096663-What-Protections-Do-You-Get-in-the-Teen-Age-Group (2026-10-02)
- [DC-blog-teen] Safer for Teens, Same Discord for Adults (25 Sep 2026). https://discord.com/blog/safer-for-teens-same-discord-for-adults (2026-10-02)
- [DC-discovery] Discord server discovery. https://discord.com/servers (2026-10-02; `discord-discovery.jpg`, `discord-discovery-cards.jpg`)
- [DC-invite-page] Example public invite page. https://discord.com/invite/midjourney (2026-10-02; `discord-invite-preview.jpg`)
- [DC-community-post] "Fix the hierarchy of role permissions so they work again". https://support.discord.com/hc/en-us/community/posts/360041036712-Fix-the-hierarchy-of-role-permissions-so-they-work-again (search result title only, 2026-10-04)
- [DC-ignore] MakeUseOf on Discord's Ignore feature. https://www.makeuseof.com/discord-adds-ignore-feature/ (search summary, 2026-10-04; Discord's own help page not found)

**Reddit**
- [RD-create] How do I create a community? https://support.reddithelp.com/hc/en-us/articles/360043044012-How-do-I-create-a-community (2026-10-02)
- [RD-settings] Community settings. https://support.reddithelp.com/hc/en-us/articles/15484546290068-Community-settings (2026-10-02)
- [RD-modqueue] Moderation Queue. https://support.reddithelp.com/hc/en-us/articles/15484440494356-Moderation-Queue (2026-10-02; `reddit-help-modqueue.jpg`)
- [RD-modperm] User Management: moderators and permissions. https://support.reddithelp.com/hc/en-us/articles/15484498369428-User-Management-moderators-and-permissions (2026-10-02)
- [RD-saved] Saved Responses (removal reasons). https://support.reddithelp.com/hc/en-us/articles/15484471320980-Saved-Responses (2026-10-02)
- [RD-report] How do I report a redditor? https://support.reddithelp.com/hc/en-us/articles/360043479851-How-do-I-report-a-redditor (2026-10-02)
- [RD-crowd] Crowd Control. https://support.reddithelp.com/hc/en-us/articles/15484545006996-Crowd-Control (2026-10-04)
- [ARXIV-modqueue] Bajpai et al., "In the Queue: Understanding How Reddit Moderators Use the Modqueue", arXiv 2509.07314 (9 Sep 2025). https://arxiv.org/html/2509.07314v1 (2026-10-02)

**Other community products**
- [SL-roles] Slack: Permissions by role. https://slack.com/intl/en-gb/help/articles/201314026-Permissions-by-role-in-Slack (2026-10-02)
- [SL-managers] Slack: Understand channel managers. https://slack.com/intl/en-gb/help/articles/8328303095443-Understand-Channel-Managers-in-Slack (2026-10-02)
- [CI-space] Circle: Customize post space settings. https://help.circle.so/p/posts/post-spaces/customize-post-space-settings (2026-10-02)
- [CI-private] Circle: Set up a private community. https://help.circle.so/p/basics/community-access/set-up-a-private-community (2026-10-02)
- [FB-privacy] Facebook: Differences between public and private groups. https://www.messenger.com/help/220336891328465 (2026-10-02)
- [META-groups-2025] Meta: New Facebook update gives group admins more flexibility (Nov 2025). https://about.fb.com/news/2025/11/facebook-update-group-admins-flexibility-protecting-member-privacy/ (2026-10-02)
- [TG-topics] Telegram: Topics in Groups… (5 Nov 2022). https://telegram.org/blog/topics-in-groups-collectible-usernames (2026-10-02; `telegram-blog-topics.jpg`)
- [TG-invites] Telegram API: Invite links and join requests. https://core.telegram.org/api/invites (2026-10-02)
- [ST-chat] Steam: New friends list, voice, and chat features. https://steamcommunity.com/updates/chatupdate (2026-10-02; `steam-chat-update.jpg`; page undated)
- [GU-wiki] Wikipedia: Guilded. https://en.wikipedia.org/wiki/Guilded (2026-10-02)
- [GU-perm] Guilded: Permissions (archived 24 Nov 2025). https://web.archive.org/web/20251124052326/https://support.guilded.gg/hc/en-us/articles/360038935074-Permissions (2026-10-02)
- [GU-chperm] Guilded: Category & Channel Permissions (archived 24 Nov 2025). https://web.archive.org/web/20251124051107/https://support.guilded.gg/hc/en-us/articles/360039718494-Category-Channel-Permissions (2026-10-02)
- [TC-geneva] TechCrunch: Bumble BFF's revamped app… built on Geneva (18 Sep 2025). https://techcrunch.com/2025/09/18/bumble-bffs-revamped-app-is-here-focusing-on-friend-groups-and-community-building/ (2026-10-02)

**Boards and feeds**
- [HN-faq] Hacker News FAQ. https://news.ycombinator.com/newsfaq.html (2026-10-04)
- [HN-thread] Hacker News thread (nested comments). https://news.ycombinator.com/item?id=8863 (2026-10-04; `hn-thread-nested.jpg`)
- [TL-games] Tildes ~games listing. https://tildes.net/~games (2026-10-04; `tildes-games-listing.jpg`)
- [TL-topic] Tildes topic thread. https://tildes.net/~games/1w81/cga_2026_09_remove_cartridge_tony_hawks_pro_skater_2 (2026-10-04; `tildes-topic-thread.jpg`)
- [LM-ranking] Lemmy docs: Votes and Ranking. https://join-lemmy.org/docs/users/03-votes-and-ranking.html (2026-10-04)
- [LM-thread] Lemmy post thread on lemmy.ml. https://lemmy.ml/post/53349754 (2026-10-04; `lemmy-ml-thread.jpg`, `lemmy-ml-front.jpg`). lemmy.world showed a Cloudflare challenge and was skipped.
- [BS-feeds] Bluesky: Algorithmic Choice with Custom Feeds (27 Jul 2023). https://bsky.social/about/blog/7-27-2023-custom-feeds (2026-10-04)
- [BS-stack] Bluesky's Stackable Approach to Moderation (12 Mar 2024). https://bsky.social/about/blog/03-12-2024-stackable-moderation (2026-10-04)
- [BS-docs] Bluesky docs, Labels and moderation (read from the GitHub source, because docs.bsky.app returned a certificate error). https://github.com/bluesky-social/bsky-docs/blob/main/docs/advanced-guides/moderation.md (2026-10-04)
- [OZ-guide] Ozone user guide. https://github.com/bluesky-social/ozone/blob/main/docs/userguide.md (search summary, 2026-10-04)
- [EFF-bsky] EFF: How to Clean Up Your Bluesky Feed (18 Jun 2024). https://www.eff.org/deeplinks/2024/06/how-clean-your-bluesky-feed (2026-10-04)
- [TT-why] TikTok: Learn why a video is recommended For You (20 Dec 2022). https://newsroom.tiktok.com/en-us/learn-why-a-video-is-recommended-for-you (2026-10-04)
- [META-why] Meta: How AI influences what you see on Facebook and Instagram (29 Jun 2023). https://about.fb.com/news/2023/06/how-ai-ranks-content-on-facebook-and-instagram/ (2026-10-04)
- [IG-restrict] Instagram Help: Restrict or unrestrict someone. https://help.instagram.com/2638385956221960 (2026-10-04)

**Law and regulation**
- [DSA] Regulation (EU) 2022/2065 (Digital Services Act), Arts. 14, 16, 17, 19, 25, 27, 28. https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R2065 (2026-10-04)
- [EC-TikTok] European Commission: Commission preliminarily finds TikTok's addictive design in breach of the DSA (6 Feb 2026). https://digital-strategy.ec.europa.eu/en/news/commission-preliminarily-finds-tiktoks-addictive-design-breach-digital-services-act (2026-10-04)
- [EC-Art28] European Commission: Commission publishes guidelines on the protection of minors (14 Jul 2025). https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors (2026-10-04)
- [WC-ofcom] White & Case: UK Online Safety Act, Protection of Children Codes come into force. https://www.whitecase.com/insight-alert/uk-online-safety-act-protection-children-codes-come-force (search summary, 2026-10-04). Ofcom's own page (https://www.ofcom.org.uk/online-safety/protecting-children/new-rules-for-a-safer-generation-of-children-online) returned 403 and then a bot check; not bypassed.
- [NY1-SAFE] NY1: New York finalizes social media restrictions for kids (28 Jul 2026). https://ny1.com/nyc/all-boroughs/politics/2026/07/28/new-york-finalizes-social-media-restrictions-for-kids-safe-act-hochul (search summary, 2026-10-04)
- [AVPA-states] AVPA: US state age-assurance laws for social media. https://avpassociation.com/us-state-age-assurance-laws-for-social-media/ (search summary, 2026-10-04)

**Accessibility specs (not fetched; the W3C site showed a bot check)**
- [WCAG22] https://www.w3.org/TR/WCAG22/
- [ARIA12] https://www.w3.org/TR/wai-aria-1.2/

**Gaps:**
- I didn't capture a public Reddit thread, because old.reddit.com redirected to a login wall.
- Ofcom's and W3C's pages were behind bot checks.
- Threads and Bluesky reply UIs were not captured.
- The US state-law facts rest on secondary summaries.

All of these are worth a second pass before the Phase 1 safety work is signed off.
