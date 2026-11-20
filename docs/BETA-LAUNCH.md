# Realm on Google Play: the closed beta

The plan: put Realm on Google Play as a **closed test** (only invited people can install it), keep
**at least 12 testers opted in for 14 days in a row**, then apply for production (public) access.
That 12-for-14 rule applies to every new personal developer account.

Server first: Realm's release build talks to `https://api.tomyrealm.com`, so the beta server
(`docs/BETA-SERVER.md`) must be running before anyone installs it.

## 0. Before you start (one-time)

- [ ] **Beta server running** and `https://api.tomyrealm.com/ready` answers `{"ok":true}`.
- [x] **info@tomyrealm.com works.** The privacy policy, terms and delete-account page give it as
      the contact. Cloudflare Email Routing already forwards it to your Gmail (set up 2026-10-21).
      Send it a test email once more before submitting.
- [ ] **A reviewer account.** Google's reviewers need to sign in. Make an account on the live
      server just for them (a new email address you control, a strong password, birthday over 18,
      two-step **off**). Keep the password in your password manager; you'll paste it into Play
      Console yourself.
- [ ] **A Google Play developer account** (play.google.com/console). Personal account; a one-time
      registration fee (USD 25), ID check and a phone number. This is the one cost in this plan.

## 1. Create the app (Play Console › Create app)

| Field | Answer |
|---|---|
| App name | Realm |
| Default language | English (United Kingdom) or (United States) |
| App or game | App |
| Free or paid | Free |
| Declarations | Tick both (developer policies, US export laws) |

## 2. App content (Policy › App content)

Answer every item; the closed test can't start until they're all done.

**Privacy policy:** `https://tomyrealm.com/privacy`

**App access:** "All or some functionality is restricted" › add instructions:
> Sign in with the test account below. It has posts, a Space and messages so every screen has
> something in it. Two-step sign-in is off.
Then the reviewer account's email and password (you type these in).

**Ads:** No, the app has no ads.

**Content rating (IARC questionnaire):** category **Social or communication**. Honest answers:
- Users can interact and exchange content (chat, posts, voice/video): **Yes**
- Users can share their location with others: **Yes** (a place they choose to send, once)
- The app lets people buy digital goods: **No**
- Violence, sexual content, drugs, gambling, swearing **made by the app itself**: **No** (what
  users post is covered by the "users interact" answer, the terms and moderation)
- Unrestricted internet access (a browser): **No**

**Target audience:** 13–15, 16–17 and 18+. **Not** under 13. When asked if the app appeals to
children: **No**. (Under-13 would put Realm under the Families policy; Realm already refuses
under-13 sign-ups.)

**News app:** No. **Government app:** No. **Financial features:** None. **Health:** None.

**Advertising ID:** No. (The app blocks that permission; see `frontend/app/app.json`.)

**Foreground service permissions:** Realm keeps music playing with the screen off
(`FOREGROUND_SERVICE_MEDIA_PLAYBACK`). Choose **Media playback**, describe it ("Songs from the
music library keep playing when the screen is off or the user switches apps; a notification
shows what's playing with play/pause."), and attach a **short screen recording**: play a song,
lock the phone, show the notification, press pause. Upload it unlisted to YouTube or Google Drive
and paste the link.

**Data safety:** see section 3.

**Account deletion:** in-app (Settings › Take a break or delete your account) **and** the web
address `https://tomyrealm.com/delete-account`, which works without the app or signing in.

## 3. Data safety answers

General questions:
- Collects or shares user data: **Yes**
- All data encrypted in transit: **Yes**
- Users can ask for their data to be deleted: **Yes** (link above)
- Data shared with third parties: **No.** The services Realm runs on (Neon, Oracle Cloud,
  Cloudflare, Resend, Firebase) process data **for** Realm, which Google counts as "service
  providers", not sharing.

What is **collected** (all: *not* optional unless marked, *not* shared, *processed* for the
reasons given, never for ads or analytics):

| Google's type | What it is in Realm | Purpose |
|---|---|---|
| Personal info › Name | display name, username | App functionality, Account management |
| Personal info › Email address | sign-in and codes | App functionality, Account management, Security |
| Personal info › Other info | birthday (age check) | App functionality, Security (protecting under-18s) |
| Personal info › User IDs | account ID | App functionality, Account management |
| Location › Approximate location | "Use my location" in Explore, rounded; **optional** | App functionality |
| Location › Precise location | a place the user chooses to send in chat; **optional** | App functionality |
| Messages › Other in-app messages | DMs, group chats, Space rooms | App functionality |
| Photos and videos › Photos, Videos | posts, Stories, profile pictures, chat; **optional** | App functionality |
| Audio › Voice or sound recordings | voice messages; **optional** | App functionality |
| Audio › Music files | songs the user uploads to their library; **optional** | App functionality |
| Files and docs | files sent in chat; **optional** | App functionality |
| App activity › App interactions | likes, follows, saves, songs played (Recently played) | App functionality |
| App activity › Other user-generated content | posts, comments, Stories, notes, polls; Ask Realm help questions (processed ephemerally, not stored) | App functionality |
| App info and performance › Crash logs / Diagnostics | **Not collected** (no crash or analytics tools) | — |
| Device or other IDs | the phone's notification token (Firebase), if notifications are on | App functionality |

Not collected: financial info, health, contacts, calendar, web history, installed apps, SMS/call
logs, advertising ID.

Calls: voice and video pass through Realm's own server live and are not stored, so they are not
"collected".

**Keep this in step with the privacy policy.** When Realm starts collecting something new, both
change in the same piece of work.

## 4. Store listing (Grow › Store presence › Main store listing)

**Short description** (80 characters max):
> Spaces, posts, clips and voice for your crew. Your colours, your Realm.

**Full description:**
> Realm is one app for your friend group.
>
> SPACES: rooms for your crew, with roles, moderators and your own rules.
> POSTS AND CLIPS: share photos, videos and words-only posts; follow the people you care about.
> MESSAGES: one-to-one and group chats, voice messages, photos and files.
> MUSIC: a free library to listen to together, and show friends what you're playing (or don't).
> YOUR LOOK: pick your colours and fonts, or build a whole theme.
>
> Safety is built in: report anything, block or mute anyone, private profiles, and extra
> protection for people under 18. No ads, no tracking.
>
> Realm is in beta: things will change, and your feedback shapes it.

(Never say "end-to-end encrypted" in the listing until it's real.)

| Asset | File |
|---|---|
| App icon 512×512 | `infra/store/play-icon-512.png` |
| Feature graphic 1024×500 | `infra/store/feature-graphic.png` |
| Phone screenshots (2–8, 9:16) | `infra/store/screenshots/` |

Category: **Social**. Contact email: info@tomyrealm.com. Website: https://tomyrealm.com.

## 5. Build and upload

From `frontend/app` on your PC (Expo account needed; the free plan's monthly builds are enough):

**Once, before the first build:** give Expo's build servers the Firebase file (it stays out of
Git), or the Play app gets no phone notifications:

```powershell
npx eas-cli env:set --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility sensitive --environment production --environment preview
```

Then:

```powershell
npx eas-cli build -p android --profile production
```

That makes an `.aab` with the live server's addresses built in. **The first upload must be done
by hand:** Play Console › Test and release › Testing › **Closed testing** › create a track (or use
"Alpha") › Create new release › upload the `.aab`. Let Google manage the app signing key (the
default). Release name like `0.1.0 (1)`; release notes: what's new for testers.

Later builds can go up with `npx eas-cli submit -p android --profile production` (it sends to the
closed "alpha" track as a draft), once a Google service account key is set up for EAS.

For your own phone before Play: `npx eas-cli build -p android --profile beta-apk` gives an APK you
can install directly.

### Each update after that

1. Raise `version` in `frontend/app/app.json` (0.1.0 → 0.2.0, or 0.1.1 for small fixes).
2. Add an entry **at the top** of `shared/contracts/src/changelog.ts` with the same version: a
   title, up to 5 short highlights (what the app's "What's new" box shows), and the longer
   sections (what tomyrealm.com/changelog shows). A test fails if the two versions don't match.
3. Commit, push, update the server (`docs/BETA-SERVER.md`), then build and upload as above.

Each tester sees the "What's new" box once, the first time they open the new version. Someone
installing for the first time gets the 7-step tour instead (it can be taken again from Settings).

## 6. Testers: 12 people, 14 days

1. Closed testing › your track › **Testers** › make an email list with each tester's **Google
   account** email (the one on their phone). Aim for **15–20**, so a few dropping out doesn't
   break the 12.
2. Add the countries they live in (Countries / regions).
3. Feedback channel: info@tomyrealm.com.
4. Send **review**. Google reviews the first closed release (from hours to a few days).
5. Once approved, copy the **opt-in link** and send it with the message below.
6. Each tester must **accept the invite, install from Play, and stay opted in**. The 14 days
   count only while 12 or more are opted in at once, without a break.
7. During the 14 days: send an update or two (Google looks at whether the test was real), and
   answer feedback.
8. After 14 days: Dashboard › **Apply for production**. Google asks how testers were recruited,
   what feedback came in and what changed. Keep notes from day 1 (`docs/BETA-FEEDBACK.md` is a
   good place).

### Message to send testers

> Hi! I'm testing my app Realm before it goes public and need your help for 2 weeks.
> 1. Open this link on your Android phone, signed in with this Google account: [opt-in link]
> 2. Tap "Become a tester", then "Download it on Google Play" and install Realm.
> 3. Make an account and use it a few times a week: post something, message me, join my Space.
> 4. Please keep it installed for at least 14 days (that's Google's rule for new apps).
> Anything broken or confusing? Reply here or email info@tomyrealm.com.

### What to ask testers to try

- Sign up, verify the email, set a profile picture and bio.
- Post a photo, a video and a words-only post; like, comment, save.
- Post a Story; watch other people's Stories.
- Message someone; send a photo, a voice message and a file; start a group chat.
- Join a Space and chat in a room (voice rooms: on tomyrealm.com for now).
- Play a song from the music library, lock the phone, keep listening.
- Change colours and font in Settings › Themes.
- Report a post and block someone (test accounts are fine).
- Deactivate (Take a break), sign back in.

## 7. Known gaps to tell testers about

- **Notifications are new:** tell us if one doesn't arrive, comes twice, or opens the wrong screen.
- **Ask Realm** (Settings › Help) is a simple helper with fixed answers, there for the beta only.
- **Voice rooms are on the website only** for now; the app says so and points there.
- **Messages are not end-to-end encrypted yet** (the privacy policy says so).
- Spotify listening is limited by Spotify's rules for apps in development; the free library works.
