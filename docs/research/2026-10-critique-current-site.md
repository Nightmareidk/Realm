# Realm: outside design critique of the current build (2026-10)

Reviewer: independent design critic, second opinion. Bar: discord.com.
Evidence: every file in `.impeccable/review/audit/` was opened (all 8 intro frames, all 11 desktop night and 11 desktop day landing depths, all laptop, tablet and phone landing depths sampled in full, all 4 login widths, all 8 app pages). File names below are the screenshot names, without the `.jpg`.

---

## 1. Verdict

Yes, it reads as AI-generated: the purple-to-blue nebula with a glowing black hole, the glossy 3D mascot cast, the glow-on-everything orange pill buttons and the glass-card feature rows are the default vocabulary of generated landing pages, and almost nothing on the page was chosen because a friend-group chat product needs it. The only parts that do not read as slop are the product mock-ups and the privacy copy, which are specific and believable, but they are buried under decoration, and the signed-in app is a near-empty roadmap page that does not match what the landing page promises.

Your friend is right, and "barf" about the intro and sign-in is an accurate reaction rather than taste: both are the most decorated, least useful screens in the product.

---

## 2. What most reads as "AI slop", ranked worst first

1. **Purple-pink-blue aurora/nebula behind everything, with a glowing "black hole" as the focal point.**
   `landing-desktop-night-000`, `-004`, `-010`; the left half of `login-desktop`; `intro-12500`. A blown-out white bloom around a black disc, violet-to-cyan aurora ribbons, a faux mountain silhouette at the bottom. This is the single strongest generated-image tell. It has no connection to chat, friends, clips or boards, and it is the first thing everyone sees.

2. **A glossy 3D clay mascot cast (astronaut, pink one-eyed octopus, green three-eyed alien, blue horned monster, headphone girl, kid with glasses).**
   `landing-desktop-night-010`, `-018`, `-028`, `-088`, `-100`; `login-desktop`; `landing-tablet-night-100`. Same shiny-plastic render style, same lighting, used as stickers in six or more places (hero, ticker avatars, section edges, login, download card, footer). It looks like a text-to-image "cute 3D characters" pack. It reads as a kids' toy brand, which undercuts a product whose strongest content is privacy and trust, and it is nothing like what Discord does with Wumpus (one mascot, used sparingly, flat, with a personality).

3. **The astronaut-falls-into-a-black-hole intro, with a fake "Opening your universe 0% ... 82%" loader.**
   `intro-00800` to `intro-12500`. Space-cliche narrative plus a progress counter that is theatre rather than loading. Detail in section 4.

4. **Orange glowing pill buttons, and "everything is a pill".**
   `login-desktop` (Sign in button has an orange drop-glow and full pill radius), `landing-desktop-night-010` (Open Realm, Download), nav "Open Realm" in every frame. Inputs, tabs, chips, badges, ghost buttons and the nav are all fully rounded capsules. Glow on a primary button is the default "make it feel premium" move; it adds no hierarchy and blurs edges on dark.

5. **Headline recipe: one word in the accent colour, heavy grotesque, very tight negative tracking.**
   `landing-desktop-night-010` ("One place to *hang out* with your crew." with "hang out" in orange), `-028` ("Everything your group does, in one app."), `-088`. The letters crowd: in the huge "Realm" wordmark (`landing-desktop-night-000`, `intro-12500`) the "l" and "m" touch so it reads close to "Reaim", and multi-line headings have descenders hitting the next line (`-028`, `-076`). Accent-word highlighting plus crushed tracking is a very recognisable generated-page tic.

6. **Scroll-jacked text and panels: word-by-word grey-to-white reveal, and cross-fading stacked cards.**
   `landing-desktop-night-018` and `-004` (headline sits at 10 percent opacity over the hero), `-064` (Profile and Boards panels both visible at half opacity, text from one showing through the other), `landing-laptop-night-055` (same overlap, worse), `landing-desktop-day-028`. At several depths there is no moment where the page is legible and still. The reveal effect is a trend, not a reading aid.

7. **Floating glass nav pill with a rainbow scroll-progress underline.**
   Every landing frame after the hero (`-004` onward). The teal-to-purple-to-orange line under the nav is pure decoration. The pill is so transparent that content scrolls visibly through it (see section 6), which is both a glassmorphism cliche and a bug.

8. **Template feature rows: huge rounded glass card, tiny orbit "icon" above an H2, paragraph, three dash bullets, mock-up on the other side. Repeated four times.**
   `landing-desktop-night-052`, `-064`, `landing-desktop-day-052`, `-064`. The little ring-and-dot orbit icon above each heading is decorative and means nothing. Left-text/right-mockup, alternate, repeat, is the generated SaaS scroll.

9. **A marquee of fake chat bubbles ("Noor new clip dropped", "Kenji gg!!", "Amara raid at 9?", "Priya brb snacks") with emoji and avatars, two rows scrolling.**
   `landing-desktop-night-018`, `landing-desktop-day-028`, `landing-tablet-night-015`. Social-proof marquee pattern with invented users. It fills a band of the page with nothing a visitor can act on.

10. **Sticker labels pinned to mascots and planets that point at nothing: "who's on tonight?", "new clip dropped", "love the new pfp", "Feed", "Spaces", "Boards", "128 upvotes".**
    `landing-desktop-night-010`, `login-desktop`. The "Spaces" and "Boards" chips on the login collage sit on top of the green alien and the planets, so they hide the art and explain nothing. "128 upvotes" floats in empty sky.

11. **Obviously generated imagery inside the mock-ups: glowing stone arch on a sunlit hill, red monoliths, nebula banner.**
    `landing-desktop-night-052` (feed post image and clip), `-064` (profile banner and media grid, three of six tiles are the same arch/hill scene), `landing-desktop-day-064`. The "glowing gate in a meadow" is a text-to-image trope, and repeating it in the grid exposes the sample content as a few reused renders.

12. **Planet-as-navigation diagram with a rocket and satellite: "Four worlds, one universe."**
    `landing-desktop-night-040`, `landing-laptop-night-035`, `landing-tablet-night-035`, `landing-phone-day-035`. Dashed orange orbit path with an arrowhead, four coloured planets, a rocket with a huge grey exhaust cone that runs behind the copy and a stray satellite. It makes the visitor decode "planet = feature" instead of showing the feature, and the headline is a stock line.

13. **Photoreal day mode: a lit sun with flares, soft 3D clouds, a green grass-turf footer, a cratered-moon footer in night.**
    `landing-desktop-day-000`, `-004`, `-028`, `-040`, `-100`; `landing-desktop-night-100`. These are texture-slapped photoreal fills next to flat-lit glossy mascots, so three visual languages fight. The grass footer (`day-100`) is a flat green slab with an almost invisible ghost wordmark. `landing-desktop-day-018` is a full 1440x900 screen of blurry lavender fog with nothing in it, which reads as broken.

14. **Giant ghost "realm" wordmark at the bottom of the footer.**
    `landing-desktop-night-100`, `landing-laptop-night-100`, `landing-tablet-night-100`. A 10-percent-opacity oversized wordmark is on every Tailwind-template footer since 2023.

15. **Cosmic-metaphor copy at every layer.**
    "Opening your universe" (intro), "Step into another universe, with your whole crew" (hero), "Four worlds, one universe" (`-040`), "Pick a planet to look inside", "Your crew isn't here yet" (app). One metaphor repeated is not a voice; it is a theme word. Compare the privacy section, which sounds like a person wrote it (see section 3).

16. **No single brand colour.** Orange for CTAs, teal for Spaces, blue for Feed, purple for Profiles, pink for Boards, a lime-green padlock (`landing-desktop-night-076`), plus the aurora. `landing-desktop-night-040` shows each feature in its own neon. Discord is one colour (blurple) doing nearly all the work.

17. **A "Download" section that offers nothing to download.**
    `landing-desktop-night-088`, `landing-desktop-day-088`. Windows, macOS, Linux, Google Play, App Store: five "Coming soon" rows, and a card roughly 250px tall of empty space between "Available now. Nothing to install." and the button. Dashed-outline disabled store badges look like a placeholder wireframe.

18. **Generic crescent-ring logo mark.** A gradient ring with a sparkle dot beside a lowercase wordmark, tiny in the nav, unreadable at 20px (all nav frames). It is the "orbit swoosh" mark generators default to.

19. **A decorative empty-state card in the app: big greeting, a card with concentric orbit arcs bleeding off the corner.**
    `app-desktop-home`. The arcs are there to make an empty card feel designed.

---

## 3. What is genuinely good and worth keeping

- **The privacy section is the best thing on the site.** "Private where it counts. Honest about the rest." with two tiers: "End-to-end encrypted, before public launch" and "Protected, not end-to-end encrypted", plus the note that DMs are not E2EE yet and Realm says so in every conversation (`landing-desktop-night-076`, `landing-laptop-night-075`, `landing-phone-night-075`). This is honest, specific, differentiating, and Discord does not do it. Keep the content and the two-card structure; strip the padlock mascot.
- **The product mock-ups have real, believable UI detail.** Space header with member count and channel tabs (`# general`, `# clips 3`, `# lfg`, `builds-and-guides`, `Squad room`), a pinned event ("Ranked night, 6 going, Join"), a reply-quote ("Tomás: anyone up for ranked after 9?"), "Seen by" avatars, typing dots, a "Kenji mentioned you" toast, a short-video card with a like/comment/share rail, a board thread with an upvote count and nested replies, a profile with Media/Posts/Spaces tabs (`landing-desktop-night-028`, `-052`, `-064`; `landing-desktop-day-052`). This is the closest thing to a product identity on the site and it is more convincing than any of the 3D art. It should be the hero, not the evidence under the hero.
- **Specific, human sample copy.** "Speedruns, sourdough, and very long voice calls." "the jump that should not have worked". "Best four-player co-op games that aren't shooters?" These sound like real friend groups. Keep this voice and drop the cosmic one.
- **Clear four-part information architecture with one-line descriptors**: Spaces ("Group chat with a room for every topic"), Feed ("Posts and clips from your people"), Profiles ("One identity across all of it"), Boards ("Threaded discussion that lasts") (`landing-desktop-night-040`). Easy to scan, consistent naming, matches the app's sidebar.
- **The "Available now / Coming soon" legend (solid dash vs dashed dash)** (`landing-desktop-day-052`) is a small honest system worth keeping, in a more legible form.
- **"Bring your group over." closing section** (`landing-tablet-night-100`): the one place the mascots work, because lined up on a moon they say "group of friends" and sit under a single clear CTA. If any mascot use survives, this is the model: a cast, grouped, at the end, not stickers everywhere.
- **Pause-motion and day/night controls surfaced in the nav and footer.** Rare and good accessibility practice; keep the pause control.
- **Login form basics are sound** (`login-desktop`, `login-phone`): labels above fields, show-password toggle, forgot-password, 44px-plus touch targets, one primary action. The structure is right; the decoration around it is what is wrong.
- **Settings > Devices is clean and functional** (`app-desktop-settings-devices`): "This device" badge, per-device sign out, "Sign out of all other devices". It is the one app screen that looks like a real product page, and session control is a real trust feature.
- **App shell structure is sane**: icon rail (Home, Spaces, Messages, Feed, Explore, You) on desktop, bottom tab bar on phone.

---

## 4. The opening animation and the sign-in page

### 4a. Intro (`intro-*`)

Overall: about 12.5 seconds from first paint to the hero (`intro-12500` is still mid-transition), for what is functionally a loading screen. Norm for a loader is under two seconds. "Skip intro" is shown in the top-right from the very first frame, which tells the visitor the designer expects them to want out.

- **`intro-00800` (0.8s):** near-black indigo vignette. Only a spinner-logo, "realm", a hairline progress bar at 0%, "Opening your universe 0%" at bottom-centre. The whole top four-fifths of the screen is empty. The loader is the content.
- **`intro-02000` (2.0s):** identical, bar at 39%. Two seconds in and there is still nothing to look at.
- **`intro-03500` (3.5s), `-05000`, `-06500`:** a starfield and dark grey low-poly asteroids (they look like default flat-shaded icosahedron geometry) fade in, and a smiling cartoon astronaut waves. The mascot is about 200px tall in a 1440x900 frame, centred, with no hierarchy against the loader below it. The percent counter (67%, 70%, 82%) is clearly driven by a timeline, not by loading anything. A fake loader that also stalls is worse than none.
- **`intro-08000` (8.0s):** hard change of world: an orange accretion disc, multicolour hyperspace streaks (blue, violet, orange hairlines), and the astronaut pasted over the black hole at the same scale. The astronaut is lit flat and bright cyan/white against warm orange, no rim light, no shadow, no relationship to the scene. It reads as a sticker on a wallpaper.
- **`intro-10000` (10.0s):** the astronaut shrinks off-centre below the hole while dark debris orbits. There is no single focal point and no moment that rewards the wait.
- **`intro-12500` (12.5s):** the intro and the landing page overlap. The black hole is bloom-washed, planets have arrived, the astronaut is now a dismembered torso-and-legs fragment (around x 800-890, y 290-460) that reads as a glitch, warp streaks run through the "Realm" wordmark and across the nav, and the "Skip intro" pill physically overlaps the "Open Realm" button (approx x 1315-1405 over x 1240-1350, y 17-70). Site chrome appears before the intro has ended.
- **Why it feels like "barf":** (1) it is long and skippable-from-frame-one; (2) the loader is fake; (3) the metaphor is the most worn in tech: friendly astronaut, black hole, hyperspace; (4) tone is wrong: a smiling character falling into a black hole signals doom with a grin; (5) the character, the asteroids, the black hole and the streaks are four different render styles; (6) it delays the one thing the owner wants people to see.

### 4b. Sign-in page (`login-*`)

- **Two unrelated halves.** `login-desktop`: the left ~54 percent is a cropped copy of the hero collage; the right is a plain dark card with an orange button. The two share no shapes, no spacing logic and no colour except the orange.
- **The collage is cropped badly.** The astronaut's arm is cut by the left edge. The green alien is sliced by the panel boundary and then covered by the "Spaces" and "Boards" chips. "128 upvotes" hangs unattached at top-left. A visible vertical fade seam sits at about x=780 where the art meets the form side.
- **The form card floats in a void.** About 460px wide, 170px of nothing above it, nothing below but "Terms Privacy Help". It reads like a dialog dropped on a poster.
- **Fields are low-affordance.** Near-black pill inputs on a near-black card with a 1px grey border, no placeholder text, and no visible focus ring shown. The empty state looks like two dark capsules.
- **Mismatched baselines.** The left caption ("One universe for your whole crew...", y 829-855) and the right footer links (y 864) sit on different lines, so the page has two footers.
- **Orange everywhere at once.** "Forgot your password?", the Sign in button (with glow) and "Create an account" are all the same orange with underline, so the primary action is not clearly the primary one.
- **Discord comparison.** Discord's login is a single centred card, one colour, one illustration, a QR option, and it loads instantly. Realm's is heavier and louder with less functionality (no passkey, no QR, no social sign-in).
- **Tablet and phone** (`login-tablet`, `login-phone`): the collage collapses into a clip-art thumbnail (about 250px wide on tablet, about 60px characters on phone, the black hole reduced to a dot). On tablet there is a 230px dead gap between that thumbnail and the card. On phone it works functionally; the thumbnail is just noise.

---

## 5. The signed-in app: product or template?

Right now it is a template, and an unfinished one: it is a roadmap page wearing an app shell.

- **There is nothing to do.** `app-desktop-home`: "Welcome, Link Tester", "This is your home base. As Realm opens up...", then a card titled "Your crew isn't here yet" which explains that "Spaces, messages and the feed are being built now", then a list "On the way" with four rows each tagged "In the works". The first screen after signing in tells the user the product does not exist yet. The only action is "Choose your look".
- **The landing page promises an app that is not there.** The landing page shows polished Space chat, a Feed with clips, a Profile and a Boards thread (`landing-desktop-night-028`/`-052`/`-064`). The app has none of them. This is the largest credibility gap in the project: anyone who signs up after the landing page lands on a to-do list. It is also why the landing mock-ups look "AI generated": they are pictures of things that were never built.
- **The right-hand "Here now" column** (`app-desktop-home`) is a heading and a paragraph describing what will go there. Empty states should show the action (invite someone), not narrate the future.
- **The visual layer is generic.** Near-black navy, faint purple radial blobs in the corners, a bordered rounded card with decorative orbit arcs bleeding off its corner, pill buttons. No components, no density, no avatars, no real content hierarchy. It could be any dark-mode SaaS starter.
- **Large unused space.** At 1440 wide the Settings content uses the left 60 percent (`app-desktop-settings-devices`); the right 500px is a void.
- **Settings > Devices shows five identical "Chrome on Windows" rows** with "signed in just now - last active just now" (`app-laptop-settings-devices`, `app-tablet-settings-devices`). Test data, but also a design flaw: the rows give no way to tell devices apart, and the timestamp is repeated twice per row.
- **Navigation state is incomplete.** On Settings (desktop) none of the rail items, including the "You" avatar, is highlighted; on phone "You" is. Rail labels are about 11px.
- **Phone bottom tab bar is see-through.** `app-phone-home`: body text ("Your groups, each one place...") shows through behind the tab labels; `app-phone-settings-devices`: the last device row is visible behind the bar. It needs an opaque or heavily blurred backing.
- **Phone settings list wraps awkwardly** (`app-phone-settings-devices`): "Chrome on / Windows" breaks onto two lines and the "Sign out" button squeezes in beside it, with the metadata wrapping to three lines.
- **Disconnected brand.** The app has no 3D art, no planets, none of the colour. Landing/login are "cosmic toy shop"; the app is "flat dark SaaS". Nothing visually tells you it is the same product, apart from the ring logo.

---

## 6. Responsive behaviour

**Laptop (about 1180 wide)**
- `landing-laptop-night-015`: the hero paragraph ("...Early access is open in your browser.") scrolls up under the nav and sits behind the logo, readable through the pill.
- `landing-laptop-night-075`: the "Photos and files shared in them" row and its checkmarks run straight through the nav's moon and pause buttons.
- `landing-laptop-night-055`: two panels cross-fade over each other with ghosted text from both visible at once.
- `landing-laptop-night-035`: the rocket exhaust cone covers the left column behind the descriptor text.

**Tablet (about 820 wide)**
- Nav collapses to a hamburger, which is fine. `landing-tablet-night-035`: "Boards / Threaded discussion that lasts" shows through the nav bar.
- `landing-tablet-night-015`: the mascot collage is clipped under the nav at the top, the hero's headline and CTAs have already scrolled away, and the reveal headline below the marquee is half-faded with about 180px of empty space beneath it.
- `landing-tablet-night-100` is the best-composed frame in the set (headline, CTA, mascot line-up, tidy footer).
- `login-tablet`: 230px dead gap between the collage thumbnail and the card.

**Phone (about 390 wide)**
- `landing-phone-night-000`, `landing-phone-day-000`: the first screen shows only a giant black hole (or sun) and the word "Realm". The value proposition ("One place to hang out with your crew") is not visible on first screen, so a phone visitor gets no explanation until they scroll. The sun in day mode is cropped and fills the viewport.
- `landing-phone-night-015`: the section headline is cut by the nav pill; the page above it is two paragraphs of 30-plus px type that feels shouted.
- `landing-phone-night-035`: "Spaces are where your group lives." is sliced by the nav; the chat mock-up's channel tabs are clipped on the right ("bu...").
- `landing-phone-night-055`: the profile stats row clips ("9 Space").
- `landing-phone-day-015`: a full 844px screen of near-nothing: pale gradient with only the marquee at the bottom.
- `landing-phone-day-055`: roughly 300px of empty card below the copy where the mock-up should be.
- `landing-phone-day-075` and `-100`: nav pill overlaps headline text; in the footer the pill's logo sits directly over the footer logo, so two "realm" logos stack.
- App phone: see-through tab bar and awkward row wrapping (section 5).
- Common root cause: the nav is a translucent pill with insufficient backing, so text collides with it at every width.

**Day mode** (all `landing-*-day-*`): the nav pill flips between a dark pill (`landing-desktop-day-018`, `-004`) and a light one (`landing-desktop-day-052`) depending on scroll. The primary button in day mode becomes a burnt orange with dark text (`landing-desktop-day-028`, `-064`) that looks muddy and is worth a contrast check.

---

## 7. Three things a top-tier product designer would do differently

1. **Lead with the product, not a diorama.** Linear's hero is the app UI; Discord's hero is the app plus a handful of people hanging out. Delete the black hole, aurora, mascot cast and the intro. Make the hero one short headline (8 words or fewer), one CTA, and one large, crisp, real-looking Space (the Late Night Lobby mock-up already in the page: channels, pinned event, clip, reply, "who's here"), ideally as a short looping capture of the actual app. Use one brand colour plus neutrals, not orange, teal, blue, purple, pink and lime. The sign-in page becomes one centred card (about 400px) on a flat or softly graded background with visible field surfaces, a clear focus ring and one orange or blurple primary action; no collage.

2. **One visual system from landing to login to app, with no loading theatre.** Pick one set of tokens (colour, type scale, radius, surface levels) and make the landing page a faithful preview of the app, so the mock-ups on the page are screenshots of what is shipped. Retire the photoreal sun, clouds, grass and moon (or reduce day mode to a normal light theme), and cap the number of metaphors. Replace the intro with first paint at once: if a brand moment is wanted, a 500-700 ms ring-mark draw, once per session, no counter, no skip button needed. Fix the type: normal tracking (no tighter than about -0.02em), line-height at or above 1.05 on display text, one accent-word trick at most.

3. **Make the first run in the app a real moment and fix the chrome.** The first screen after sign-up should never be a roadmap. Build the one thing the landing page is selling (create a Space, copy an invite link, see who is in it) and let the empty state be that action; hide unbuilt features rather than listing them as "In the works". At the same time: give the nav and phone tab bar an opaque or heavily blurred backing so content never collides, remove stacked cross-fading scroll panels and word-by-word reveals, collapse the glass-on-glass cards to one surface level, use pill radius for buttons only, remove the ghost footer wordmark and the five "Coming soon" download rows (one line saying "Open in your browser now, apps later" does the job), and give the Settings and Devices pages the same density and components the landing mock-ups already show.

---

*Files reviewed (all in `.impeccable/review/audit/`): intro-00800 to -12500; landing-desktop-night-000 to -100; landing-desktop-day-000 to -100; landing-laptop-night-000 to -100; landing-tablet-night-000 to -100; landing-phone-night-000 to -100 (all six); landing-phone-day-000, -015, -035, -055, -075, -100; login-desktop, -laptop, -tablet, -phone; app-desktop, -laptop, -tablet, -phone (home and settings-devices).*
