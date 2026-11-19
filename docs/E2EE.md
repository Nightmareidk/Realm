# Realm: End-to-End Encryption Architecture

> Status: **design v2, 2026-11-13.** Replaces v1 (2026-09-26). Nothing here is built yet.
> Principle: **never claim more than the math delivers.** Every surface labels its protection exactly.
> Decided by the owner (2026-11-13): MLS is the protocol. OpenMLS (or another mature, audited MLS
> library) is the production engine. A TypeScript MLS library may be used to prototype. No custom
> cryptography. The engine sits behind one interface so it can be swapped.

Contents: 1 Labels · 2 Scope · 3 Threat model · 4 Trust model · 5 Protocol and engine · 6 Identity,
devices and verification · 7 DMs · 8 Groups · 9 Multi-device and history · 10 Key storage ·
11 Recovery · 12 Message storage and metadata · 13 Attachments · 14 Push · 15 Calls · 16 Spaces ·
17 Moderation · 18 Database · 19 Web risks · 20 The CryptoEngine interface · 21 Engine migration ·
22 Phased plan · 23 Major risks · 24 Final recommendation

---

## 1. What Realm is allowed to say

| Label | What it means | Where |
|---|---|---|
| **End-to-end encrypted** | Only the chat members' own devices hold the keys. Realm, Cloudflare, LiveKit and Google/Apple cannot read it, even if they wanted to or were forced to. | E2EE DMs and private group chats, their files and voice notes, E2EE calls (each only once that piece ships) |
| **Encrypted in transit** | TLS between your device and Realm. Realm's servers can read it. | Everything |
| **Encrypted at rest** | Neon, R2 and backups are encrypted on disk by the provider. Realm's servers can read it. | Everything stored |
| **Public / server-readable** | Realm stores, ranks, searches and moderates it. | Posts, comments, profiles, Stories, Clips, public Spaces, non-E2EE Space rooms |

Rules:
- A chat shows the lock and "End-to-end encrypted" only if `channels.encryption = 'mls'` **and** the
  client actually decrypted it with MLS. Never a label set from server data alone.
- Until a piece ships, its old honest chip stays ("Not end-to-end encrypted yet").
- Marketing says "end-to-end encrypted messages" only after the audit in §24.D.

---

## 2. What gets E2EE and what doesn't

| Feature | E2EE | Why |
|---|---|---|
| 1:1 DMs | **Yes, by default** | The core case. |
| Private group chats (up to 25 people today, 100 later) | **Yes, by default** | MLS is built for this. |
| Files, photos, videos, voice notes in those chats | **Yes** | Encrypted on the device before upload (§13). |
| Reactions, replies, edits, deletes, Seen, typing | **Yes** (content) | Sent as encrypted events inside the chat. The server still sees that *some* event happened. |
| 1:1 and small group calls, screen share | **Yes, as a mode** (later phase) | LiveKit's frame encryption with keys from the MLS group (§15). |
| Private Space rooms | **Optional, off by default, small Spaces only** (late phase) | Costs search, bots, mod tools and old history for new members (§16). |
| Public Spaces and public rooms | **No** | Anyone can join and read, so E2EE would be theatre. They need search and moderation. |
| Posts, comments, Stories, Clips, Notes, profiles | **No** | The server must rank, moderate and serve them. Protected by who-can-see rules, not E2EE. |
| Large voice rooms and stages | **No** | Transport encryption to LiveKit only. |
| Notifications, search, recommendations | Only for non-E2EE content | E2EE content never reaches them. |

---

## 3. Threat model

Assets: message text, files, call media, contact lists inside chats, and the private keys themselves.

| Threat | What Realm protects | What it cannot fully protect |
|---|---|---|
| **Stolen phone, locked** | Keys sit in the OS keystore (§10). Without the device unlock the attacker gets ciphertext. Remote "Remove this device" from another device revokes it from every group (§9.4). | A phone stolen *unlocked*, or whose lock is weak, can read whatever that device can read until it is removed. |
| **Compromised Realm server (live attacker)** | Cannot read past or future E2EE messages. Cannot silently add a device: new devices must be signed by the account's identity key, and contacts are warned about unsigned devices or a changed identity (§6). | Can see metadata (§12.2). Can drop or delay messages. Can block people. **On the web**, it can serve malicious JavaScript (§19), which is the biggest gap. Can try a key swap, which is caught only if users verify or watch the warnings. Key transparency (§6.5) narrows this later. |
| **Database leak (Neon dump)** | Leaks ciphertext, public keys and metadata only. No private keys or group secrets are ever stored. | Metadata in the dump: who talks to whom and when. |
| **Malicious group member** | Can only read what they were sent while a member. After removal they can't read new messages (new epoch). They can't impersonate others, because every message is signed by the sender's device. | Can screenshot or forward anything they saw. Can report you with real evidence (by design, §17). View-once is a request, not a guarantee. |
| **Revoked device** | Removed from every MLS group in one commit each, so new epochs and new messages are out of reach. Its session is killed and its uploads stop. | Keeps whatever it already decrypted and stored. |
| **Man in the middle** | TLS against network attackers. Against a lying server: account-signed device lists, safety numbers or QR verification, and loud warnings when keys change. | Users who never verify and click through warnings. |
| **Stolen account password or email** | The attacker can sign in, but a new device has no E2EE keys. It is not signed by the account key, so contacts see "Noor signed in on a device that isn't confirmed", and the device sees no history. The owner is emailed about new sign-ins (exists today). | The attacker can message *new* chats from that device unless contacts heed the warning. They can also delete the account. |
| **Malicious browser extension** | Nothing reliable. An extension with page access can read the screen and the page memory. | We say so: high-risk users should use the phone app. |
| **XSS on tomyrealm.com** | Strict CSP, Trusted Types, and crypto in an isolated Worker on a separate origin (§19) make key *theft* much harder. | XSS can still *use* the open session to read what the page shows. |
| **Metadata analysis** | Sender hidden inside MLS, sizes padded to buckets, no sender stored on the row, short retention of delivery logs (§12.3). | Realm still sees who is in which chat, when, how much, and from where (IP). Hiding the social graph would need mixnets, which is out of scope. |
| **Push providers (Google, Apple)** | Pushes carry no text and no names, only an opaque "wake up" with a random chat token (§14). | They see that *a* push went to *a* device at *a* time. |
| **Compromised R2 bucket** | Files are ciphertext with random names and no real content type. Keys live only inside E2EE messages. | Rough file size (padded) and upload time. Deletion or corruption, though clients detect tampering via hash. |
| **Compromised LiveKit (E2EE call mode)** | Sees only encrypted frames. | Who joined, when, for how long, bandwidth and IPs. |

---

## 4. Trust model: who can see what

| System | Can see | Can never see |
|---|---|---|
| **Realm API and DB** | Accounts, device public keys and signatures, KeyPackages (public), who is in each E2EE chat, ciphertext blobs, epochs, timestamps, padded sizes, IPs at request time, reports with evidence the reporter chose to reveal | Message text, file contents or names, reactions, replies, private keys, group secrets, the recovery key, backup contents |
| **Cloudflare R2** | Encrypted blobs, padded sizes, upload and download times, the uploader's IP if it proxies | File contents, real type, names, keys |
| **LiveKit** | Room membership, timing, bandwidth, IPs; in E2EE mode, only encrypted frames | Audio, video and screen content in E2EE mode |
| **Firebase / APNs** | Device push token, time, payload size, an opaque chat token | Sender, text, chat name |
| **Resend (email)** | Sign-in and new-device emails | Anything from E2EE chats |
| **The owner as admin** | Same as the API | Same as the API. **There is no master key, escrow or hidden admin access.** |

Design rule: **assume the server will be compromised one day.** Private chats must stay unreadable
even then, both past and future. Today's dev-only server-readable DMs are the reason E2EE ships before
public launch.

---

## 5. Protocol and engine

- **MLS, RFC 9420.** It gives forward secrecy and post-compromise security for groups, cheap
  membership changes (O(log n)), and treats each *device* as a member, which is how multi-device works.
- **Ciphersuite at launch: `0x0001` MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519.** Supported by
  OpenMLS and ts-mls. Later: a post-quantum hybrid (X-Wing) suite once the production engine supports
  it. MLS can move a group to a new suite with a re-init.
- **Production engine: OpenMLS** (Rust). Delivered as WebAssembly in a Worker for the website, and a
  native module for the app (Nitro/JSI or UniFFI). The app already uses a development build, so a
  native module is allowed. It just needs a new build when it changes.
- **Prototype engine: ts-mls** (TypeScript, MIT). Latest stable 1.6.x, with 2.0 still a release
  candidate. **Not audited**, so prototype only, never "launch". Must prove it runs on Hermes in the
  app (its HPKE layer may need WebCrypto; plan for a native crypto polyfill if so).
- **Not MLS:** file encryption uses AES-256-GCM from a reviewed library (WebCrypto on the web;
  `@noble/ciphers`, which has been audited, or a native module on the phone). Recovery uses Argon2id and
  AES-GCM. **Realm writes no cryptographic primitives.** Our code only orchestrates.

---

## 6. Identity, devices and verification

### 6.1 Three kinds of key

| Key | Who holds it | Purpose |
|---|---|---|
| **Account identity key** (Ed25519) | Each *approved* device, inside its keystore, plus the encrypted backup (§11) | Signs device certificates. Its fingerprint is what safety numbers are built from. Changes only on full recovery loss. |
| **Device signature key** (Ed25519, the MLS credential key) | That device only, never exported | Signs everything the device sends in MLS. |
| **MLS key material** (HPKE init keys, leaf keys, epoch secrets) | That device only, inside the engine's state | Rotates constantly. This is what gives forward secrecy and post-compromise security. |

A device's **certificate** = `{userId, deviceId, devicePublicKey, platform, createdAt}` signed by the
account identity key. The MLS credential carries `userId:deviceId`. The certificate travels with the
leaf as an MLS extension and is also published on the server. **Every client checks the certificate
chain before accepting a leaf.** A leaf without a valid chain is shown as "unconfirmed device" and is
not added to new groups without the user's say-so.

Why an account key over per-device trust: contacts verify *you* once, and then your new phone,
approved by your old one, doesn't trigger warnings. This is the same idea as cross-signing in
Matrix/Element.

### 6.2 Registering the first device
On first use of encrypted chat, the device creates the account identity key and its own device key,
signs its certificate, and uploads the public parts plus about 100 KeyPackages. It then asks the user
to save a recovery key (§11), with a strong nudge but not forced at first launch, re-asked after the
first real chat.

### 6.3 Approving a new device ("new-device approval")
1. The new device makes its device key and shows a **QR code**: `deviceId`, public key fingerprint,
   and a one-time 128-bit secret. Or it shows a 6-word code for when the camera isn't available.
2. The user scans it with an approved device. Both sides derive a shared key from the secret and the
   two device keys, and confirm a short code on screen.
3. The approved device signs the new device's certificate and sends the account identity key over that
   channel (end-to-end, relayed by the server as ciphertext).
4. The approved device asks: **"Also copy your message history to this device?"** (§9.3), defaulting to
   *No* on a web browser and *Yes* on phone or desktop, with a clear sentence about what that means.
5. The new device gets added to the user's groups (§9.2).

No approved device left? Then use the recovery key (§11). Neither? Start fresh with a **new**
account identity key, and contacts see a "security code changed" notice.

### 6.4 Verifying other people
- **Safety number:** 60 digits, from both people's account identity key fingerprints (sorted, then
  hashed in the style of Signal's NumericFingerprint). Shown as 12 groups of 5, the same on both
  phones.
- **QR:** scan each other's code in person, and the result is "Verified ✓".
- **Warnings:**
  - Someone's account identity key changes: an inline notice in every chat with them. If they were
    *verified*, sending is blocked until you tap "I understand" or re-verify.
  - Someone adds an unconfirmed device: an inline notice, and that device isn't added to groups until
    its owner confirms it from an approved device.
- Most people never verify. That's fine. The warnings still catch a server that swaps keys, *if*
  people read them. Keep them rare and clear so they aren't ignored.

### 6.5 Later: key transparency
An append-only, auditable log of every account identity key (as WhatsApp and Apple use) lets apps
detect a server serving different keys to different people without manual verification. This is
phase 6 and needs care. Planned, not promised.

---

## 7. One-to-one DMs

A DM is **an MLS group with two users** (and all their approved devices). Same code as groups, no
special case.

1. **Start:** A's device fetches B's device list and certificates, plus one KeyPackage per B device and
   per A's *other* devices, and checks every certificate. It creates the MLS group, commits Add
   proposals for all those devices, sends one Welcome per device through the server, then the first
   message.
2. **Session establishment:** happens through KeyPackages (one-time HPKE keys, consumed on use), so B
   doesn't need to be online. The server hands out each KeyPackage once and tells the device to upload
   more when it's low.
3. **Sending:** the client wraps our message JSON
   `{type: "text"|"reaction"|"edit"|"delete"|"seen"|…, …, franking: {key}}` in an MLS **PrivateMessage**,
   with the sender hidden inside, and posts it. The server orders it and delivers it to each device.
4. **Receiving:** the engine decrypts, checks the sender's signature and certificate, and the app
   stores the plaintext *locally* in its encrypted local database.
5. **Key rotation:**
   - Every device sends an MLS self-**Update** commit (new leaf key) at least every 7 days and every
     500 messages it sends, whichever comes first.
   - Any device that was offline for over 7 days updates on return.
   - Removing a device always starts a new epoch.
6. **Forward secrecy:** each message uses a one-time key from the secret tree, which is deleted after
   use. Old epochs' secrets are deleted after a short out-of-order window (5 epochs or 7 days). A
   device stolen today can't read last month's messages *from the keys*. It can still read its local
   message store, which is why that store is encrypted under the OS keystore (§10).
7. **Post-compromise security:** once a stolen key's owner commits an Update (step 5), the attacker
   loses access to future messages, even if they had copied every key.
8. **The server stores:** the group's routing row, member *device* list, current epoch, ordered
   handshake messages (commits and welcomes) and application ciphertext, all until delivered (§12).
9. **The server must never see:** plaintext, MLS private keys, epoch secrets, the account identity
   private key, file keys, or recovery material.

---

## 8. Group chats

One MLS group per chat. Leaves are devices.

| Event | What happens cryptographically |
|---|---|
| **Add a person** | An admin's device fetches the person's device KeyPackages, checks certificates, and commits Adds for all their devices. The **epoch advances** and new secrets are derived. Each new device gets a Welcome with the new epoch's secrets only, so **they can't read anything sent before**. Old members process the commit. |
| **Remove a person** | Commit Removes for all their devices, with a fresh path from the committer. The new epoch's secrets are encrypted only to remaining leaves, so **the removed person can't read anything after**. |
| **Someone leaves** | They send a self-Remove proposal. The next member to commit includes it (or any admin device commits it straight away). |
| **Key update** | Self-Update commits as in §7.5. Every commit with a path refreshes the committer's leaf and everything above it. |
| **New device for a member** | Added by that member's own approved device (§9.2). Others see "Noor added a confirmed device" only if they turn on device notices. Unconfirmed devices are flagged. |
| **Revoked device** | Removed from every group it was in (§9.4). |

**Admins.** Realm's "owner/admin" list for the chat is kept *inside* the MLS group context as a
signed extension, so all members agree on it. Members accept Add and Remove commits from admin
devices only. Anyone may self-Update or self-Remove. Changing the admin list is itself a commit by an
admin. The server also checks admin rights before accepting a commit (defence in depth), but clients
are the real gate.

**Ordering and races.** The server accepts exactly **one commit per epoch**. The first to arrive
wins, and losers get `409 EPOCH_MOVED`, fetch the winner, and retry. This keeps every device on the
same history.

**Large groups.** MLS costs O(log n) per change. Caps: start at 100 *people* (about 400 device
leaves) for E2EE groups. Group DMs today cap at 25. Commit and Welcome sizes are monitored before
raising the cap.

---

## 9. Multi-device

### 9.1 Devices
- Every install (app, each browser profile, desktop) is a separate device with its own keys.
- **Device list:** Settings › Devices shows each device with its platform, name, last seen, and
  whether it is confirmed. Today's sessions list becomes this list. `sessions.deviceId` already exists
  for the link.
- **New-device warning to yourself:** every approved device gets "A new device wants to join: Chrome
  on Windows, Istanbul". The existing email stays.

### 9.2 Keeping a user's devices in every chat
When a device is approved, one of the user's approved devices adds it to all the user's E2EE groups
(one commit per group, in the background, rate-limited). If no approved device is online, the new
device sends **external join requests** that the user's other device or a group admin completes later.
Until then, that chat shows "Waiting for your other device…".

### 9.3 History on a new device
MLS gives a new device **only messages from when it joins**. Copying history is a separate, explicit
choice:
- **Copy from my other device** (at approval time): the approving device sends an encrypted archive of
  its decrypted messages (and file keys) over the approval channel. It is *not* sent through MLS
  groups.
- **Restore from Secure Backup** (§11): needs the recovery key.
- **Neither:** the new device starts empty. The UI says *"Older messages stay on your other devices."*

Never silent. The approval screen says, plainly: *"This device will be able to read your past chats.
Only say yes if it's yours."*

### 9.4 Revoking a device
From any approved device, or from Settings on the website after a password and two-step check:
1. The device's certificate is revoked. The account key signs a revocation, and the server publishes
   it.
2. Its session is killed, its KeyPackages deleted, and its push token removed.
3. Each of the user's other devices removes it from every group (one commit each), giving a new epoch.
4. Contacts' clients refuse messages from a revoked device.

If the *last* approved device is lost, the user recovers (§11) and revokes the lost one from the
recovered device.

### 9.5 Key sync between your devices
There is **no syncing of MLS state** (that would break the model). What *is* shared between your
approved devices, encrypted to each, is:
- the account identity key (at approval);
- the safety-number "verified" list;
- the backup settings.

Each device runs its own MLS state.

---

## 10. Key storage per platform

Always the same shape: a random 256-bit **storage key** lives in the platform's keystore, and
everything bigger (MLS state, account key, local message database) is encrypted with it on disk.
**Private keys are never in Realm's database, never in logs, and never in crash reports.**

| Platform | Where the storage key lives | Notes |
|---|---|---|
| **Android** | Android Keystore (hardware-backed where available) via `expo-secure-store` | Local message database: SQLite (`expo-sqlite`) with each record AES-GCM encrypted under a key held by the Keystore. Excluded from cloud backup. |
| **iOS** | Keychain, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (no iCloud sync) | Same SQLite approach. The notification service extension reads a *separate* narrow keychain item (§14). |
| **Web** | IndexedDB holding a **non-extractable** WebCrypto AES-GCM `CryptoKey` | Protects against copying the profile folder, **not** against code running on the page (§19). Clearing site data deletes the device. Users are told this before enabling a browser device. Crypto runs in a dedicated Worker on a separate origin. |
| **Windows** | DPAPI / Credential Manager via Electron `safeStorage` | Desktop app (later). |
| **macOS** | Keychain via Electron `safeStorage` | |
| **Linux** | Secret Service (libsecret / KWallet) via `safeStorage`; if none, the app refuses to keep keys rather than store plaintext | Tell the user why. |

Signing out of a device **deletes its keys** (with a warning if it's the only approved device and there
is no backup).

---

## 11. Account recovery

### 11.1 Options compared

| Option | Safety | Ease | Verdict |
|---|---|---|---|
| **Recovery key** (random 256 bits, shown once as a 24-word list or 48-character code) | Very high: no password to guess | People lose it | ✅ **Primary** |
| **Encrypted key backup on Realm's server** (wrapped by the recovery key) | High: the server holds only ciphertext | Invisible after setup | ✅ **The thing the recovery key unlocks** |
| **Trusted-device recovery** (approve from your other phone) | High | Easiest | ✅ **First choice when you still have a device** (§6.3) |
| **Recovery passphrase** (Argon2id-stretched) | Only as good as the passphrase. Offline guessing is possible if the server leaks | Memorable | ⚠️ Optional, instead of words, with a strength check (zxcvbn ≥ 4) and heavy Argon2id (64 MiB, 3 passes) |
| Server-held key / escrow / "reset by email" | **Breaks E2EE** | Easy | ❌ **Never.** |

### 11.2 What "Secure Backup" holds
- A random **backup key** encrypts:
  - the account identity key;
  - the verified-contacts list;
  - optionally, **message history**, as rolling encrypted archives of decrypted messages and file keys
    in R2, appended in chunks.
- The backup key is wrapped by the recovery key (and/or the passphrase).
- The server stores only the wrapped key and encrypted chunks (table `e2ee_backups`).

### 11.3 Scenarios

| Situation | What happens |
|---|---|
| **Forgot password** | Email reset, as today. It changes *login only*. E2EE keys are untouched, devices keep working, and nothing is lost. Other sessions are signed out as today, but their device keys stay. The next sign-in on that device re-links it if its keys are still there. |
| **Lost phone, other device still OK** | Revoke the lost phone from the other device (§9.4). Nothing is lost. |
| **Lost all devices, have recovery key** | Sign in, then enter the recovery key. That restores the account identity key and, if backed up, history. The device is confirmed. Revoke the lost devices. Contacts see no warning. |
| **Lost all devices, no recovery key** | Sign in, and encrypted history is **gone**, as the UI said. Make a new account identity key. Contacts see "Noor's security code changed". The old devices are revoked. |
| **New device, normal case** | Approve from an existing device (§6.3), or use the recovery key. |
| **Changed email** | No effect on keys. |
| **Account compromised** (password and/or email) | The attacker's device is *unconfirmed*: no history, warnings to contacts. The owner regains access (two-step sign-in and email), revokes the device, and rotates the account identity key if any approved device was touched. Contacts are told. |

The recovery key is shown once and saved by the user (password manager, paper). Realm can't show it
again, can't reset it, and says so.

---

## 12. Message storage and metadata

### 12.1 What the server stores per E2EE message
`group (channel) id`, `epoch`, `server order id`, `kind` (`commit` | `welcome` | `application`),
`ciphertext` (padded), `franking commitment` + `server signature` (§17), `created_at`, and the
`recipient devices still to fetch` (delivery queue).

**No** `author_id` column for E2EE application messages: MLS hides the sender inside. The server knows
who *submitted* at request time (needed for rate limits and franking) but doesn't keep it on the row.
**No** plaintext `reply_to_id`, `mentions`, `embed`, `view_limit` or reaction rows. All of those move
*inside* the ciphertext.

### 12.2 Metadata Realm still sees
- who is in which chat (device lists), when each message was sent, and its padded size;
- which device fetched what, and when;
- IP addresses at connection time;
- that a call happened, who joined, and how long it lasted;
- that a file of roughly some size was uploaded.

### 12.3 Minimising it
- **Padding:** application ciphertext padded to 256-byte buckets, and files to power-of-two-ish buckets
  (§13).
- **Sealed sender in practice:** sender inside MLS. The row keeps no author.
- **Retention:**
  - delivered ciphertext is deleted once every member device has fetched it, plus 30 days for
    offline devices (whichever comes first after a 90-day cap);
  - delivery logs and request IPs are not kept past 14 days;
  - the Fastify request log stops logging E2EE routes' bodies, sizes and IP (log the route and status
    only).
- **No link previews made by the server.** The sender's device makes them, or they're off.
- **Typing and Seen** are encrypted application messages, rate-limited. The fact that one was sent
  stays visible.

---

## 13. Attachments

1. **On the device:**
   - strip EXIF and location;
   - make a small thumbnail;
   - pick a random 256-bit **file key**;
   - encrypt the file with AES-256-GCM in 64 KiB chunks (each chunk: nonce = counter, AAD = chunk
     index + last-chunk flag, so chunks can't be reordered, cut or swapped);
   - encrypt the thumbnail separately with its own key.
2. **Pad** the encrypted size up to the next bucket: below 1 MB, round up to a multiple of 64 KB;
   above, round up by 1/8 steps.
3. **Upload** through the existing presigned-URL flow, with these changes:
   - `media.isEncrypted = true`;
   - `mimeType = 'application/octet-stream'`;
   - the storage key is random;
   - `filename`, `width`, `height`, `blurhash` and `duration` are left **empty**;
   - **no server processing:** no magic-byte checks, no variants, no transcoding.
4. **Send** an MLS message holding
   `{mediaId, fileKey, thumbMediaId, thumbKey, sha256 of plaintext, real mime, name, size, width, height, duration, blurhash}`.
5. **The recipient** downloads through a short-lived signed URL, checks the hash, decrypts locally, and
   caches the plaintext in the encrypted local store.

| Topic | Approach |
|---|---|
| **Thumbnails and previews** | Made by the sender, encrypted, sent as their own blob. A blurhash inside the message gives an instant placeholder. Videos: the sender picks a poster frame. No server transcoding, so the sender compresses before upload (needs the next app build for real video compression). |
| **MIME leakage** | R2 always sees `application/octet-stream`. The real type is inside the message. |
| **Size leakage** | Padded buckets only. |
| **CDN caching** | E2EE blobs are served **only** by short-lived signed URLs with `Cache-Control: private, no-store`, never through a public CDN path. Caching ciphertext would be safe for privacy, but it stops deletion working. |
| **Voice notes** | Same as files (Opus in the app, encrypted before upload). |
| **Deletion** | "Delete for everyone" sends an encrypted delete event (honoured by well-behaved clients), and the server deletes the blob when no undelivered message references it. Recipients may already have a copy, and the UI says so. Blobs are also deleted when a chat is deleted, or after 90 days undelivered. |
| **View-once** | Becomes a client-side promise: the file key is wiped after one view, and the blob is deleted on view. **Not a guarantee** against a modified client or a second camera. Label it honestly ("Can't be saved in Realm" instead of "Can't be saved"). |
| **Safety scanning** | Not possible on E2EE files (no hash matching). That's why reports (§17) and limits matter more here. Public uploads keep their scanning. |

---

## 14. Push notifications

- **Payload:** data-only, high priority: `{t: "m", c: <opaque per-device chat token>}`. No sender
  name, no chat name, no text. The chat token is a random value the device registered for that chat,
  not the channel id.
- **On the phone:**
  - Android runs a background handler.
  - iOS uses a notification service extension (needs the development build).
  - Either one wakes, fetches the new ciphertext, decrypts locally, and shows "Noor: see you at 8",
    or just "Noor sent a message" if the user chose to hide previews.
- **If decrypting in the background isn't possible** (web push, low battery, an iOS limit): show
  "New message" with no name.

  The owner's example "New message from Noor" would put Noor's name through Google's and Apple's
  servers, so the name is added *on the device*, never in the push.
- **What still leaks:** Google/Apple see that a push went to this device at this time, how big it was,
  and how often.
- The per-chat token stops them from linking pushes to the same conversation across devices.
- Push stays off today (Firebase isn't connected). This design is used when it's turned on.

---

## 15. Voice, video and screen sharing

- **Transport encryption (normal WebRTC, DTLS-SRTP):** encrypted on the wire *to LiveKit*. LiveKit
  decrypts the transport, forwards packets, and **could** record or inspect them. This is what Realm's
  calls do today.
- **Application-level E2EE (insertable streams / encoded transforms):** each sender encrypts every
  audio, video and screen frame *before* WebRTC sees it, and receivers decrypt after. LiveKit forwards
  frames it can't read. LiveKit supports this ("E2EE" with a shared or per-participant key provider).
  Support must be checked per SDK, especially React Native.
- **Keys:** derived from the chat's MLS group: `frameKey = MLS-Exporter("realm/call", callId ‖ epoch, 32)`.
  - Every member device gets the same key from the group, so **the key never goes through LiveKit or
    Realm's API**.
  - Someone joins or leaves the chat: a new epoch, a new key, and LiveKit's key provider switches,
    with a short overlap so frames aren't dropped.
  - Someone joins the *call* but not the chat: impossible, because you must be in the MLS group.
- **Group and screen share:** the same key covers every track in the call. Screen share is just
  another track.
- **The SFU still sees:** who is in the call, when, how long, bandwidth, simulcast layers, IPs, and
  speaking activity (audio levels are visible unless disabled).
- **Shown as:** "End-to-end encrypted call" only when every participant's client confirms E2EE mode.
  Otherwise the call shows "Encrypted in transit".
- Large Space voice rooms stay transport-encrypted (§2).

---

## 16. Spaces

| | Public Spaces | Private Spaces |
|---|---|---|
| Rooms | Normal, server-readable | Normal by default |
| E2EE | Never | **Optional "Encrypted room" per room, later phase, only if the Space has ≤ 100 members** |
| Search, bots, AutoMod, server mod tools | Yes | Yes for normal rooms. **No** for encrypted rooms. |
| New members reading old messages | Yes | Normal rooms: yes. Encrypted rooms: **only from when they joined** (unless a member forwards history, not built). |
| Reports | Server sees the content | Encrypted rooms: franking reports only (§17). |

**Recommendation:** don't build encrypted Space rooms until DMs and group chats are solid and
audited. When built, they're opt-in per room, set by the Space owner, with a clear explainer: *"No
search, no bots, new members won't see older messages, moderators only see what's reported."* A room
can be made encrypted only when it's created (or by starting a new room). Never flip an existing
readable room, because its old history stays readable on the server.

---

## 17. Moderation with E2EE

- **No secret access. Ever.** No scanning on the device that reports to Realm, no ghost devices, no
  escrow.
- **Message franking (reported messages with proof):**
  1. The sender picks a random franking key `fk` per message and puts it *inside* the encrypted
     message.
  2. The sender sends `commitment = HMAC-SHA256(fk, plaintext ‖ channelId ‖ senderUserId)` *outside*
     the ciphertext.
  3. The server signs `{commitment, channelId, submitterUserId, timestamp}` with its own key when
     relaying, and stores the signature with the message.
  4. A recipient reporting a message reveals `plaintext + fk`. The server recomputes the commitment
     and checks its signature. That proves *this* person really sent *this* text, without the server
     being able to read anything else. This is the same approach as Facebook Messenger.
  5. The report's `evidence` jsonb gets the verified plaintext, and the reporter may include the
     previous few messages for context, each verified the same way.
- **Still available:** block and report (exists), message requests, who-can-DM-me settings (exists),
  rate limits on new chats and messages per account, new-account limits, and spam signals from
  metadata (many new chats with strangers, high fan-out, many blocks against one sender). The
  existing "hidden after enough reports" flag becomes per-*sender* in E2EE chats: after N verified
  reports, the sender's new-chat ability is limited.
- **Message requests:** the first message from a stranger is E2EE too. The request card shows "Noor
  wants to message you" and decrypts only on the device. Accepting just means the client keeps it.
- **Public content** keeps server-side automated moderation as today.

---

## 18. Database changes

New tables (names final, columns indicative). **None of them holds a private key.**

```
devices                 id, user_id, platform, name, signature_public_key, certificate (signed by
                        the account identity key), status (pending|approved|revoked), created_at,
                        last_seen_at, revoked_at
account_identity_keys   user_id, public_key, version, created_at, superseded_at   (history kept for
                        "security code changed" notices)
device_revocations      device_id, revocation (signed), created_at
key_packages            id, device_id, key_package (bytea), created_at, claimed_at
                        (one-time; claim = UPDATE … WHERE claimed_at IS NULL RETURNING)
e2ee_groups             channel_id (1:1 with channels where encryption='mls'), generation, epoch,
                        engine_version, admin_extension_hash, updated_at
e2ee_group_devices      channel_id, device_id, added_epoch, removed_epoch
e2ee_messages           id (snowflake = server order), channel_id, generation, epoch,
                        kind (commit|welcome|application|proposal), ciphertext (padded bytea),
                        franking_commitment, server_signature, created_at
                        — NO author column, NO plaintext
e2ee_deliveries         message_id, device_id, fetched_at   (delivery queue; rows deleted on fetch)
e2ee_backups            user_id, wrapped_backup_key, kdf_params, history_chunk_keys (R2 keys of
                        encrypted archive chunks), updated_at
push_chat_tokens        device_id, channel_id, token (random), created_at
```

Changes to existing tables:
- `sessions.deviceId` (exists) now points at `devices.id`.
- `channels.encryption` (exists): `'mls'` for new DMs and group chats once E2EE ships.
- `messages`: E2EE chats stop writing here. `messages.ciphertext` (reserved in Phase 1) is
  **dropped**. `e2ee_messages` replaces it, because it needs epoch, generation, kind and no author.
- `media.isEncrypted` (exists): when true, the server never processes it, and the plaintext fields
  stay null.
- `reports.evidence`: adds `{franking: {plaintext, fk, commitment, serverSignature, verified: true}}`.
- `push_tokens` becomes per device (`device_id`).

Old dev DMs (`encryption = 'none'`) are frozen read-only with a banner when E2EE ships. New chats with
the same people are created as `mls` (as v1 planned). There's no public plaintext history to migrate,
because Realm hasn't launched.

---

## 19. Web-specific risks

- **The core limit:** in a browser, *Realm's server sends the code that holds your keys.* A hacked or
  forced deployment can ship JavaScript that copies keys or plaintext for one targeted user. Every web
  E2EE app (WhatsApp Web, Messenger web, Proton) shares this.
- **XSS:** any script injection on the page can read decrypted messages on screen and ask the crypto
  layer to decrypt more.
- **Malicious dependency:** one compromised npm package in the web build has the same power.
- **Mitigations (all required before the web client is called E2EE):**
  - **Crypto in an isolated origin:** keys and the engine live in a Worker on
    `crypto.tomyrealm.com`, loaded in a sandboxed iframe. The main page talks to it through
    `postMessage` with a narrow API (encrypt/decrypt *for an open chat*). XSS on the main site can't
    read IndexedDB on the other origin, so it can't *steal keys*. It can still misuse the open chat,
    which is accepted and stated.
  - **Strict CSP with nonces**, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors`, and **no
    third-party scripts** on any page that shows E2EE chats.
  - **Trusted Types** enforced (`require-trusted-types-for 'script'`). No `dangerouslySetInnerHTML`
    on message content (it's already rendered as text).
  - **SRI** on all script chunks. Published build hashes per release (a later browser extension can
    check them, like Meta's Code Verify).
  - **Dependencies:**
    - lockfile and the existing one-day release delay;
    - `pnpm audit` in CI;
    - no new runtime dependencies in the crypto origin without review;
    - pinned exact versions;
    - npm provenance where offered.
  - **Labelling:** the web client shows the lock but Settings › Devices explains: *"For the strongest
    protection, use the Realm app."*
- **Native apps are a stronger boundary:** code is signed and ships through the stores, and the same
  build goes to everyone, so it can't be targeted per request. Keys sit in hardware-backed keystores.
  Expo OTA updates weaken this, so **OTA updates must never touch the crypto module**. Crypto changes
  ship only in signed store builds, and `expo-updates` code signing is turned on.

---

## 20. The CryptoEngine interface

New workspace package **`shared/e2ee`** (`@realm/e2ee`). The rest of Realm (chat screens, upload code,
the API client) talks **only** to this. Engines are adapters: `engines/ts-mls` now, `engines/openmls`
later.

```ts
/** Opaque engine-owned state, persisted encrypted by the platform KeyStore. */
type Bytes = Uint8Array;
type DeviceId = string; type GroupId = string;

interface KeyStore {                      // per platform (§10); never sends keys anywhere
  get(name: string): Promise<Bytes | null>;
  put(name: string, value: Bytes): Promise<void>;
  delete(name: string): Promise<void>;
}

interface CryptoEngine {
  readonly engine: "ts-mls" | "openmls"; readonly version: string; readonly ciphersuite: number;

  // Devices and identity
  createDevice(): Promise<{ deviceId: DeviceId; certificateRequest: Bytes }>;
  createAccountIdentity(): Promise<{ publicKey: Bytes }>;            // first device only
  signDeviceCertificate(request: Bytes): Promise<Bytes>;             // approve a new device
  verifyDevice(cert: Bytes, accountKey: Bytes): Promise<boolean>;
  revokeDevice(deviceId: DeviceId): Promise<Bytes>;                  // signed revocation
  generateKeyPackages(count: number): Promise<Bytes[]>;
  safetyNumber(myAccountKey: Bytes, theirAccountKey: Bytes): Promise<string>;

  // Groups (a DM is a 2-person group)
  createGroup(members: DeviceKeyPackage[], admins: string[]): Promise<GroupResult>;
  addMembers(group: GroupId, members: DeviceKeyPackage[]): Promise<GroupResult>;
  removeMembers(group: GroupId, devices: DeviceId[]): Promise<GroupResult>;
  rotateKeys(group: GroupId): Promise<GroupResult>;                  // self-Update commit
  joinFromWelcome(welcome: Bytes): Promise<GroupId>;
  processIncoming(group: GroupId, message: Bytes): Promise<Incoming>; // commit | application | proposal

  // Messages
  encryptMessage(group: GroupId, payload: Bytes): Promise<{ ciphertext: Bytes; franking: Franking }>;
  exportSecret(group: GroupId, label: string, context: Bytes, length: number): Promise<Bytes>; // calls

  // State
  exportState(): Promise<Bytes>;   // for the KeyStore, never for the server
}

/** Not MLS: separate, swappable, reviewed AES-GCM. */
interface AttachmentCipher {
  encrypt(file: ReadableStream<Bytes>): Promise<{ blob: ReadableStream<Bytes>; key: Bytes; sha256: Bytes; paddedSize: number }>;
  decrypt(blob: ReadableStream<Bytes>, key: Bytes, sha256: Bytes): Promise<ReadableStream<Bytes>>;
}

interface RecoveryVault {         // Argon2id + AES-GCM, reviewed libs only
  createRecoveryKey(): Promise<{ words: string[]; wrapped: Bytes }>;
  unwrap(words: string[] | string, wrapped: Bytes): Promise<Bytes>;
}
```

The owner's suggested methods map like this:

| Suggested method | Interface |
|---|---|
| `createConversation` | `createGroup` with two users |
| `decryptMessage` | `processIncoming`, because MLS mixes commits and messages on one stream |
| `encryptAttachment` / `decryptAttachment` | `AttachmentCipher` |
| `verifyDevice`, `revokeDevice`, `rotateKeys` | As named |

A **conformance test suite** runs against every engine: same vectors, the RFC 9420 test vectors,
cross-engine groups (ts-mls ↔ OpenMLS), state restore, and the races in §8. That suite is what makes
the swap safe.

---

## 21. Moving from ts-mls to OpenMLS later

- **The wire format is standard.** Both speak RFC 9420 with suite 0x0001, so a ts-mls device and an
  OpenMLS device *should* be able to share a group. The conformance suite (§20) must prove this before
  relying on it.
- **Private state is not portable.** We never convert one library's saved state into the other's,
  because formats differ and a conversion bug could leak or corrupt keys.
- **Plan: device by device.**
  1. A device that updates to OpenMLS becomes a **new device**: a new device key and certificate,
     signed by the account key, which is carried over safely because it lives in Realm's own storage,
     not the engine's.
  2. The user's other device (or the device itself, via the old engine still loaded) **adds the new
     device** to each group and **removes the old leaf**. That's two ordinary MLS commits, so the epoch
     advances and nothing is silently shared.
  3. The local message history stays (it's Realm's own encrypted database, not engine state).
  4. Contacts see nothing, because the device is cross-signed.
- **If mixed groups don't interoperate:** each group starts a new **generation**
  (`e2ee_groups.generation + 1`). A fresh group is created with the same people, a system line says
  "Encryption upgraded", and the old generation is closed. Old messages remain readable on devices
  that already have them.
- `e2ee_groups.engine_version` and an MLS `capabilities` extension tell clients what each member runs,
  so the rollout can be staged and rolled back.

---

## 22. Phased plan (solo developer)

| Phase | What | Engine | Ships to |
|---|---|---|---|
| **0. Groundwork** (no crypto) | The `@realm/e2ee` package with interfaces and a **fake engine for tests**. The DB tables in §18. The device registry API (register, list, approve, revoke, KeyPackages upload and claim). Settings › Devices. KeyStore adapters per platform. Isolated web crypto origin scaffold. Labels. Log scrubbing on E2EE routes. | none | test server |
| **1. Spike** | Prove ts-mls runs in a browser Worker **and** on Hermes in the dev build. Measure key and commit sizes and the time to create a 25-person group on the owner's phone. | ts-mls | owner's PC and phone only |
| **2. Encrypted 1:1 DMs, text only** | One device per user. Create, send, receive, Update rotation, reactions, edit, delete and Seen as encrypted events. Franking. Safety numbers. Old DMs frozen. | ts-mls | test server, behind a flag |
| **3. Multi-device and groups** | Approval by QR, revoke, add to groups, group chats with admins, epoch races, the "security code changed" and "unconfirmed device" notices. | ts-mls | test server |
| **4. Files, recovery and push** | `AttachmentCipher`, padded uploads, view-once rework, the recovery key and Secure Backup, history copy at approval, data-only pushes with on-device decryption (when Firebase is on). | ts-mls | test server |
| **5. Production engine and audit** | The OpenMLS adapter (WASM Worker for web, a native module for the app), the conformance suite across engines, migration (§21), and an **external audit** (§24.D). Only then: public launch with "end-to-end encrypted" in copy. | OpenMLS | everyone |
| **6. Later** | E2EE calls (LiveKit frame encryption with MLS exporter keys), the desktop app, encrypted private Space rooms, key transparency, a post-quantum suite. | OpenMLS | everyone |

Rough sizing: phases 0 to 2 take a few focused weeks, 3 to 4 a few more, and 5 is the long one.
Phases 0 to 4 can be built and used on the test server **without** making any public claim.

---

## 23. Major security risks (the honest list)

1. **ts-mls is unaudited.** Bugs there could break everything quietly. It stays prototype-only, with
   no public claim until phase 5.
2. **Web client trust** (§19). Even with isolation, the server delivers the code. This is a permanent
   limit, only reduced, never removed.
3. **Our own glue code.** Most real-world E2EE failures are in the orchestration, not the maths:
   certificate checks skipped, state not saved after a commit, a race that forks a group, a key logged.
   This needs the audit, the conformance tests, and fuzzing of incoming messages.
4. **Key-change warnings that nobody reads.** If they're noisy, people click through and a server key
   swap goes unnoticed. Keep them rare, and add key transparency later.
5. **Lost recovery keys.** Users will lose history. That's the honest cost of no escrow. Make the
   recovery key easy to save, and remind people.
6. **Expo OTA updates** could change crypto code outside the store review. Block that (§19).
7. **Metadata.** E2EE doesn't hide the social graph. The privacy page must say so.
8. **Hermes and crypto performance on low-end phones.** Large groups could be slow. Measure in phase 1.
9. **Moderation gaps** in E2EE chats (no scanning). Rely on reports with franking, limits and blocks,
   and say so in the safety docs.
10. **Local message store at rest.** It's only as safe as the device lock. Encourage a phone lock and
    the app lock (planned).

---

## 24. Final recommendation

**A. Production architecture.**
- **Protocol:** MLS (RFC 9420), suite 0x0001, through OpenMLS behind `@realm/e2ee`.
- **Devices and identity:** per-device leaves, an account identity key cross-signing devices, and QR
  approval.
- **Recovery:** a recovery key unlocking Secure Backup, with no escrow.
- **Encryption on the device:** AES-256-GCM attachments padded and encrypted on the device, and
  data-only push.
- **Calls:** LiveKit frame E2EE keyed by the MLS exporter.
- **Web:** web crypto in an isolated origin with strict CSP and Trusted Types.
- **Scope:** private DMs and group chats E2EE by default. Public content and public Spaces stay
  server-readable.

**B. What we can build now.** Phases 0 to 2:
- the interface;
- the device registry and DB;
- Settings › Devices;
- the ts-mls spike on web and phone;
- encrypted 1:1 text DMs on the test server.

**C. What should wait.**
- multi-device and groups (phase 3);
- files, recovery and push (phase 4; push also waits for Firebase);
- calls, the desktop app, encrypted Space rooms, key transparency and post-quantum (phase 6).

**D. Needs an external security audit before public launch.**
- the `@realm/e2ee` glue and both engine adapters;
- device approval and certificate checks;
- the recovery vault and its Argon2id settings;
- attachment chunking and padding;
- franking;
- the isolated web crypto origin and its CSP;
- push decryption on the phone;
- the server's delivery and epoch logic.

OpenMLS itself has its own reviews. Our *integration* is what needs checking.

**E. Safe to prototype, not to trust for production yet.**
- ts-mls;
- the web client's key storage before the isolated origin exists;
- anything in phases 0 to 4 on the test server.

None of it gets the "end-to-end encrypted" label for real users until phase 5 and the audit.

## Appendix: phase 1 spike results (2026-11-14)

ts-mls 1.6.4, ciphersuite 0x0001, Node 24, one laptop. Code: `shared/e2ee/src/spike/`.

| Step | Result |
| --- | --- |
| Make 25 KeyPackages | 32 ms total |
| One KeyPackage | 334 bytes (446 base64url, under the 4096 server limit) |
| Commit adding 24 people | 72 ms; Welcome 3.0 KB |
| Saved group state, 25 people | 11.4 KB |
| One person joins from the Welcome | 29 ms |
| Encrypt one message / decrypt one | 2.3 ms / 0.8 ms; a short text is 330 bytes on the wire |
| Commit removing one person | 46 ms; 2.5 KB; each other member follows it in 23 ms |
| Call key (MLS exporter) | same for all members; changes after the removal |
| Removed person reads a new message | refused (correct) |

**Phones (Hermes).** With `crypto.subtle` hidden and only `getRandomValues` left, ts-mls fails at the
first KeyPackage, even with `nobleCryptoProvider`: its HPKE layer (`@hpke/core`: X25519, HKDF,
AES-GCM) always uses WebCrypto. Only signing falls back to pure JS. Plan: add
`react-native-quick-crypto` (native WebCrypto, needs a new dev build), keep Ed25519 signing on
`@noble/curves`, and rerun `no-subtle.spike.ts`'s steps on the phone. No hand-written HPKE.

Done so far: `realmCryptoProvider` (`shared/e2ee/src/provider.ts`) is the noble provider with
signing pinned to `@noble/curves` Ed25519. `runSelfCheck()` runs keys, group, add, join, message,
call key and removal. The app installs react-native-quick-crypto first thing
(`src/native-crypto.native.ts`); developer builds have Settings › Encryption check. The
WebCrypto calls the self-check makes (recorded on Node), which quick-crypto must support:
AES-GCM import raw, encrypt and decrypt; HKDF import raw and deriveBits; HMAC import raw and
sign; X25519 generateKey, import raw, pkcs8 and jwk, export raw and jwk, and deriveBits.

**Browsers.** Current Chrome, Firefox and Safari have X25519 and Ed25519 in WebCrypto, so the
default provider runs in the Worker. Still to prove in a real browser Worker.

## Appendix: phase 2 progress (2026-11-14)

Built and tested, behind `REALM_E2EE_DMS` (off by default). **No chat screen uses it yet**, so
nothing is labelled end-to-end encrypted anywhere.

**Engine** (`shared/e2ee/src/engines/ts-mls.ts`): `TsMlsEngine` implements `CryptoEngine` on ts-mls.
- The MLS credential is `realm1:user:device:keyVersion:issuedMs:signature`: the device certificate
  itself. Every leaf is checked against the account key the app trusts (`accountKeyFor`), on
  create, add, join and every commit. A KeyPackage claimed for the wrong person is refused.
- The sender of a message comes from the MLS sender data, and MLS checks that device's signature.
- A change (create, add, remove, rotate) is pending until the server accepts it
  (`commitAccepted` / `commitRejected`).
- Messages are framed as `version | franking key | length | payload | zero padding` to a multiple
  of 256 bytes (`franking.ts`). The commitment is HMAC-SHA256 with the chat and sender bound in.
- `safetyNumber()`: 60 digits from both account keys.
- State lives only in the `KeyStore`. Group state is copied on load: wiping used secrets must not
  touch the saved bytes (found by the race test).

**Server** (`backend/api/src/modules/e2ee/chat-service.ts`, migration 0021):
- Tables `e2ee_groups` (epoch), `e2ee_group_devices`, `e2ee_messages` (no author, no plaintext),
  `e2ee_deliveries` (per-device queue).
- Routes under `/v1/e2ee`: `POST /channels`, `GET /channels/:id`, `POST /channels/:id/group`,
  `POST /channels/:id/messages`, `POST /channels/:id/commits`, `POST /channels/:id/reports`,
  `GET /inbox`, `POST /inbox/ack`.
- A message or commit made in an older epoch gets 409 `EPOCH_STALE`; the row lock makes the check
  and the insert one step. Only the first commit in an epoch wins.
- Ciphertext is deleted once every device has acknowledged it, and when a device is revoked.
- The live nudge `E2EE_PENDING` carries only the channel id.
- Franking: the server signs `channel, submitter, message id, commitment` with a key derived from
  `REALM_SECRET`. A report must match that signature and the commitment, then lands in `reports`
  with `evidence.verified`.
- Readable text posted to an `mls` channel is refused (`ENCRYPTED_CHAT`).

**Cipher strength (the owner's decision, 2026-11-14).** Asked for AES, asymmetric keys, salting
and "military grade", and shown the options, the owner chose to **keep ciphersuite 0x0001**
(AES-128-GCM, X25519, Ed25519) for messages: the suite every MLS implementation must support and
the one OpenMLS lists as supported. What each ask maps to:

| Ask | Where |
|---|---|
| AES | Messages: AES-128-GCM (MLS). Everything saved on a device: AES-256-GCM (`sealed-store.ts`). Files, later: AES-256-GCM (§13). |
| Asymmetric keys | X25519 for key agreement (HPKE), Ed25519 for device and account signatures. Private halves never leave the device. |
| Salting | Account passwords: Argon2id with a random salt each (`server-core/crypto.ts`). The recovery key, later: Argon2id with a salt (§11). Messages need no salt: every message has its own one-time key and nonce. |
| "Military grade" | Not a standard. The nearest real one is CNSA 1.0 (AES-256, P-384, SHA-384) = MLS suite 0x0007. Measured in ts-mls: works, about 3x slower, KeyPackage 559 B against 321 B (`spike/suites.spike.ts`). Not chosen: it costs the rework and OpenMLS doesn't list it as supported. |

Never write "military grade" or "AES-256 messages" in the app or its marketing: messages are
AES-128-GCM.

**Second half of phase 2, built 2026-11-14:**
- `sealed-store.ts`: `SealedKeyStore` seals every record with AES-256-GCM before it reaches the
  disk (version byte, random 96-bit nonce, ciphertext and tag), bound to the record's name so
  records can't be swapped. Two sealers with one format: a raw key (phones) and a
  non-extractable WebCrypto key (browsers).
- `client/client.ts`: `E2eeClient`. Device set-up (a first device makes the account key and
  confirms itself; a later one reports `needs-approval`), KeyPackage top-up, `openDm`,
  `sendText` / `edit` / `remove` / `react` / `markSeen` / `resend`, `sync`, `report`,
  `safetyNumber`, key rotation after 500 sent messages or 7 days, retry after `EPOCH_STALE`.
- Trust: the first account key seen for a person is pinned. A different key later is not trusted
  until `acceptKeyChange`; the test delivers a welcome from a forged device and it is refused.
- `client/chat-state.ts`: the saved chat and `applyEvent`. Only the author can edit or delete, a
  repeat is ignored, Seen only moves forward, and messages are ordered by server receipt time.
- `contracts/schemas/e2ee-events.ts`: the event shapes inside a message (`ChatEvent`).
- Phone: `frontend/app/src/e2ee/device-store.native.ts` keeps the 256-bit storage key in
  expo-secure-store (this device only) and sealed records as files, written then moved into
  place. Settings > Encryption check (developer builds) now also checks this storage.

**Screens, built and checked 2026-11-15** (Expo web against the test server, with
`backend/api/scripts/e2ee-buddy.ts` as the other person):
- `frontend/app/src/e2ee/index.ts`: one `E2eeClient` per signed-in account, started in
  `session.tsx`. It syncs on the `E2EE_PENDING` nudge and when the live connection returns. When
  the server's switch is off the state is `off` and no key is made.
- `app/chat/[id].tsx` has a secure mode (route param `secure=1`): messages come from the sealed
  store, mapped to the screen's `Message` shape by `asMessage` (`id` = the device's `seq`,
  `nonce` = the sender's message id). Send, retry, edit, unsend, react and Seen go through the
  client. No photos, no "typing", no "Delete for you" in this mode.
- The lock and "End-to-end encrypted" show only when this device is set up and opened the chat
  itself. It opens `app/chat/safety.tsx` (the 60 digits; accepting a changed code). A changed
  code turns the lock into a warning.
- A message request is read without telling the sender; "Seen" is shared once it is accepted
  (`markSeen(share)`, `sharedSeen`). Found on screen: opening a request used to tell them.
- `open-dm.ts`: New message, Friends and Profile open the encrypted DM first, and the ordinary
  DM when the other person has no device. Story replies and shared posts still use the ordinary
  DM, so two people can have both kinds of chat. Freezing the old one is still to do.
- `unread.ts` lays the device's last message and unread count over the server's list for
  encrypted chats. The Inbox row shows a lock.
- `app/report.tsx` sends an encrypted message's proof through the client.
- Browsers: `device-store.ts` keeps a non-extractable AES-256 key and sealed records in
  IndexedDB. It is in the page's own origin: the isolated origin and Worker of §19 are not built.

**Still to do in phase 2:** run it on a real phone (the new dev build), switch
`REALM_E2EE_DMS` on for the real server when the owner says so, freeze old DMs, wipe keys on
sign-out with a warning, the isolated web origin, quiet logs for browser preflights (the
server still logs `OPTIONS /v1/e2ee/...` lines with the address, seen 2026-11-15; §12.3 says
it shouldn't), and the same screens on the website
(`frontend/web`), which has none of this yet.
