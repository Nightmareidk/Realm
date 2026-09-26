# Realm — End-to-End Encryption Architecture

> Status: **design, v1 (2026-09-26)**. Implementation: Phase 2, before public launch.
> Principle: **we never claim more than the math delivers.** Every surface in the product labels its protection accurately.

---

## 1. Vocabulary we use in the product (and nowhere else)

| Label shown to users | Meaning | Where |
|---|---|---|
| **End-to-end encrypted** | Only the participants' devices hold the keys. Realm's servers store and relay ciphertext they cannot read. | DMs & group DMs (Phase 2+), their attachments, small calls (Phase 3+) |
| **Encrypted in transit and at rest** | TLS between you and Realm; encrypted disks/backups at Realm. **Realm's systems can read it** — needed for moderation, search, feeds, and new members reading history. | Everything else |

Until Phase 2 ships, DMs in dev/alpha builds show a visible *"Not end-to-end encrypted yet"* notice. Marketing copy says "end-to-end encrypted DMs" **only after** that ships.

---

## 2. What can realistically be E2EE

| Feature | E2EE? | Reasoning |
|---|---|---|
| 1:1 DMs | **Yes** (default, Phase 2) | Small, fixed participant set; the canonical case. |
| Group DMs | **Yes** (Phase 2), capped at 100 members initially | MLS scales well; cap is a UX/perf safety margin, raised later. |
| DM/group attachments (images, files, voice notes) | **Yes** | Client encrypts the file; server stores ciphertext. |
| Reactions, replies, edits, deletes, read receipts in E2EE chats | **Yes** | Sent as encrypted application messages. |
| Typing indicators in E2EE chats | **Content yes, signal visible** | Server necessarily sees "device X sent a typing signal to group Y". |
| 1:1 and small group voice/video calls | **Yes** (Phase 3) | WebRTC insertable streams through the SFU (LiveKit E2EE), keys derived from the MLS group. |
| Private community channels | **Possible later, opt-in, small only** | Trade-offs: no server search, no bots, new members don't see prior history, moderation relies on reports. Not in initial scope. |
| Public / large community channels | **No** | Open membership, moderation, server search, new members reading history, bots. E2EE here would be theater: anyone can join and read. |
| Posts, comments, profiles, stories, feeds | **No** | Public or audience-controlled content the server must rank, moderate, and serve. Protected by access control, not E2EE. |
| Short videos | **No** | Must be transcoded server-side. |
| Large voice rooms / stages | **No** | Transport-encrypted (DTLS-SRTP) to the SFU. |
| Notifications, search index, recommendations | **Server-side for non-E2EE content only**; E2EE content is excluded | Push payloads for E2EE chats contain no message content. |

---

## 3. Protocol choice: MLS (RFC 9420) via OpenMLS

- **MLS** (Messaging Layer Security, IETF standard 2023) gives forward secrecy and post-compromise security for **groups**, with efficient O(log n) membership changes. It treats every *device* as a group member, which is how multi-device works natively.
- **OpenMLS** is the leading Rust implementation. We compile it to **WASM** for the web and bind it via **UniFFI** for iOS/Android; Electron uses the WASM or a native N-API build. One implementation, audited once, for every client.
- **Ciphersuite**: `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519` (0x0001) at launch, with a planned move to a post-quantum hybrid KEM (X-Wing) once it's available in OpenMLS; MLS supports ciphersuite upgrades per group.
- **Why not Signal Protocol / Olm?** Both are excellent for 1:1, but group chats become "pairwise fan-out" (Signal's sender keys lack post-compromise security; Megolm has similar limits). MLS is the modern standard for exactly our shape: lots of groups, multi-device.
- **We do not write cryptographic primitives.** Our code orchestrates OpenMLS and WebCrypto; nothing else.

---

## 4. System roles

MLS defines an **Authentication Service (AS)** and a **Delivery Service (DS)**. Realm's server plays both — carefully limited.

```
Device A ──(ciphertext)──► Realm DS ──(ciphertext)──► Device B, C…
   │                         │
   └─ key packages ─► Realm AS (public keys + device credentials only)
```

**Server stores (and can see):**
- Device records: user ID, device ID, public identity/signature keys, created/last-seen.
- KeyPackages (public, one-time-use bundles devices publish so others can add them).
- Group routing: which devices are in which conversation; MLS epoch; commit ordering.
- Ciphertext blobs + sender device ID + timestamp + size.

**Server never stores or sees:** plaintext message content, attachment contents or file names, attachment keys, MLS private keys, group secrets.

**Metadata the server necessarily sees** (and we state this plainly in the privacy page): who talks to whom, group membership, when messages are sent, approximate sizes (we pad to size buckets), IP addresses at connection time (not retained beyond operational need).

---

## 5. Keys, devices, and identity

### 5.1 Device keys
Each client install is a **device** with an Ed25519 signature key (its MLS credential). Private keys never leave the device.

### 5.2 User identity & cross-signing
Each user has a **user identity key** that signs their device keys. Your first device creates it. Adding a new device requires either:
1. **Approval from an existing device** (scan a QR code / confirm a code), which signs the new device, **or**
2. **Recovery key** entry (see §5.4).

Contacts' clients verify that every device in a conversation is signed by that user's identity key and warn loudly when a user's identity key changes.

### 5.3 Verification
Users can verify each other by comparing a **safety number** or scanning a QR code; verified contacts show a badge, and identity changes for verified contacts block sending until acknowledged. Phase 4+: **key transparency** (an append-only, auditable log of identity keys, as WhatsApp deployed) so users don't have to verify manually to detect a malicious server swapping keys.

### 5.4 Backup and history on new devices
MLS gives a new device messages **from the moment it joins**. For history, users can opt into **Secure Backup**:
- A random 256-bit **backup key** encrypts message history/key material into blobs stored on Realm's servers.
- The backup key is wrapped by a **recovery key** (shown once as words) or a **passphrase** stretched with Argon2id (in WASM, memory-hard parameters).
- **If the user loses both the recovery key and all devices, history is gone.** We say so in the UI. We will not add a server-side escrow "just in case" — that would make the E2EE claim false.

### 5.5 Key storage on the web
- MLS state is kept in **IndexedDB**, encrypted with a **non-extractable** WebCrypto AES-GCM key (also persisted in IndexedDB as a `CryptoKey` object, so its raw bytes are never exposed to JS).
- This protects against someone copying the browser profile's IndexedDB files; it does **not** protect against malicious JavaScript running in the page (see §7).
- Clearing site data = the device is gone. Users are told this before enabling E2EE in a browser.

---

## 6. Flows

**Start a DM:** A's client fetches B's devices + one KeyPackage per device (and A's own other devices) → creates an MLS group → sends a `Welcome` to each device through the DS → first application message.

**Send:** client encrypts the MLS application message (payload = our message JSON: text, reply ref, attachment descriptors, etc.) → `POST /v1/e2ee/groups/:id/messages` with ciphertext → DS assigns order → gateway pushes `E2EE_MESSAGE` to each recipient device.

**Membership changes / new device:** an MLS `Commit` (add/remove) is submitted; the DS accepts exactly one commit per epoch (first wins; losers rebase and retry), which keeps every device's view consistent.

**Attachments:** client generates a random 256-bit key, encrypts the file with AES-256-GCM (chunked for large files), uploads ciphertext via the normal media API, and puts `{mediaId, key, sha256, mime, name, size}` *inside* the encrypted message.

**Link previews:** generated by the **sender's** client (or disabled per user setting); the server never fetches URLs from E2EE chats.

**Search:** on-device only, over locally decrypted messages.

**Push notifications:** payload is "New message from @name" at most (and a user setting to hide even the sender). Native apps can decrypt in a notification service extension to show content locally; the push provider never sees plaintext.

**Reporting abuse (message franking):** every E2EE message includes a commitment (HMAC of the plaintext under a per-message franking key that's inside the ciphertext); the server signs the commitment when relaying. When a user reports a message, their client reveals the plaintext + franking key; the server verifies the commitment and its own signature. This lets Realm act on **reported** content with proof it's genuine, without being able to read anything that isn't reported. (Same approach Meta uses in Messenger.)

**Deleting:** "delete for everyone" is a signed request honored by well-behaved clients and deletes ciphertext on the server — but a recipient who already decrypted it may have kept it. The UI says so.

---

## 7. The honest limits

1. **Web code delivery.** In a browser, Realm's server sends the JavaScript that handles your keys. A compromised or coerced server could, in principle, send malicious code to a targeted user. This is a structural limit of *all* web-based E2EE (WhatsApp Web, Messenger web, Proton web share it). Mitigations: strict CSP, Subresource Integrity, no third-party scripts, published hashes of every build, and in Phase 4 a browser extension (in the spirit of Meta's Code Verify) that checks served code against published hashes. **Users with high-risk threat models should use the desktop or mobile app**, which ship signed code that doesn't change per request — we'll say this in the security docs.
2. **Metadata** (§4) is visible to the server.
3. **Endpoints**: a compromised device, a malicious browser extension, or a screenshot defeats any E2EE.
4. **Moderation**: Realm cannot proactively scan E2EE content. Safety relies on reports (with franking), metadata-based spam signals, rate limits, and user controls (who can DM me, message requests).
5. **Multi-device history** requires Secure Backup, which is opt-in; without it, new devices see new messages only.

---

## 8. Data model (Phase 2)

Covered in [DATA-MODEL.md](DATA-MODEL.md#e2ee-phase-2): `devices`, `device_signatures`, `key_packages`, `e2ee_groups`, `e2ee_group_devices`, `e2ee_messages` (ciphertext), `e2ee_backups`. **Phase 1 already reserves the shape**: DM channels have an `encryption` column (`none` | `mls`), and messages have nullable `ciphertext`, so E2EE channels slot in without reshaping the messaging tables.

## 9. Migration from dev/alpha DMs
Because E2EE ships before public launch, there is no public plaintext DM history to migrate. Alpha DM channels (`encryption = 'none'`) are frozen read-only when Phase 2 ships, and new conversations with the same people are created as `mls` channels.

## 10. Review
Before launch: an external cryptography/security audit of the E2EE integration (not just OpenMLS itself), and a public security whitepaper describing exactly this document's guarantees and limits.
