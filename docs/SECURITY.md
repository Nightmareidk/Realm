# Security

How Realm keeps people safe from attacks, how that's tested, and what to do if something goes
wrong anyway.

## Reporting a problem

Found a security hole? Report it privately through GitHub's private security reports for this
repository (Security, "Report a vulnerability"), not in a public issue. The website points
researchers there too: `/.well-known/security.txt` and the Help page, "Found a security problem?".

## What protects Realm

Every protection below has a test that plays the attack against the real API and shows it fail:
`backend/api/src/security.test.ts` (attacks), `backend/api/src/modules/media/storage.test.ts` (the
storage limit), plus the module tests for each area.

| Attack | What stops it |
|---|---|
| **SQL injection** (typing database commands into search or sign-in) | Every query is built with placeholders by the database library; input is never pasted into SQL. |
| **Cross-site scripting** (sneaking scripts into posts or names) | The API only speaks JSON with `nosniff`; the website and app show text as text (React escapes it). The website's Content-Security-Policy blocks scripts from anywhere else. Device names are stripped to plain characters. |
| **Cross-site request forgery** (another website acting as you) | Any change made with the session cookie must come from Realm's own web address; no address, or another one, is refused. Cookies are HttpOnly and SameSite=Lax. The phone app uses a token, not a cookie. |
| **Guessing passwords** | 8 wrong tries pause an account for 15 minutes (even the right password waits), and its owner is emailed. 20 tries per address in 15 minutes. Common passwords are refused at sign-up (and ones found in data breaches, with `REALM_PWNED_PASSWORDS` on). Wrong password and unknown account answer exactly the same, with the same timing. |
| **Credential stuffing** (leaked passwords from other sites, tried on many accounts) | All of the above, plus: past 100 wrong passwords in 10 minutes across Realm, the owner gets an email (once an hour). |
| **Stolen session** | People are emailed when their account signs in on a new device. Changing the password signs out every other device; "Where you're signed in" lists and ends sessions. Sessions are random 256-bit tokens, stored only as hashes. |
| **Reaching other people's things** (changing the ID in a link) | Every route checks who you are and whether you may see or change that thing: posts, private accounts, DMs, Space rooms, moderator tools, files. Blocks hide people both ways. |
| **Editing your own account into an admin** (mass assignment) | Requests are checked against exact shapes; extra fields like `emailVerified` or `status` are dropped. |
| **Prototype pollution, oversized or broken requests** | `__proto__` in JSON is refused; request bodies over 1 MB are refused; every field has length limits. |
| **Malicious uploads** | Files are checked by their real contents, not their name or claimed type; programs are refused; sizes must match what was announced. Files live in a private bucket and are handed out through short-lived links, only to people allowed to see them. |
| **Path traversal** (reaching files outside the uploads folder) | File links are signed; anything else is refused. |
| **Open redirects** (a Realm link that forwards you to a scam site) | "Go back where you were after signing in" only follows paths on Realm itself, read the way a browser reads them (hidden tabs and line breaks included). |
| **Clickjacking** (Realm hidden inside another site) | `X-Frame-Options` on the API, `frame-ancestors 'none'` on the website. |
| **Spam and floods** | Rate limits on every route and per address; repeated or link-heavy messages, comments and captions from brand-new accounts are slowed; reports hide content automatically. |
| **Surprise bills** (storage filling up) | Uploads pause at the storage limit (10 GB, Cloudflare's free amount), with emails to the owner at 9, 9.3 and 9.7 GB and when it's full. |
| **Snooping on the connection** | The database connection checks Neon's certificate (`sslmode=verify-full`). Release builds of the app only talk to Realm over https. The app's session lives in the phone's keychain, only while unlocked, never in backups. |

The API's own map (`/v1/openapi.json`) is switched off in production, so strangers can't use it
to plan an attack.

## Warnings that reach the owner

Set `REALM_ALERT_EMAIL` (and an email service, Resend) and Realm emails you about:

- storage at 9, 9.3 and 9.7 GB of 10, and when it's full (uploads pause then);
- a flood of wrong passwords across Realm (someone trying leaked passwords).

Without an email service they're written to the server's log as "owner alert".

## If Realm is attacked

Work through these in order. Steps 1 to 3 take minutes.

1. **Stop the damage.**
   - Someone got into one account: `pnpm emergency lock <username>` (from `backend/api`). That
     suspends it and signs it out everywhere. `pnpm emergency unlock <username>` lets it back in.
   - Keys or the database may have leaked, or you're not sure how far it went:
     `pnpm emergency signout-everyone`. Everyone signs in again with their password.
2. **Change every key** that may have been seen, in this order, putting each new one in `.env`
   and restarting Realm after:
   - Neon: reset the database password (Neon, project, Roles).
   - Cloudflare R2: delete the API token and make a new one (R2, Manage API tokens).
   - `REALM_SECRET`: a new random value of 32+ characters. This ends every password-reset link
     and invite code that's waiting.
   - Resend, Firebase and LiveKit keys, if they're set.
3. **If people's passwords may have leaked:** sign everyone out (step 1), then ask everyone to
   change their password. Passwords are stored hashed (Argon2id), never as plain text, so they
   can't simply be read.
4. **Find out what happened.** The server's log has every request with its address. The
   `security_events` table has every sign-in, failed sign-in, password change and reset per
   account.
5. **Put back anything that was damaged.** Neon can restore the database to an earlier moment
   (Free plan: the last 6 hours; paid plans: longer). Restore into a new branch first, check it,
   then switch Realm to it.
6. **Fix the hole**, add a test that plays the attack and shows it fail, and only then reopen.
7. **Tell people** whose data was affected, plainly: what happened, what it means for them, and
   what to do. In the EU and UK this is required within 72 hours for a personal-data breach.

## Known issues in add-ons

`pnpm audit --prod` (October 2026) finds four, all inside Expo's tools for building the phone
app. They run on the developer's computer, not on people's phones or on the website:

| Add-on | Where | Why it's left |
|---|---|---|
| `node-forge` | Expo's app-signing tool | No fixed version exists yet |
| `braces` | Metro, the app bundler's file watcher | No fixed version exists yet |
| `uuid` | Expo's iPhone project tool | The fix is a new major version the tool doesn't support |
| `decode-uri-component` | expo-router's link reading | The fix is a new major version; the issue is only a slow-down from deliberately broken links |

They go away with Expo's next update; check again after each one. The website's own add-ons
(Next.js, sharp, gRPC) are on fixed versions.

## Before real users join

- Make new keys for Neon and Cloudflare (the development ones were shared during setup).
- Set a strong `REALM_SECRET`, `REALM_ALERT_EMAIL`, and an email service.
- Add the real web address to the R2 bucket's CORS rule and to `REALM_WEB_ORIGIN`.
- Turn on GitHub's private vulnerability reporting for the repository.
- Run `pnpm audit --prod` and update anything it flags.
