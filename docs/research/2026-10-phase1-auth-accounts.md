# Phase 1 research: Auth and accounts

Status: complete, 2026-10-04. Research only; no source code was changed. Legal points are not legal advice.

Scope: Phase 1 sign up (13+ age gate), sign in, sign out, email verification (code and link), forgot/reset password, change password, and the session/device list. Realm lets people in before they verify (owner decision). Passkeys, 2FA and OAuth come later; section 6.2 item 15 lists what Phase 1 must do now so they slot in.

## Top recommendations

1. **Ask the birthday first, on its own step, then the account fields.** The FTC says an age-screening service "may not collect personal information from any visitor prior to collecting age information"; today Realm asks it last. (6.2.1, 6.3 B–C)
2. **Enforce the under-age hold on the server** with a signed HttpOnly cookie, not just `localStorage`. The FTC recommends a cookie for exactly this, and TikTok blocks immediate re-tries. (6.2.2)
3. **Treat 13 as a default, not a constant.** Australia's under-16 rule has applied since 10 Dec 2025, and an enforcement bill passed Parliament on 10 Sep 2026. Realm looks closer to the in-scope platforms than to the exempt ones (*inference*). Store a per-country minimum age and an age-assurance level now, and get legal advice before admitting Australian users. (2, 6.2.3)
4. **Fix the verification link edge cases.** An already-verified person, or a mail scanner that opened the link first, gets "This link isn't valid anymore". Show "already verified" instead, and confirm with a button press. Also fix the code field's `maxLength`, which cuts pasted codes. (6.2.4–5)
5. **Screen new passwords against breached and common lists in Phase 1.** It's a NIST SHALL and an ASVS L1 requirement, and the Pwned Passwords range API is free and private. (6.2.7)
6. **Make the device list complete and safe:** approximate location (the field exists but is never filled), re-authentication before "sign out all other devices" (ASVS 7.5.2), and a "new sign-in" email for unfamiliar browsers. (6.2.6, 6.2.9–10)
7. **Show real wait times** on rate limits and resend cooldowns instead of "Try again shortly". (6.2.8)
8. **Move auth into the new world, and drop the old one's weight.** The auth pages still use the old look: the 3D black hole, the astronaut crew, the day/night toggle and amber links. Replace them with the still, lit ink ground, a Funnel Display title, Atkinson for everything else, one Mint action pill, and on wide screens one still phone frame showing a real app screen. That also removes three.js from a form page. (6.4)
9. **Shape the API for Phase 2 now:** make the sign-in response a union that can ask for a second step, record `authenticatedAt` and `authMethod` on sessions, and add a recent-auth check. (6.2.15)

Already right and worth keeping: the generic sign-in error, the non-enumerating reset with no auto sign-in, no composition rules and no confirm-password field, a labelled Show/Hide, a single one-time-code input, and the neutral DOB wording. (6.1)

## 1. UX best practice per flow (2025–2026)

All sources checked 2026-10-04. Full URLs in the Sources list.

### Passwords: NIST SP 800-63B revision 4 (final, dated 26 August 2025) [NIST]
- Length over composition. Minimum **15 characters when a password is the only factor**, 8 when it is one factor of MFA. Allow at least 64. "Verifiers and CSPs SHALL NOT impose other composition rules" (§3.1.1.2).
- Accept all printing ASCII, the space, and Unicode (normalised to NFC). Never truncate; check the whole password.
- **No forced rotation**: "SHALL NOT require subscribers to change passwords periodically", but SHALL force a change on evidence of compromise.
- **Blocklist**: compare new passwords against "known commonly used, expected, or compromised passwords".
- **Password managers and paste**: SHALL allow password managers and autofill; SHOULD allow paste; SHOULD offer to display the password.
- No hints, no knowledge-based questions.
- Throttling: no more than 100 consecutive failures on one account before disabling that authenticator (§3.2.2).
- Session reauthentication at AAL1: overall timeout SHOULD be no more than 30 days; idle timeout optional (§2.1.3). At AAL2: 24 hours overall, 1 hour idle.
- **Email is not an out-of-band authenticator**: "Email SHALL NOT be used for out-of-band authentication" (§3.1.3.1). It is fine for *proving you own an address* (verification) and for recovery links, but an "email me a sign-in code" option is account-recovery strength, not a second factor.
- OWASP's Authentication Cheat Sheet repeats the same numbers (8 with MFA, 15 without, 64 maximum, no composition rules, no truncation) and recommends a strength meter (zxcvbn) and a Pwned Passwords check [OWASP-Auth].
- Breach screening is cheap: the Pwned Passwords range API takes the first five SHA-1 characters (k-anonymity), needs no key, is free, and supports `Add-Padding: true` [HIBP].

### Field count, order and validation timing
- Ask for as little as possible on the first screen. The modern products in section 5 either go identifier-first (one field, then route) or show 4–6 fields on one screen; nobody asks for an email twice except Steam (section 5).
- **Don't ask for the password twice.** GOV.UK removed every "confirm password" field once it shipped a show-password option [GOV.UK-blog, search summary]. WCAG 3.3.7 allows a re-type of a new password as a security exception, but doesn't require it [W3C-337]. OWASP's Forgot Password sheet still suggests entering it twice [OWASP-Forgot]; a Show toggle meets the same need with less effort.
- **Validation timing** (*synthesis*): validate on submit first; after a failed submit, re-validate each field as it changes so errors clear the moment they're fixed (Realm already does this). Don't show errors while someone is still typing a field for the first time. Async checks (username availability) run on a pause, never block typing, and announce politely.
- **Dates of birth** (GOV.UK) [GOV.UK-dates][GOV.UK-date-input]: three fields; "Never automatically tab users between the fields"; accept month names ("jan"); use `bday-day`, `bday-month`, `bday-year`; errors "Date of birth must include a month", "Date of birth must be a real date", "Date of birth must be in the past". GOV.UK prefers text inputs over selects; *judgement:* for an international audience a named-month select is a reasonable exception because "03/04" means different dates in different countries; Discord, Instagram, TikTok and Snapchat all use named months (section 5).

### Autocomplete, one-time codes, paste
- Sign-in identifier `autocomplete="username"`, current password `current-password`, new password `new-password`, email `email`. The code field: `type="text"` (not `number`, which strips leading zeros and adds spinners), `inputmode="numeric"`, `autocomplete="one-time-code"`, optional `pattern="\d{6}"`. "Using a form with an `<input>` element is the most important best practice" [web.dev-OTP].
- SMS codes (Phase 3 if phone numbers arrive) should end with the origin-bound line `@realm.example #123456` so the browser can offer the code and phishing sites can't [web.dev-OTP].
- Paste must work in every field, including codes; WCAG 3.3.8 fails a flow where the code has to be transcribed by hand [W3C-338].

### Code entry: one field or six boxes
- One input is the accessible default. Separate boxes are "difficult to navigate with a screen reader or keyboard", and segmented numbers produce labels that aren't meaningful to screen-reader users [OTP-single, search summary]. A 2025 study of screen-reader users found OTP, push and passwordless flows break down in practice and that short expiry adds time pressure [Akanda-2025, search summary].
- If a six-box look is wanted, build it as **one real input** styled to look like boxes (letter-spacing or a background of six cells), so paste, autofill and screen readers see one field [OTP-single].
- Auto-submit when the sixth digit arrives is common; tell people beforehand ("It checks itself when all 6 digits are in") so it isn't an unexpected change (WCAG 3.2.2, *interpretation*).

### "Check your email", resend, magic link plus code, expired links
- GOV.UK's email-confirmation pattern [GOV.UK-email]: show the address you sent to; explain what to do; let people resend "in case they entered the wrong email address previously or the email did not arrive"; expire links when used once, superseded by a newer one, or when the email changes; and on an expired or used link "explain that it's expired, and why". It describes *non-blocking* confirmation (people continue, with reminders and some features restricted), which is Realm's model.
- **Code and link in one email** cover both cases: the code works when the email is open on a different device (cross-device), the link when it's on the same one. *Synthesis*: the link should only *verify*, never sign the browser that opens it in, because the device that opens it may not be the one that signed up.
- **Mail scanners open links.** Corporate gateways (Microsoft Defender Safe Links, Mimecast, Proofpoint) fetch links before the person sees the email and burn single-use tokens; the standard fix is a landing page with a button that does the POST, or making the action idempotent [magic-link-scanners, search summary; multiple open-source fixes in 2025–26].
- **Resend timing** (*synthesis*, no standard found): a visible 30–60 s cooldown on "Send a new code", a server limit per hour, and every resend invalidates the previous code and link (GOV.UK's "superseded"). Say how long codes last.

### Errors that don't reveal accounts, and rate-limit messages
- Sign-in: one message for wrong username and wrong password; OWASP's example "Login failed; Invalid user ID or password" [OWASP-Auth]. Reset: "If that email address is in our database, we will send you an email to reset your password" [OWASP-Auth]. Keep response times the same for both cases.
- Rate limits: say what happened and when it ends. *Synthesis*: a 429 without a time makes people retry and extend the lock.

### Reset and change password
- Reset tokens: random, single-use, short expiry, stored hashed; "Don't automatically log the user in"; invalidate sessions or ask; `Referrer-Policy: no-referrer` on the reset page; rate-limit per account; never lock an account because of reset requests; change nothing until a valid token is used [OWASP-Forgot].
- Change password requires the current one (ASVS 6.2.3) [ASVS-V6]; after a change, offer to (or automatically) end other sessions (ASVS 7.4.3) [ASVS-V7]; notify the user (OWASP; ASVS 6.3.7 at L3) [OWASP-Auth][ASVS-V6].

### Session and device lists
- ASVS 5.0 7.5.2 (L2): users can "view and (having authenticated again with at least one factor) terminate any or all currently active sessions" [ASVS-V7]. 7.4.4: logout is easy to reach from every signed-in page.
- What to show (*synthesis* from the products below and ASVS): device type, browser and OS, approximate location labelled as approximate, last active, when it signed in, a "this device" marker, sign out one, sign out all others. Google, Discord and others show city or region from the IP (*common knowledge; their settings pages are behind sign-in and weren't captured*).

## 2. Age gates and the law

Every fact dated; checked 2026-10-04 unless stated. *Not legal advice.*

### How the products gate age (as of October 2026)

| Product | What happens | Source |
|---|---|---|
| **Discord** | Sign-up asks DOB (Day/Month/Year selects, required) on the one form (capture). Accounts that indicate under 13 (or the country's digital-consent age) are disabled; an appeal needs a selfie holding photo ID and the username (user reports on Discord's support forum, search summary). **9 Feb 2026:** announced "teen-by-default" for all accounts worldwide, with age inference from account signals, on-device facial age estimation or ID to unlock adult settings; then delayed to the second half of 2026. A third-party blog reports the global rollout launched **23 Sep 2026** (not confirmed on Discord's page). | [Discord-PR], [Redact-2026], [Discord-support-posts] |
| **Instagram** | DOB on the sign-up form (capture). Teen Accounts (under 16 private by default, stricter limits) since 2024. AI age prediction places suspected teens into Teen Accounts "even if the account lists an adult birthday": US test April 2025; expanded to Brazil and all 27 EU countries on **5 May 2026**. | [TechCrunch-2025-04-21], [HelpNet-2026-05-05] |
| **TikTok** | DOB is the first question (capture). TikTok calls its gate neutral ("don't hint or nudge people towards entering the 'right' age") and, after a failed gate, "suspends their ability to immediately re-create an account using a different date of birth"; signals and moderators look for under-13s afterwards. In the US, an under-13 birthday leads to a separate view-only younger-users experience. | [TikTok-newsroom], [CommonSense, search summary] |
| **Snapchat** | Birthday in step 1 of 3 (capture). Terms say the service is not for under-13s (search summary). | captures; [search summary] |
| **Roblox** | Birthday is the first field (capture); under-13 accounts are allowed with restrictions. Since **January 2026**, a facial age check (Persona) is required to use chat anywhere; six age bands, and people can only chat within nearby bands. | [BiometricUpdate-2026-01] |
| **BeReal** | Terms: 13+ only; phone number, name, birthday, username at sign-up; no further age verification reported. Web has no sign-up (capture). | [BeReal-terms, search summary], [InternetMatters, search summary] |

The pattern by 2026: a neutral self-declared DOB is the *entry* gate everywhere, and it is no longer considered enough on its own; the big platforms layer age inference, facial estimation or ID checks on top, mostly to unlock adult features rather than to block sign-up.

### Law

- **US, COPPA.** FTC amended the COPPA Rule: published **22 Apr 2025**, effective **23 Jun 2025**, full compliance by **22 Apr 2026** (adds limits on retention, biometric identifiers as personal information, a "mixed audience" definition) [NatLawReview, search summary]. FTC's COPPA FAQ (checked 2026-10-04): a neutral age screen lets users "freely ... enter month and year of birth" without nudges (H.3); FTC staff recommend "using a cookie to prevent children from back-buttoning to enter a different age" (H.3); a mixed-audience operator "may not collect personal information from any visitor prior to collecting age information" (D.4); once you learn a user is under 13 you have actual knowledge and must get parental consent or delete (H.1) [FTC-FAQ].
- **UK, Age Appropriate Design Code (Children's code).** In force since 2 Sep 2020 with conformance expected from 2 Sep 2021 (*dates from prior knowledge; the ICO page fetched doesn't state them*). Standard 3: take "a risk-based approach to recognising the age of individual users"; self-declaration "may be suitable for low risk processing or when used in conjunction with other techniques"; options listed include AI estimation, third-party attribute checks, account-holder confirmation, technical measures, and hard identifiers (discouraged unless the risk warrants) [ICO-std3].
- **UK, Online Safety Act.** Ofcom's Protection of Children duties took effect **25 Jul 2025**. Services that allow the most harmful content (pornography, suicide, self-harm, eating-disorder content) must use "highly effective age assurance"; self-declaration is explicitly not highly effective [Ofcom, search summary]. *Inference:* Realm prohibits those categories, so highly effective age assurance isn't automatically required, but as a user-to-user service likely to be accessed by children it still owes a children's risk assessment and the children's codes before UK public launch.
- **EU, DSA Article 28.** Commission guidelines on protecting minors published **14 Jul 2025**: self-declared age is not sufficient on its own; providers should assess whether age verification or estimation is appropriate and proportionate; methods must be accurate, reliable, robust, non-intrusive, non-discriminatory; an EU age-verification app blueprint entered a pilot [Freshfields / DSA-Observatory, search summary]. GDPR Article 8 lets member states set the digital-consent age between 13 and 16 (*prior knowledge*); it matters where processing relies on consent.
- **Australia, social media minimum age (under 16).** Precisely, as of 4 Oct 2026:
  - The Online Safety Amendment (Social Media Minimum Age) Act 2024 received assent on **10 Dec 2024**; the obligation on "age-restricted social media platforms" to take reasonable steps to stop under-16s holding accounts has applied since **10 Dec 2025**. ID documents cannot be the only method offered; there's no parental-consent exception; the maximum penalty is A$49.5 million [Wikipedia-OSA, eSafety].
  - eSafety treats ten platforms as age-restricted: Facebook, Instagram, Kick, Reddit, Snapchat, Threads, TikTok, Twitch, X, YouTube. Not restricted include Discord, GitHub, Google Classroom, Messenger, Pinterest, Roblox, Steam, WhatsApp, YouTube Kids [eSafety via search summary; Wikipedia-OSA]. eSafety reported 4.7 million under-16 accounts removed by mid-December 2025 (search summary of eSafety's page; the page itself timed out when fetched).
  - **Late March 2026:** the government said it would investigate Facebook, Instagram, Snapchat, TikTok and YouTube; eSafety's March 2026 compliance update raised concerns about low-confidence checks [Wikipedia-OSA; Pinsent Masons].
  - **10 Sep 2026:** Parliament passed the Online Safety Amendment (Strengthening Enforcement for the Social Media Minimum Age) Bill 2026 (the House agreed to the Senate's amendments that day): wider information-gathering powers (including over age-assurance vendors and app stores) and a doubled maximum penalty, reported as A$99 million (Pinsent Masons, updated 7 Jul 2026) or A$109.2 million (MLex). The difference is probably the penalty-unit value; not resolved here. **Royal assent and commencement were not confirmed in this run.** [TheyVoteForYou-2026-09-10], [MLex], [PinsentMasons]
  - High Court challenges (Digital Freedom Project; Reddit) were reported as pending; outcome not confirmed in this run [Wikipedia-OSA].

### What this means for Realm's gate (synthesis)
1. **Neutral entry**: ask DOB with no hint of the cutoff, no pre-filled year, before any other personal data (FTC D.4, H.3).
2. **No retry loop**: an under-age answer ends the flow; a cookie (and the server) keep it ended for a while (FTC H.3, TikTok).
3. **Don't keep what you shouldn't**: an under-age attempt sends nothing else; if the API sees one, it stores nothing (Realm's server already rejects before insert).
4. **Self-declaration is a floor, not the system**: ICO, Ofcom and the Commission all say so. For Phase 1 (private alpha) it's the realistic floor; store the assurance level so stronger checks and teen defaults can follow.
5. **Jurisdiction-aware minimum age**: 13 by default, 16 where the law says so (Australia, *if Realm is in scope*: inference, needs legal advice).

## 3. Accessibility

### WCAG 2.2 SC 3.3.8 Accessible Authentication (Minimum), AA [W3C-338]
- Normative: no cognitive function test "(such as remembering a password or solving a puzzle)" at any step, unless there's an alternative without one, a mechanism to help (password managers, paste), object recognition, or recognising your own content.
- What it means here:
  - **Passwords pass only because password managers and paste work.** Never block paste, never break autofill (correct `autocomplete`, a real `<form>`, stable field names).
  - **Codes:** a flow where the user must re-type a code by hand fails; paste or autofill must work. Splitting a code so that it can't be pasted fails. "Enter the 1st, 3rd and 5th digit" fails.
  - **Email links** are listed as a sufficient technique, so the magic link is itself an accessible path.
  - **CAPTCHAs:** text and puzzle CAPTCHAs fail even with audio alternatives if transcription is required; object recognition is excepted at AA (but not at AAA, 3.3.9). *Inference:* Epic's Cloudflare checkbox and Steam's hCaptcha are acceptable only while they stay non-puzzle. Realm should avoid visible challenges in Phase 1 and rely on rate limits.
  - **2FA (Phase 2):** there must be a path without a cognitive test; TOTP codes are fine if paste works; passkeys are the best path.

### WCAG 2.2 SC 3.3.7 Redundant Entry, A [W3C-337]
- Information already entered in the same process must be auto-populated or selectable, except where re-entry is essential, needed for security, or no longer valid. Multi-step sign-up counts as one process.
- For Realm: going back from step 2 to the birthday step (and forward again) must keep what was typed; the username suggestion from the display name is helpful; the email typed on `/forgot` should carry into `/login` if they go back; don't ask for the email twice. Re-typing a new password is allowed as a security exception but unnecessary with Show.

### Focus, error summaries, announcements (synthesis, with GOV.UK practice)
- On submit with errors: one error → move focus to that field; two or more → an error summary at the top (heading "There's a problem" or "2 things to fix", each error a link to its field), focused (GOV.UK error-summary practice, *prior knowledge*). Each field error is in the field's `aria-describedby` and the field has `aria-invalid`.
- Form-level failures (wrong password, rate limit) go in a `role="alert"` region placed before the fields; success notes (code resent, link sent) in `role="status"`. Realm's `FormNotice` already does this.
- After success that replaces the form (link sent, password changed), move focus to the new heading so screen-reader users hear the new state.
- **Code field:** label "6-digit code" (visible), hint "From the email we sent to x@y.com", `aria-describedby` to hint and error. Don't announce each digit or a countdown each second; announce once when a resend becomes available. Give enough time (Realm's 15 minutes is generous; the 2025 study found time pressure is a real failure point) [Akanda-2025].
- **Show/Hide password:** a real `<button type="button">` with visible text, `aria-pressed` or changing text ("Show"/"Hide"), and a polite live message "Your password is shown" / "hidden" (GOV.UK's password-input behaviour, *prior knowledge*). It must not submit the form or move focus.
- **Date of birth:** a `fieldset` with a `legend`; each part labelled; error on the group when the whole date is wrong, on one part when only that part is (GOV.UK) [GOV.UK-date-input].
- **Touch and zoom:** 16px+ input text on iOS to avoid zoom; 44px+ targets; the primary button reachable above the phone keyboard (`dvh`/`svh`).
- **Dyslexia and short attention** (PRODUCT.md priority): one question per screen where possible, labels in plain words, hints short, Atkinson for every read word.

## 4. Security UX (OWASP)

From OWASP ASVS 5.0 (V6 Authentication, V7 Session Management) and the Authentication and Forgot Password cheat sheets, checked 2026-10-04 [ASVS-V6][ASVS-V7][OWASP-Auth][OWASP-Forgot]. Only items that change what people see.

| Topic | Requirement | Realm today (code read 2026-10-04) |
|---|---|---|
| Generic sign-in errors | Same message and timing for unknown user and wrong password (OWASP; ASVS 6.3.8 at L3) | Done (dummy verify for unknown users). |
| Enumeration on reset | "If that email address is in our database..." (OWASP) | Done. |
| Enumeration on sign-up | OWASP: reply "A link to activate your account has been emailed to the address provided" rather than confirming | Reveals "An account already uses this email". Conflicts with signing people in before verification; see 6.2 item 14. |
| Password rules | ASVS 6.2.1 ≥8 (15 strongly recommended), 6.2.5 any composition, 6.2.7 paste and managers, 6.2.9 ≥64 allowed, 6.2.10 no rotation | Done (10–256). |
| Common/breached passwords | ASVS 6.2.4 (L1) top-3000 check; 6.2.12 (L2) breached databases | **Missing** (planned for Phase 2; recommend Phase 1). |
| Brute force | ASVS 6.3.1 controls against stuffing and brute force; OWASP: lockout or exponential back-off, CAPTCHA only after several failures; NIST ≤100 consecutive failures | Rate limits per IP and per identifier; the per-identifier limit can be abused to lock out a known user (6.2 item 13). |
| Change password | ASVS 6.2.3 requires current and new | Done. |
| Terminate sessions after a factor changes | ASVS 7.4.3 (L2) option to end other sessions | Done automatically on change and reset. |
| View/terminate sessions | ASVS 7.5.2 (L2) with re-authentication | List and revoke done; **no re-authentication**. |
| Re-verify before sensitive changes | ASVS 7.5.1 (L2) full re-auth before changing auth-related attributes (email, password, 2FA) | Password change needs the current password; no general recent-auth mechanism yet. |
| Notify on auth changes | ASVS 6.3.7 (L3); OWASP: notify on new device/location login, recovery, email or password change | Password-changed email done; **no new-sign-in email**. |
| Suspicious attempts | ASVS 6.3.5 (L3) notify | Not yet (Phase 2 security log). |
| Email as a factor | ASVS 6.3.6 (L3) and NIST: email not an authentication factor | Email only verifies and recovers. Keep it that way; a future "email me a code to sign in" is recovery-grade. |
| Reset tokens | Single use, expiring, no auto sign-in, sessions invalidated, no lockout from resets, `Referrer-Policy: no-referrer` | Done except Referrer-Policy is `strict-origin-when-cross-origin` site-wide; that already withholds the path and query cross-origin, so the token doesn't leak; `no-referrer` on `/reset` and `/verify` is a cheap belt-and-braces. |
| Session lifetime | ASVS 7.3.1/7.3.2 (L2) idle and absolute timeouts per documented risk; NIST AAL1 ≤30 days overall | 30-day sessions renewed on activity, so effectively no absolute limit. *Judgement:* fine for a social app at alpha; document it, and require recent auth for sensitive actions instead. |
| Logout reachable | ASVS 7.4.4 | Account menu and Settings. |

## 5. What the captured products do

Source: 78 screenshots in `docs/research/phase1-captures/auth/` (desktop 1440x900 and phone 390x844 at 2x), taken signed out with headless Chrome in an earlier run of this task. Viewed 2026-10-04. Observations are direct from the images unless marked *inference*.

**The capture location shows.** The captures came from a Turkish IP: Spotify's sign-up was covered by "Looks like you're in Turkey ... sign up on a different page", Snapchat's Google button reads "Google ile kaydolun", Steam preselects Türkiye. Anything region-gated below may look different elsewhere.

**Five captures show no auth form at all**, which is itself a finding about bot defence:
- Epic (login and register): Cloudflare "One more step / Verify you are human" before any form, with the session ID and IP address printed on the page.
- Reddit (login and register): "You've been blocked by network security", a full stop with a "File a ticket" button and the mascot. Headless Chrome tripped it.
- Arc and Raycast: their login URLs returned 404 pages (both are now download-first products; Raycast's 404 keeps its full marketing header and footer).
- BeReal's web root is a marketing page (full-bleed video of friends, "Get the app") with a cookie banner; there is no web sign-up.
Not captured as forms, so not counted below. *Inference:* for Realm, a challenge wall in front of sign-in is the worst possible first impression and also fails WCAG 3.3.8 if it is a puzzle (see section 3). Rate limits and silent risk scoring should come first; an accessible challenge only when the risk is real.

### Layout families

| Family | Who | What it looks like |
|---|---|---|
| Centred card on brand art | Discord, Roblox, Steam sign-in | A dark card in the middle of an illustrated or collage background. Discord: a purple-blue gradient with floating 3D objects; Roblox: a wall of game thumbnails; Steam: a darkened game-art collage. |
| Centred column on flat ground, no card | Spotify, TikTok, Twitch, Vercel login, Linear, Figma, Notion, Snapchat (white card on grey) | The logo, a headline and a narrow column (about 300–420px). Brand comes from one colour (Spotify's green button, Twitch's purple focus ring) and the headline type. |
| Split screen | Instagram login | Left: tagline "See everyday moments from your close friends" with "close friends" in the brand gradient and a fan of photo cards; right: the form. Phone: the art is dropped entirely. |
| Modal over the product | Bluesky | The real feed blurred behind a modal with a sky-and-clouds image, three lines of positioning, "Create account" and "Sign in". On phone it shows the real public feed with a bottom bar "Create account / Sign in". |
| Full-bleed art behind a choice | Threads | Huge ribbon typography ("THREADS") across the top, then two choices: "Use your Instagram account" / "Use your mobile number". |
| QR-first | Telegram Web; Discord login (side panel); Steam sign-in (side panel) | The QR code is the hero; phone number and passkey are text links under it. |
| Inside the product chrome | Partiful | The sign-in sits inside the app's own sidebar shell with a soft multicolour gradient wash at the top. One field: phone number. |

### Steps and fields counted (sign-up)

| Product | Step 1 fields | Age gate | Notes |
|---|---|---|---|
| Discord | Email, Display name (optional), Username, Password, DOB (Day/Month/Year selects), optional marketing checkbox | DOB on the first screen, required | One screen, 5 inputs + 3 selects. Terms line above the button. |
| Instagram | Mobile or email, Password, DOB (selects, with a ? explainer), Full name, Username | DOB on the first screen | The desktop page is a single long form; the phone capture overflows sideways (the left edge is cut off), a real layout bug at 390px. |
| TikTok | DOB first ("When's your birthday?" with "Your birthday won't be shown publicly"), then Email, Password (with eye toggle), 6-digit code + "Send code" in the same form, marketing checkbox | DOB is the first question | Email verification happens *inside* sign-up, before the account exists. |
| Snapchat | Continue with Google, then First name, Surname (optional), Birthday (Month/Day/Year), Username ("You can change this later"), Password (eye toggle, "must be at least 8 characters") | DOB mid-form | "Step 1 of 3" under the title; a long ad-funded-service disclosure before "Agree and continue". |
| Roblox | Birthday (Month/Day/Year) first, Username (placeholder "Don't use your real name"), Password (placeholder "At least 8 characters"), Gender (optional, two icon buttons) | DOB is the first field | Under-18 parental consent sentence in the legal text. The privacy nudge in the username placeholder is good; using placeholders as the only hint is not (it vanishes on typing). |
| Steam | Email, Confirm email, Country, hCaptcha "I am human", "I am 13 years of age or older" checkbox | A self-declared checkbox, not a DOB | The weakest gate: a tick box that states the age it wants. Also asks for email twice (fails the spirit of WCAG 3.3.7). |
| Twitch | Email (or "Use phone number instead"), Continue | Later step (not visible) | Progressive: one field, then more. |
| Spotify | Email address, then further steps | Later step | Progressive. Region-gated in this capture. |
| Figma | Continue with Google, or Email + "Continue with email" | n/a | One field. |
| Vercel, Linear | OAuth buttons first; email behind "Continue with Email" | n/a | Developer tools; email is the second-class path. |
| Duolingo | Starts with "I want to learn..." course picker; the account comes later | Later | Value first, account second. |

Sign-in field counts: Discord 2 (email or phone, password) plus QR and "sign in with a passkey"; Duolingo 2 (email or username, password with "FORGOT?" inside the field); Roblox 2 plus "Email Me a One-Time Code" and "Quick Sign-in"; Steam 2 plus QR and "Remember me" (pre-ticked); Twitch 2 with an eye toggle and "Trouble logging in?"; Snapchat 1 then "Next" (identifier first), passkey and Google below; Spotify, Vercel, Notion, Figma sign-up, Twitch sign-up: identifier first, one field and "Continue"; TikTok: a menu of five methods (QR, phone/email/username, Facebook, Google, Apple) before any field.

### Patterns worth noting

- **Identifier first is now the majority on the modern products** (Spotify, Snapchat, Vercel, Notion, Figma sign-up, Twitch sign-up, Partiful). It lets the server route to password, passkey, SSO or code. *Inference:* it is how Realm's sign-in can grow passkeys in Phase 2 without a redesign.
- **Passkey links are already common on sign-in**: Discord ("Or sign in with a passkey"), Snapchat, Linear, Vercel, Notion, Telegram. None of these put the passkey above the password for a signed-out visitor yet.
- **Email-me-a-code as an alternative to the password**: Roblox ("Email Me a One-Time Code"). TikTok puts the 6-digit email code into the sign-up form itself.
- **Show-password toggle**: present on Twitch, Snapchat, TikTok (eye icon inside the field). Icon-only in all three; Realm's labelled "Show"/"Hide" button is better for accessibility.
- **Placeholder-as-label** remains common (Duolingo, Roblox, Vercel, Instagram login, TikTok); Discord, Spotify, Snapchat, Twitch and Notion use real visible labels. Figma's tiny all-caps monospace labels inside grey fields are the hardest to read.
- **Marketing consent** is an unticked, optional checkbox on Discord and TikTok.
- **Legal line** sits directly above (Discord, Snapchat) or below (Linear, Vercel, Notion) the primary button; nobody uses a "I agree" checkbox except Steam.
- **reCAPTCHA notice text** in the footer (Duolingo, Spotify) shows those two run invisible risk scoring instead of a visible challenge.
- **Cookie banners**: TikTok's covers the bottom 40% of the phone sign-up form, hiding "Next"; BeReal's floats over the hero. Both offer a reject option at equal weight (TikTok "Decline optional cookies", BeReal "Reject all").

### How brand carries into auth

- **Strongest without becoming a marketing page:** Spotify (huge bold "Welcome back" in its display face, one green button; nothing else) and Discord (the brand's illustrated night sky behind a plain, readable card). Both keep the form itself neutral and put the brand in type, one colour and the ground.
- **Threads** shows how far type alone goes: its ribbon wordmark is the art.
- **Instagram's split screen** sells the product ("close friends", a fan of real-looking photos) on desktop, and quietly drops the art on phones.
- **Roblox** carries the most brand (a wall of game art) and pays for it in legibility: the card's grey-on-grey fields and a disabled-looking grey "Sign Up" button.
- **Generic:** Figma, Notion, Vercel, Linear and Twitch are almost interchangeable at a glance (logo, centred column, stacked OAuth buttons). They read as tools, not places.

### Mobile handling

All forms collapse to a single column at 390px. Art is dropped (Instagram, Steam) or reduced to a header band (Discord keeps the logo only; Roblox keeps a strip of game art behind the card). Instagram's phone login shows only "Open Instagram" / "Log in or Sign up" and pushes the app. Partiful and Snapchat push "Get the app" / "Open Snapchat" pills above the form. Problems seen: Instagram sign-up overflows horizontally; TikTok's cookie banner hides the primary action; Reddit's phone register page shows the block as a red toast over a blank pattern.

### What feels premium versus generic (judgement)

Premium: one strong headline in the display face, one action colour, real labels, generous spacing, the brand's ground behind a calm form (Spotify, Discord). Generic: a stack of five identical OAuth buttons under a small grey heading (Vercel, Linear, Twitch). Cheap: visible bot walls, placeholder-only fields, disabled grey primary buttons that look broken (Roblox, Twitch "Log In" before typing), and legal walls before the button (Snapchat).

## 6. Recommendations for Realm

Read first (2026-10-04): `frontend/web/src/app/(auth)/*`, `frontend/web/src/features/auth/*`, `frontend/web/src/features/settings/sessions-list.tsx` and `account-forms.tsx`, `frontend/web/src/features/app/verify-banner.tsx`, `backend/api/src/modules/auth/{routes,service,emails}.ts`, `backend/server-core/src/rate-limit.ts`, `shared/contracts/src/schemas/auth.ts`. Section references in brackets point to the evidence above.

### 6.1 What is already right (keep it)

- Sign-in error is generic ("That email or username and password don't match"), with a dummy hash check for unknown users so timing doesn't leak either [4].
- Forgot password says the same thing whether or not the account exists, and the reset link is single-use, expires in 60 minutes, signs out every device, and does not sign the user in afterwards. All match OWASP's Forgot Password sheet [4].
- Change password needs the current password (ASVS 6.2.3), signs out other devices, and sends a "password changed" email [4].
- No composition rules, 256-character maximum, paste allowed, real `type=password` field, a labelled Show/Hide button with `aria-pressed`, no "confirm password" field (NIST, ASVS, GOV.UK) [1].
- The code field is one input with `autocomplete="one-time-code"` and `inputmode="numeric"`, strips non-digits, and the link and the code arrive in the same email [1][3].
- The date of birth is asked neutrally (the form never says the cutoff before it's answered) and the under-age result is a dead end, not a retry loop [2].
- People get in before verifying; a banner in the app carries the code box (owner decision).
- Sessions list: this device first with a "This device" tag, sign out one, sign out all others, server-side revocation.

### 6.2 What should change, in priority order

**Must (correctness, law, or a WCAG/ASVS miss):**

1. **Move the date of birth to its own first step.** The FTC says a general-audience service using an age screen "may not collect personal information from any visitor prior to collecting age information" (COPPA FAQ D.4) [2]. Today the DOB is the last field, after email, password and name. A one-question first step also spares an under-13 typing everything only to be stopped, and it is how TikTok and Roblox order it (section 5).
2. **Make the under-age hold server-enforced.** Today it is `localStorage` only, which a private window clears. The FTC recommends "using a cookie to prevent children from back-buttoning to enter a different age" (FAQ H.3) [2]; TikTok "suspends their ability to immediately re-create an account using a different date of birth" [2]. Set a signed, HttpOnly `age_hold` cookie for 24 hours when the server or client sees an under-age date, have `/auth/register` refuse while it's present, and keep the local flag as a second layer. Never echo the date back.
3. **Plan for per-country minimum ages before serving Australia.** Australia's under-16 rule has applied since 10 December 2025 [2]. *Inference:* Realm (public Spaces, posts, a feed, profiles) looks much more like the in-scope services (Instagram, Reddit, Snapchat, TikTok, Twitch) than the excluded messaging and gaming ones (Discord, Roblox, Steam, WhatsApp), and self-declared age is not "reasonable steps" there. Store `minimumAge` per country in config (13 default) and decide, with legal advice, whether to block Australian sign-ups during the alpha. Store an `ageAssurance` field on the user now (`self_declared` today; `estimated` / `verified` later) so teen defaults and later age checks have somewhere to live.
4. **Fix "already used" verification links.** `verifyEmailWithToken` only matches unconsumed tokens, and `markVerified` consumes every row for the user, so a person who verified with the code and later taps the link sees "This link isn't valid anymore". Mail scanners that pre-open links (Microsoft Defender Safe Links, Mimecast, Proofpoint) cause the same thing [1]. Look the token up regardless of `consumedAt`; if that user's email is already verified, answer success: "Your email is already verified." Also have the link page show a **Verify my email** button that does the POST (the scanner-proof pattern) instead of posting on load, and remove the token from the address bar after reading it (`history.replaceState`).
5. **Fix the code field's `maxLength={6}`.** Browsers cut pasted text to `maxlength` *before* `onChange` runs, so pasting " 123456" (a leading space from some mail clients) or "123 456" keeps only five digits. Drop `maxLength` (or set it to 12) and keep the existing digit-strip and slice. WCAG 3.3.8 requires that a pasted code works [3].
6. **Require re-authentication before signing other devices out**, with a "recent sign-in" window. ASVS 5.0 7.5.2 (L2): users can view and, "having authenticated again with at least one factor", terminate sessions [4]. Ask for the password in a small dialog only if the session's last authentication is older than 10 minutes. Put the same `requireRecentAuth` check in front of email change when that ships (ASVS 7.5.1) [4].
7. **Screen new passwords against breached and common passwords now**, not in Phase 2. It is a NIST SHALL and an ASVS L1 requirement (6.2.4, top-3000 list); breached-database checking is ASVS L2 (6.2.12) [1][4]. Use the Pwned Passwords range API (k-anonymity, first five SHA-1 characters, no key, free, `Add-Padding: true`) [1] with a local top-list fallback when it's unreachable (never block sign-up on the API being down). Copy: "That password has shown up in a data breach, so it's easy to guess. Pick another one." Apply on sign-up, reset and change.
8. **Show the wait time on rate limits.** The API already sends `Retry-After`, but every 429 says "Too many attempts. Try again shortly." Use the number: "Too many tries. Wait 12 minutes and try again, or reset your password." For resend: "You can send another code in 0:42" with a visible countdown (not announced every second).
9. **Fill in location on the devices list.** `SessionInfo.country` exists but is never set, and the list doesn't show it. Resolve the IP with a local GeoIP database at session creation (no third-party call), store country and region only, and show "Approximate location: Ontario, Canada" for the owner only. Show the browser and OS separately ("Chrome on Windows"), "Active now" for the current one, and "Last active 3 hours ago" for the rest.

**Should (quality, and the Phase 2 slot-ins):**

10. **Send a "new sign-in" email** when a login comes from a browser this account hasn't used before (a long-lived random device cookie, hashed on the session row). OWASP: notify on "a login from a new device or location" [4]. Not on every login, which trains people to ignore it. Content: device, approximate location, time, a "Review your devices" link, and "Wasn't you? Reset your password."
11. **Pre-check reset links on load.** Today `/reset?token=` only learns the link is dead after the person types a new password. Add a read-only token-status check (no consumption) and show the expired or used state first.
12. **Add a hidden username field to reset and change-password forms** (`autocomplete="username"`, value = the account email, visually hidden but not `display:none`), so password managers save the new password against the right account. *Inference from how password managers match forms; not re-checked in this run.*
13. **Lockout that a stranger can't abuse.** `loginAccount` allows 8 tries per 15 minutes keyed only by the typed identifier, so anyone who knows a username can keep its owner locked out. Key the strict limit by identifier plus IP, keep a looser per-identifier limit, and let a correct password from a device cookie already known to the account through. NIST caps consecutive failures at 100 per account; OWASP warns that a forgotten-password flow must never lock accounts [1][4].
14. **Decide the email-enumeration trade-off on sign-up on purpose.** Sign-up says "An account already uses this email" (OWASP recommends a neutral "we've emailed a link" instead) [4]. Because Realm signs people in before they verify, a neutral sign-up would need the account owner to confirm by email first, which conflicts with the owner's decision. Recommendation: keep the explicit message (Discord does the same), keep the 5-per-hour-per-IP sign-up limit, add a per-email limit, and record it as an accepted risk. Login and reset must stay neutral.
15. **Prepare the API for 2FA and passkeys now.** Make the login response a union (`{ status: "signed_in" }` or, later, `{ status: "second_step", ticket, methods }`) so a step can be added without changing callers. Add `authenticatedAt` and `authMethod` to sessions (for recent-auth and the future security log). Allow `passwordHash` to be null for OAuth-only accounts in Phase 3, with a "Set a password" flow. When passkeys land, mark the sign-in identifier field `autocomplete="username webauthn"` so passkeys appear in autofill without making sign-in identifier-first. *The `webauthn` token is from the WebAuthn conditional-mediation feature; not re-checked in this run.*
16. **Teen defaults hook.** Store an age band (13–15, 16–17, 18+) derived from the DOB so the Profiles and Safety work can apply teen defaults (DMs from friends only, not discoverable to adults) without reading the DOB everywhere. The ICO code accepts self-declaration only "for low risk processing or when used in conjunction with other techniques" [2], so the defaults matter more than the gate.
17. **Copy fixes:** the "password changed" email points to "Settings → Security", but the page is Settings › Devices. The DOB hint "It keeps Realm right for your age" is good; keep it. Say the code auto-checks ("It checks itself when all 6 digits are in") so the automatic submit isn't a surprise (WCAG 3.2.2) [3].

### 6.3 Screen specs

Shared rules for every auth screen: one `<h1>` in Funnel Display; everything else Atkinson; visible labels above fields (never placeholder-only); hints between label and field, linked with `aria-describedby`; errors under the field, in words plus an icon, linked with `aria-describedby` and `aria-invalid`; one action-colour pill; the way across ("New here? Create an account") as a text link below. Inputs 56px tall on phones (no iOS zoom: 16px+ text).

**A. Sign in** (`/login`)
- Title "Welcome back". No lead line needed (drop "get back to your crew").
- Fields: "Email or username" (`autocomplete="username"`, `autocapitalize="none"`, `spellcheck=false`); "Password" (`autocomplete="current-password"`, Show/Hide). "Forgot your password?" link right under the password.
- Button: "Sign in". Pending label "Signing in". No disabled-looking state before typing (Roblox and Twitch look broken that way, section 5).
- Errors: empty fields → "Enter your email or username." / "Enter your password." Wrong pair → banner (role alert): "That email or username and password don't match. Try again, or reset your password." Rate-limited → "Too many tries. Wait N minutes, or reset your password." Suspended (only after a correct password) → "This account is suspended. [What this means]" linking to help.
- Success: full load to `next`.
- Phase 2 slot: a "Sign in with a passkey" text link under the button; the identifier field gains `webauthn` autofill.

**B. Sign up, step 1 of 2: birthday** (`/signup`)
- Title "When's your birthday?" Lead: "We use it to keep Realm right for your age. It's never shown on your profile."
- Fields in a `fieldset` with legend "Date of birth": Month (select of month names; avoids the day/month order trap for an international audience), Day, Year (numeric text). Order by locale (Month Day Year for en-US, Day Month Year elsewhere). `autocomplete` `bday-month` / `bday-day` / `bday-year`. No default values, no year dropdown that starts at the cutoff, no auto-tab between fields [2].
- Button: "Next". Small "Step 1 of 2" said after the title, not stamped above it (DESIGN.md "Said After" rule).
- Errors (GOV.UK wording [1]): "Date of birth must include a day", "... a month", "... a year"; "Date of birth must be a real date"; "Date of birth must be in the past". Over 120 years: "Enter your real date of birth."
- Under the minimum → screen D. Nothing else has been typed or sent.

**C. Sign up, step 2 of 2: your account**
- Title "Make your account". Back link "Change birthday" (keeps what's typed).
- Fields: Display name ("What your friends see. You can change it any time.", `autocomplete="nickname"`); Username (auto-suggested from the display name as now, plus a debounced availability check on pause: "@noor_k is free" / "@noor_k is taken. Try @noor_k2"); Email ("To sign in and reset your password. Never shown to anyone.", `type=email`, `autocomplete="email"`); Password ("At least 10 characters. A few unrelated words make a strong one.", `autocomplete="new-password"`, Show/Hide).
- Legal line above the button: "By creating an account you agree to the Terms and the Privacy policy."
- Button: "Create account". Pending "Creating your account".
- Errors after submit: an error summary at the top for 2+ errors ("2 things to fix" with links to each field), focused; one error → focus the field. Email in use → "An account already uses this email. Sign in instead?" Breached password → see 6.2 item 7.
- Success: straight into Home with the verify banner (owner decision). No interstitial.

**D. Under-age stop** (same URL, replaces the form)
- Title "We can't make an account for you yet". Body: "Realm is for people 13 and older. If you entered your birthday by mistake, get in touch." (link to a help article that explains how a correction works).
- No back button, no "try again", no field. The hold lasts 24 hours on this browser (cookie, enforced by the API) [2].

**E. Verify email**
- In the app (banner, as now): "Verify your email. We sent a 6-digit code to noor@example.com." Code field (one input), "Verify", "Send a new code" (with cooldown), "Wrong email? Change it" (Phase 1 can link to Settings › Account if email change exists; otherwise to help). The banner flips to "Email verified" without a reload when the link is used on another device: listen for a `user.update` on the gateway, or re-check on `visibilitychange`.
- `/verify` signed in: Title "Check your email". Lead: "We sent a 6-digit code to **noor@example.com**. It works for 15 minutes." Field label "6-digit code", hint "It checks itself when all 6 digits are in." Below: "No email? Check spam, or send a new code (in 0:42)." Footer: "Do this later".
- Code errors: "That code doesn't match. Check the email and try again." / "That code expired. We can send a new one." [button] / after 5 tries: "That code can't be used any more. Send a new one."
- `/verify?token=` (the link): Title "Verify your email"; button "Verify my email" (the scanner-proof POST). Then: success "Your email is verified" → "Open Realm" (signed in) or "Sign in" (signed out). Already verified → same success screen, "Your email was already verified." Expired → "This link expired. Links work for 15 minutes." + "Send a new one" (signed in) or "Sign in to get a new one". Superseded → "There's a newer email. Use the link or code in the latest one." Old address → "This link is for an email address you've since changed."

**F. Forgot password** (`/forgot`)
- Title "Reset your password". Lead: "Enter the email on your account and we'll send you a link to set a new one."
- Field: Email. Button "Send reset link".
- Sent state (role status): Title "Check your email". "If an account uses **x@y.com**, we've sent it a link. It works once, for 60 minutes." Then "Nothing after a few minutes? Check spam, send it again (in 0:58), or try another email." "Back to sign in" ghost pill.
- Rate-limited: "We've sent a few links already. Wait N minutes, then try again."

**G. Set a new password** (`/reset?token=`)
- Checks the link on load (6.2 item 11). Title "Set a new password". Lead: "Saving it signs you out on every device, including this one."
- Hidden username field (6.2 item 12), "New password" with Show/Hide and the same hint as sign-up. Button "Save new password".
- Dead link: "This link has expired" / "This link was already used" + "Get a new link". Done: "Password changed. Sign in with your new password." + "Sign in".

**H. Settings › Security** (rename "Devices" to keep one place for sign-in matters; Phase 2's 2FA, passkeys and the activity log land here)
- Change password: Current password, New password (Show/Hide on both), "Change password". Success: "Password changed. We signed out your other devices." Wrong current: "That isn't your current password."
- Where you're signed in: rows with device icon, "Chrome on Windows", "Approximate location: Ontario, Canada", "Active now" (this device, tagged "This device", no sign-out button; the account menu has Sign out) or "Last active 3 hours ago", and "Signed in 2 Oct 2026". Row action: "Sign out" (accessible name "Sign out of Chrome on Windows"). Footer action: "Sign out of all other devices" (re-auth if not recent). Result: "Signed out of 3 other devices." Empty: "You're only signed in here."
- Sign out (everywhere in the app via the account menu): immediate, no confirm, lands on the front page with "You're signed out." (role status).

**I. Emails** (plain text plus a simple HTML version; one action; no tracking pixels)
- Verification: subject "Your Realm code is 482913" is common and convenient; *judgement:* fine for verification codes, not for sign-in codes. Body: the code on its own line, the "Verify my email" link, "Works for 15 minutes", "Didn't sign up? Ignore this; nothing happens."
- Reset, password changed: as now, fix the Settings path.
- New sign-in (new): "New sign-in to Realm: Chrome on Windows, near Ontario, Canada, 4 Oct 2026 21:14." "Review your devices" link. "Wasn't you? Reset your password now."

### 6.4 Carrying DESIGN.md's world into auth (without making it a marketing page)

Today the auth layout is the old world: `<Nebula />`, the R3F `HeroWorld` black hole with the explorer crew, the day/night `EditionToggle`, the caption "One universe for your whole crew", amber `text-overprint` links, the `display` (Bricolage) headline and `--r-*` tokens. DESIGN.md names all of this as anti-reference [context]. It also loads three.js on a form page, which is exactly the GPU cost the performance notes warn about.

Proposal (to render as a preview for the owner before building, per the process rule):
- **Ground:** the lit ink ground (`--home-*` light field: three soft fields in the Mint theme plus grain), *still* on auth pages: no scroll drift, no 3D, no canvas animation. A static render or CSS radial gradients is enough.
- **Layout, wide screens (≥64rem):** two columns. Left: the form, left-aligned in a ~26rem column, no card (the ground is the surface; Spotify-level calm). Right: one still phone frame (the DESIGN.md phone, black bezel, Phone drop shadow) showing a real app screen, the party lobby "who's here now", labelled as demo content if it is. *Inference:* this is the product showing itself, which DESIGN.md asks for, and it is what Instagram's split screen does well (section 5). **Phones and tablets:** form only, wordmark top-left, light field behind; no art band (it costs a screen of scrolling before the form).
- **Type:** Funnel Display 800, tight, for the one title per screen at the Title-to-Headline-Step range (about 2.4–3.2rem; smaller than the front page, because a form is not a statement). Atkinson Hyperlegible Next for labels, hints, errors, links and buttons.
- **Colour:** the theme action colour (Mint by default) on the one primary pill, the focus ring and text selection; nothing else coloured. Links in Ink with an underline, not in the action colour (One Action Rule). Night only; remove the edition toggle until the day edition exists. Keep "Pause motion" only if anything moves.
- **Inputs:** DESIGN.md has no input component yet. Suggest: Surface fill (#141419), 0.9rem radius (content holders are rounded rectangles; pills are for pressing and status), an inset hairline ring at 12% white, 2px action-colour ring on focus, 56px tall. Labels bold Atkinson 0.95rem in Ink; hints in Ink 2.
- **Errors need a token.** DESIGN.md has no danger colour. Add one that passes 4.5:1 on the ink ground *and* reads clearly apart from Ember's peach action colour (#ffaf8a); always pair it with an icon and words, never colour alone.
- **The mark** (ring with the action colour caught inside) plus lowercase wordmark top-left, linking home. No nav, no marketing footer beyond Terms, Privacy, Help.
- **One signature moment, optional:** after sign-up, a skippable "Pick your colour" step (Mint, Orchid, Aqua, Ember swatches) where the page's light and button follow the choice, the profile-canvas idea in miniature. *Judgement:* it's brand in an action, not decoration, and it seeds the theming feature. Owner's call; it adds a step.

### 6.5 Open decisions for the owner

1. Minimum password length: keep 10 with breach screening (consumer norm: Discord, TikTok, Snapchat and Roblox say 8), or follow NIST's 15 for password-only accounts [1]. Recommendation: 10 plus screening now; revisit when passkeys and 2FA ship.
2. Australia during the alpha: block sign-ups from Australian IPs, or allow 16+ only with a plan for age assurance. Needs legal advice.
3. The email-enumeration trade-off on sign-up (6.2 item 14).
4. Whether to add the "Pick your colour" step.

## Sources

All checked 2026-10-04. "Fetched" means the page itself was read; "search summary" means the claim comes from a web-search result summary and the page wasn't opened, so give it less weight.

Standards and guidance
- [NIST] NIST SP 800-63B-4, Digital Identity Guidelines: Authentication and Authenticator Management (rev. 4, 26 Aug 2025). https://pages.nist.gov/800-63-4/sp800-63b.html (fetched)
- [W3C-338] Understanding SC 3.3.8 Accessible Authentication (Minimum). https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html (fetched)
- [W3C-337] Understanding SC 3.3.7 Redundant Entry. https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html (fetched)
- [OWASP-Auth] OWASP Authentication Cheat Sheet. https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html (fetched)
- [OWASP-Forgot] OWASP Forgot Password Cheat Sheet. https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html (fetched)
- [ASVS-V6] OWASP ASVS 5.0, V6 Authentication. https://github.com/OWASP/ASVS/blob/master/5.0/en/0x15-V6-Authentication.md (fetched, raw)
- [ASVS-V7] OWASP ASVS 5.0, V7 Session Management. https://github.com/OWASP/ASVS/blob/master/5.0/en/0x16-V7-Session-Management.md (fetched, raw)
- [web.dev-OTP] SMS OTP form best practices (updated 9 Dec 2020). https://web.dev/articles/sms-otp-form (fetched)
- [GOV.UK-email] GOV.UK Design System, Confirm an email address. https://design-system.service.gov.uk/patterns/confirm-an-email-address/ (fetched)
- [GOV.UK-dates] GOV.UK Design System, Dates. https://design-system.service.gov.uk/patterns/dates/ (fetched)
- [GOV.UK-date-input] GOV.UK Design System, Date input. https://design-system.service.gov.uk/components/date-input/ (fetched)
- [GOV.UK-blog] "Simple things are complicated: making a show password option" (19 Apr 2021). https://technology.blog.gov.uk/2021/04/19/simple-things-are-complicated-making-a-show-password-option/ (search summary)
- [HIBP] Have I Been Pwned API v3, Pwned Passwords. https://haveibeenpwned.com/API/v3 (fetched)
- [OTP-single] "Using a single input for one-time-code". https://dev.to/madsstoumann/using-a-single-input-for-one-time-code-352l (search summary)
- [Akanda-2025] "Broken Access: On the Challenges of Screen Reader Assisted Two-Factor and Passwordless Authentication" (2025). https://nsaxena.engr.tamu.edu/wp-content/uploads/sites/238/2025/08/Broken-Access.pdf (search summary)
- [magic-link-scanners] better-auth discussion #6985, "Magic Link token consumed by email security scanners". https://github.com/better-auth/better-auth/discussions/6985 (search summary)

Law and regulators
- [FTC-FAQ] FTC, Complying with COPPA: Frequently Asked Questions (sections D.4, H.1, H.3). https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions (fetched)
- [NatLawReview] "Amendments to the FTC COPPA Rule Now in Effect". https://natlawreview.com/article/amendments-ftc-coppa-rule-now-effect (search summary)
- [ICO-std3] ICO Children's code, standard 3 Age appropriate application. https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/3-age-appropriate-application/ (fetched)
- [Ofcom] Ofcom, Age checks to protect children online. https://www.ofcom.org.uk/online-safety/protecting-children/age-checks-to-protect-children-online ; Highly effective age assurance FAQ. https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/enforcement/highly-effective-age-assurance--frequently-asked-questions-faq.pdf (search summary)
- [Freshfields / DSA-Observatory] Commission Article 28 DSA guidelines (14 Jul 2025). https://www.freshfields.com/en/our-thinking/blogs/technology-quotient/dsa-decoded-6-the-european-commission-finalises-guidelines-on-the-protection-of-102kv4s ; https://dsa-observatory.eu/2025/07/31/do-the-dsa-guidelines-on-protecting-minors-online-strike-the-right-balance/ (search summary)
- [eSafety] eSafety Commissioner, Social media age restrictions. https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions (fetch timed out; search summary only). March 2026 compliance update: https://www.esafety.gov.au/sites/default/files/2026-03/SocialMediaMinimumAgeComplianceUpdateMarch2026.pdf (listed in search, not opened)
- [Wikipedia-OSA] Online Safety Amendment (Social Media Minimum Age) Act 2024. https://en.wikipedia.org/wiki/Online_Safety_Amendment (fetched)
- [PinsentMasons] "Australian government looks to double down on enforcement of social media age restrictions" (updated 7 Jul 2026). https://www.pinsentmasons.com/out-law/news/australian-government-enforcement-social-media-age-restrictions (fetched)
- [TheyVoteForYou-2026-09-10] House division, consideration of Senate message, 10 Sep 2026. https://theyvoteforyou.org.au/divisions/representatives/2026-09-10/2 (search summary)
- [MLex] "Australian parliament passes bill amending under-16 social-media ban". https://www.mlex.com/mlex/data-privacy-security/articles/2524610 (search summary)
- Parliament of Australia bill page (returned 403 to the fetcher): https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results/Result?bId=r7512

Products
- [Discord-PR] Discord, "Discord Launches Teen-by-Default Settings Globally" (9 Feb 2026, with a delay note). https://discord.com/press-releases/discord-launches-teen-by-default-settings-globally (fetched)
- [Redact-2026] "Discord's Global Age Verification Rollout". https://redact.dev/blog/discord-teen-by-default-global-age-verification-2026 (search summary; the source for the reported 23 Sep 2026 launch)
- [Discord-support-posts] e.g. https://support.discord.com/hc/en-us/community/posts/21848782197143-MY-ACCOUNT-HAS-BEEN-DISABLED-FOR-THE-REASON-STATED-AT-IM-UNDER-THE-AGE-OF-13 (user reports, search summary)
- [TechCrunch-2025-04-21] https://www.techcrunch.com/2025/04/21/instagram-is-using-ai-to-find-teens-lying-about-their-age-and-restricting-their-accounts (search summary)
- [HelpNet-2026-05-05] https://www.helpnetsecurity.com/2026/05/05/meta-ai-age-detection-instagram-facebook/ (search summary)
- [TikTok-newsroom] "Our work to keep TikTok a place for people 13 and over". https://newsroom.tiktok.com/our-work-to-keep-tiktok-a-place-for-people-13-and-over-eu?lang=en-150 (search summary)
- [CommonSense] Parents' Ultimate Guide to TikTok. https://www.commonsensemedia.org/articles/parents-ultimate-guide-to-tiktok (search summary)
- [BiometricUpdate-2026-01] "Roblox rolls out facial age estimation for chat access globally". https://www.biometricupdate.com/202601/roblox-rolls-out-facial-age-estimation-for-chat-access-globally (search summary)
- [BeReal-terms] https://bereal.com/terms ; [InternetMatters] https://www.internetmatters.org/advice/apps-and-platforms/social-media/bereal/ (search summary)
- Captures: `docs/research/phase1-captures/auth/*.jpg` (taken in an earlier run of this task, from a Turkish IP; viewed 2026-10-04).

Realm code read (2026-10-04): `frontend/web/src/app/(auth)/{layout,login,signup,verify,forgot,reset}`, `frontend/web/src/features/auth/*`, `frontend/web/src/features/settings/{sessions-list,account-forms}.tsx`, `frontend/web/src/features/app/verify-banner.tsx`, `frontend/web/next.config.ts`, `backend/api/src/modules/auth/{routes,service,emails}.ts`, `backend/api/src/plugins/security.ts`, `backend/api/src/lib/sessions.ts`, `backend/server-core/src/{rate-limit,user-agent}.ts`, `shared/contracts/src/schemas/auth.ts`, `shared/contracts/src/limits.ts`.
