import {
  type ClaimedKeyPackages,
  type ConfirmWithPassword,
  E2EE_LIMITS,
  type OwnDevice,
  type PublicDevices,
} from "@realm/contracts";
import { and, desc, eq, inArray, isNull, ne, schema, sql } from "@realm/db";
import { deviceCertificateBytes, deviceResumeBytes, deviceRevocationBytes } from "@realm/e2ee";
import { Limits, verifyEd25519 } from "@realm/server-core";
import type { Deps } from "../../deps";
import { AppError, badRequest, conflict, notFound, rateLimited } from "../../lib/errors";
import { type ClientContext, type ResolvedSession, revokeSession } from "../../lib/sessions";
import type { AccountService } from "../account/service";
import { blockedEitherWay } from "../spaces/access";
import { deviceApprovedEmail, securityCodeChangedEmail } from "./emails";

const {
  accountIdentityKeys,
  devices,
  deviceRevocations,
  e2eeDeliveries,
  e2eeMessages,
  keyPackages,
  securityEvents,
  sessions,
  users,
} = schema;

type DeviceRow = typeof devices.$inferSelect;
type Reason = (typeof deviceRevocations.$inferInsert)["reason"];

const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, "base64url"));
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64url");

const notApproved = () =>
  new AppError(
    403,
    "DEVICE_NOT_APPROVED",
    "Confirm this device from one of your other devices first.",
  );
const badSignature = () =>
  badRequest("SIGNATURE_INVALID", "That signature doesn't match your account's key.");

/**
 * The server's part of end-to-end encryption (docs/E2EE.md §6, §9, §18): it keeps each person's
 * PUBLIC account key, their devices and the certificates linking them, and hands out one-time
 * KeyPackages. It checks every signature itself rather than trusting the client, and it never sees
 * a private key. The clients check everything again; this is the second lock, not the first.
 */
export class E2eeService {
  constructor(
    private readonly deps: Deps,
    private readonly account: AccountService,
  ) {}

  private get db() {
    return this.deps.db;
  }

  private async enforce(rule: (typeof Limits)[keyof typeof Limits], key: string) {
    const r = await this.deps.limiter.hit(rule, key);
    if (!r.allowed) throw rateLimited(r.resetSeconds);
  }

  private async log(
    userId: bigint,
    type: (typeof securityEvents.$inferInsert)["type"],
    ip: string,
  ) {
    await this.db.insert(securityEvents).values({ id: this.deps.ids.next(), userId, type, ip });
  }

  private mail(m: Parameters<Deps["mailer"]["send"]>[0]) {
    this.deps.mailer.send(m).catch((err) => this.deps.logger.error({ err }, "mail send failed"));
  }

  private checkClock(at: number) {
    if (Math.abs(at - Date.now()) > E2EE_LIMITS.clockSkewMs) {
      throw badRequest(
        "BAD_REQUEST",
        "This device's clock is off. Set the right time and try again.",
      );
    }
  }

  /** The account key in use (the newest one not replaced), or null before the first device. */
  async currentKey(userId: bigint) {
    const [key] = await this.db
      .select()
      .from(accountIdentityKeys)
      .where(and(eq(accountIdentityKeys.userId, userId), isNull(accountIdentityKeys.supersededAt)))
      .orderBy(desc(accountIdentityKeys.version))
      .limit(1);
    return key ?? null;
  }

  /** The device this session registered, whatever its status. */
  private async sessionDevice(auth: ResolvedSession): Promise<DeviceRow | null> {
    const [row] = await this.db
      .select({ device: devices })
      .from(sessions)
      .innerJoin(devices, eq(devices.id, sessions.deviceId))
      .where(and(eq(sessions.id, auth.sessionId), eq(devices.userId, auth.userId)))
      .limit(1);
    return row?.device ?? null;
  }

  /** The approved device this session is, or a DEVICE_NOT_APPROVED error. */
  async approvedCaller(auth: ResolvedSession): Promise<DeviceRow> {
    const d = await this.sessionDevice(auth);
    if (d?.status !== "approved") throw notApproved();
    return d;
  }

  private async ownDevice(userId: bigint, deviceId: bigint): Promise<DeviceRow> {
    const [d] = await this.db
      .select()
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
      .limit(1);
    if (!d) throw notFound("Device");
    return d;
  }

  private toOwn(d: DeviceRow, currentId: bigint | null): OwnDevice {
    return {
      id: d.id.toString(),
      status: d.status,
      platform: d.platform,
      name: d.name,
      signatureKey: b64(d.signatureKey),
      current: d.id === currentId,
      createdAt: d.createdAt.toISOString(),
      approvedAt: d.approvedAt?.toISOString() ?? null,
      revokedAt: d.revokedAt?.toISOString() ?? null,
      lastSeenAt: d.lastSeenAt.toISOString(),
    };
  }

  /** This session becomes a device, waiting to be confirmed. One device per session. */
  async register(auth: ResolvedSession, signatureKey: string): Promise<OwnDevice> {
    await this.enforce(Limits.e2eeDevice, auth.userId.toString());
    const existing = await this.sessionDevice(auth);
    if (existing && existing.status !== "revoked") {
      throw conflict("CONFLICT", "This device is already set up for encrypted chats.");
    }
    const [{ n } = { n: 0 }] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(devices)
      .where(and(eq(devices.userId, auth.userId), ne(devices.status, "revoked")));
    if (n >= E2EE_LIMITS.devices) {
      throw conflict(
        "LIMIT_REACHED",
        `You can have ${E2EE_LIMITS.devices} devices. Remove one you don't use first.`,
      );
    }
    const [session] = await this.db
      .select({ platform: sessions.platform, name: sessions.deviceName })
      .from(sessions)
      .where(eq(sessions.id, auth.sessionId))
      .limit(1);
    if (!session) throw notFound("Session");

    const device = await this.db
      .transaction(async (tx) => {
        const [d] = await tx
          .insert(devices)
          .values({
            id: this.deps.ids.next(),
            userId: auth.userId,
            platform: session.platform,
            name: session.name,
            signatureKey: bytes(signatureKey),
          })
          .returning();
        if (!d) throw new Error("device insert returned nothing");
        await tx.update(sessions).set({ deviceId: d.id }).where(eq(sessions.id, auth.sessionId));
        return d;
      })
      .catch((err: unknown) => {
        // The database's own words sit on the error or on its cause, depending on the driver.
        const said = `${(err as Error)?.message ?? err} ${(err as { cause?: Error })?.cause?.message ?? ""}`;
        if (said.includes("devices_signature_key_key")) {
          throw conflict("CONFLICT", "That key is already in use. Make a new one.");
        }
        throw err;
      });
    return this.toOwn(device, device.id);
  }

  /**
   * Signing in again on a device that already has its key: the new session becomes that device.
   * The device proves it with a signature from its own key, because its public key is known to
   * everyone and must not be enough to claim it.
   */
  async resume(
    auth: ResolvedSession,
    deviceId: bigint,
    at: number,
    signature: string,
  ): Promise<OwnDevice> {
    await this.enforce(Limits.e2eeDevice, auth.userId.toString());
    const target = await this.ownDevice(auth.userId, deviceId);
    if (target.status === "revoked") throw notApproved();
    this.checkClock(at);
    const signed = deviceResumeBytes({
      userId: auth.userId.toString(),
      deviceId: target.id.toString(),
      at,
    });
    if (!verifyEd25519(target.signatureKey, signed, bytes(signature))) throw badSignature();
    const current = await this.sessionDevice(auth);
    if (current && current.id !== target.id && current.status !== "revoked") {
      throw conflict("CONFLICT", "This sign-in is already set up as another device.");
    }
    await this.db.transaction(async (tx) => {
      await tx.update(sessions).set({ deviceId: target.id }).where(eq(sessions.id, auth.sessionId));
      await tx.update(devices).set({ lastSeenAt: new Date() }).where(eq(devices.id, target.id));
    });
    return this.toOwn(target, target.id);
  }

  /** The very first device sets the account key. After that it changes only through a reset. */
  async setAccountKey(auth: ResolvedSession, publicKey: string) {
    const mine = await this.sessionDevice(auth);
    if (!mine || mine.status === "revoked") throw notApproved();
    const [any] = await this.db
      .select({ v: accountIdentityKeys.version })
      .from(accountIdentityKeys)
      .where(eq(accountIdentityKeys.userId, auth.userId))
      .limit(1);
    const taken = () =>
      conflict(
        "CONFLICT",
        "Your account key is already set. Confirm this device from another one.",
      );
    if (any) throw taken();
    await this.db
      .insert(accountIdentityKeys)
      .values({ userId: auth.userId, version: 1, publicKey: bytes(publicKey) })
      .catch(() => {
        throw taken();
      });
  }

  /**
   * Confirms a waiting device: the account key signed its certificate. Allowed from an approved
   * device, or for your very first device right after it set the account key.
   */
  async approve(
    auth: ResolvedSession,
    deviceId: bigint,
    issuedAt: number,
    signature: string,
    client: ClientContext,
  ) {
    const target = await this.ownDevice(auth.userId, deviceId);
    if (target.status !== "pending") throw conflict("CONFLICT", "That device isn't waiting.");
    const key = await this.currentKey(auth.userId);
    if (!key) throw badRequest("BAD_REQUEST", "Set up your account key first.");

    const caller = await this.sessionDevice(auth);
    if (caller?.status !== "approved") {
      const [{ n } = { n: 0 }] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(devices)
        .where(and(eq(devices.userId, auth.userId), eq(devices.status, "approved")));
      // The first-device bootstrap: only for itself, and only while no device is confirmed.
      if (caller?.id !== target.id || n > 0) throw notApproved();
    }

    this.checkClock(issuedAt);
    const signed = deviceCertificateBytes({
      userId: auth.userId.toString(),
      deviceId: target.id.toString(),
      signatureKey: target.signatureKey,
      issuedAt,
    });
    if (!verifyEd25519(key.publicKey, signed, bytes(signature))) throw badSignature();

    const done = await this.db
      .update(devices)
      .set({
        status: "approved",
        accountKeyVersion: key.version,
        certIssuedAt: new Date(issuedAt),
        certSignature: bytes(signature),
        approvedAt: new Date(),
      })
      .where(and(eq(devices.id, target.id), eq(devices.status, "pending")))
      .returning({ id: devices.id });
    if (done.length === 0) throw conflict("CONFLICT", "That device isn't waiting.");
    await this.log(auth.userId, "e2ee_device_approved", client.ip);
    const user = await this.account.user(auth.userId);
    this.mail(deviceApprovedEmail({ to: user.email, device: target.name, when: new Date() }));
  }

  /** Stops a device from reading new messages, and signs it out (docs/E2EE.md §9.4). */
  async revoke(
    auth: ResolvedSession,
    deviceId: bigint,
    body: { revokedAt: number; signature: string } | ConfirmWithPassword,
    client: ClientContext,
  ) {
    const target = await this.ownDevice(auth.userId, deviceId);
    if (target.status === "revoked") return;

    let reason: Reason;
    let revokedAt = new Date();
    let signature: Uint8Array | null = null;
    if ("signature" in body) {
      await this.approvedCaller(auth);
      const key = await this.currentKey(auth.userId);
      if (!key) throw badSignature();
      this.checkClock(body.revokedAt);
      const signed = deviceRevocationBytes({
        userId: auth.userId.toString(),
        deviceId: target.id.toString(),
        revokedAt: body.revokedAt,
      });
      signature = bytes(body.signature);
      if (!verifyEd25519(key.publicKey, signed, signature)) throw badSignature();
      reason = "device";
      revokedAt = new Date(body.revokedAt);
    } else {
      await this.account.confirm(await this.account.user(auth.userId), body, client);
      reason = "password";
    }

    const signedOut = await this.revokeDevices(
      auth.userId,
      [target.id],
      reason,
      revokedAt,
      signature,
    );
    for (const s of signedOut) await revokeSession(this.deps, auth.userId, s);
    await this.log(auth.userId, "e2ee_device_revoked", client.ip);
  }

  /** Marks devices revoked, drops their unused KeyPackages, and returns their sessions to end. */
  private async revokeDevices(
    userId: bigint,
    ids: bigint[],
    reason: Reason,
    revokedAt: Date,
    signature: Uint8Array | null,
  ): Promise<bigint[]> {
    if (ids.length === 0) return [];
    return this.db.transaction(async (tx) => {
      const changed = await tx
        .update(devices)
        .set({ status: "revoked", revokedAt })
        .where(
          and(inArray(devices.id, ids), eq(devices.userId, userId), ne(devices.status, "revoked")),
        )
        .returning({ id: devices.id });
      if (changed.length === 0) return [];
      const done = changed.map((c) => c.id);
      await tx
        .delete(keyPackages)
        .where(and(inArray(keyPackages.deviceId, done), isNull(keyPackages.claimedAt)));
      // A revoked device gets no more ciphertext: what was queued for it is dropped, and so is
      // any message nobody else is still waiting for.
      const queued = await tx
        .delete(e2eeDeliveries)
        .where(inArray(e2eeDeliveries.deviceId, done))
        .returning({ id: e2eeDeliveries.messageId });
      if (queued.length > 0) {
        await tx.delete(e2eeMessages).where(
          and(
            inArray(
              e2eeMessages.id,
              queued.map((q) => q.id),
            ),
            sql`not exists (select 1 from e2ee_deliveries d where d.message_id = ${e2eeMessages.id})`,
          ),
        );
      }
      await tx
        .insert(deviceRevocations)
        .values(done.map((deviceId) => ({ deviceId, userId, reason, revokedAt, signature })))
        .onConflictDoNothing();
      const bound = await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(inArray(sessions.deviceId, done), isNull(sessions.revokedAt)));
      return bound.map((b) => b.id);
    });
  }

  /**
   * Lost every device and the recovery key: a new account key. Every old device stops being
   * trusted, and contacts are told your security code changed. Needs the password (and two-step).
   */
  async resetAccountKey(
    auth: ResolvedSession,
    body: ConfirmWithPassword & { publicKey: string },
    client: ClientContext,
  ) {
    const user = await this.account.user(auth.userId);
    await this.account.confirm(user, body, client);

    const alive = await this.db
      .select({ id: devices.id })
      .from(devices)
      .where(and(eq(devices.userId, auth.userId), ne(devices.status, "revoked")));
    const ended = await this.revokeDevices(
      auth.userId,
      alive.map((d) => d.id),
      "key_reset",
      new Date(),
      null,
    );
    await this.db.transaction(async (tx) => {
      const [last] = await tx
        .select({ v: accountIdentityKeys.version })
        .from(accountIdentityKeys)
        .where(eq(accountIdentityKeys.userId, auth.userId))
        .orderBy(desc(accountIdentityKeys.version))
        .limit(1);
      await tx
        .update(accountIdentityKeys)
        .set({ supersededAt: new Date() })
        .where(
          and(
            eq(accountIdentityKeys.userId, auth.userId),
            isNull(accountIdentityKeys.supersededAt),
          ),
        );
      await tx.insert(accountIdentityKeys).values({
        userId: auth.userId,
        version: (last?.v ?? 0) + 1,
        publicKey: bytes(body.publicKey),
      });
    });
    // The device asking keeps its sign-in so it can set itself up again; the others are ended.
    for (const s of ended) if (s !== auth.sessionId) await revokeSession(this.deps, auth.userId, s);
    await this.log(auth.userId, "e2ee_key_reset", client.ip);
    this.mail(securityCodeChangedEmail({ to: user.email, when: new Date() }));
  }

  async ownDevices(auth: ResolvedSession) {
    const [key, rows, mine] = await Promise.all([
      this.currentKey(auth.userId),
      this.db
        .select()
        .from(devices)
        .where(eq(devices.userId, auth.userId))
        .orderBy(desc(devices.createdAt))
        .limit(100),
      this.sessionDevice(auth),
    ]);
    return {
      accountKeyVersion: key?.version ?? null,
      devices: rows.map((d) => this.toOwn(d, mine?.id ?? null)),
    };
  }

  /** Someone's account key and confirmed devices, to start or check an encrypted chat. */
  async publicDevices(viewerId: bigint, userId: bigint): Promise<PublicDevices> {
    const [u] = await this.db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (u?.status !== "active") throw notFound("User");
    if (viewerId !== userId && (await blockedEitherWay(this.db, viewerId, userId))) {
      throw notFound("User");
    }
    const key = await this.currentKey(userId);
    if (!key) return { userId: userId.toString(), accountKey: null, devices: [] };
    const rows = await this.db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.userId, userId),
          eq(devices.status, "approved"),
          eq(devices.accountKeyVersion, key.version),
        ),
      );
    return {
      userId: userId.toString(),
      accountKey: { version: key.version, publicKey: b64(key.publicKey) },
      devices: rows.flatMap((d) =>
        d.certIssuedAt && d.certSignature
          ? [
              {
                id: d.id.toString(),
                signatureKey: b64(d.signatureKey),
                accountKeyVersion: key.version,
                issuedAt: d.certIssuedAt.getTime(),
                signature: b64(d.certSignature),
              },
            ]
          : [],
      ),
    };
  }

  async uploadKeyPackages(auth: ResolvedSession, list: string[]) {
    const me = await this.approvedCaller(auth);
    await this.enforce(Limits.e2eeUpload, me.id.toString());
    const held = await this.unclaimed(me.id);
    if (held + list.length > E2EE_LIMITS.keyPackagesHeld) {
      throw conflict(
        "LIMIT_REACHED",
        `A device can hold ${E2EE_LIMITS.keyPackagesHeld} unused key packages.`,
      );
    }
    await this.db
      .insert(keyPackages)
      .values(
        list.map((k) => ({ id: this.deps.ids.next(), deviceId: me.id, keyPackage: bytes(k) })),
      );
    await this.db.update(devices).set({ lastSeenAt: new Date() }).where(eq(devices.id, me.id));
  }

  private async unclaimed(deviceId: bigint) {
    const [{ n } = { n: 0 }] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(keyPackages)
      .where(and(eq(keyPackages.deviceId, deviceId), isNull(keyPackages.claimedAt)));
    return n;
  }

  async keyPackageCount(auth: ResolvedSession) {
    const me = await this.approvedCaller(auth);
    return { unclaimed: await this.unclaimed(me.id) };
  }

  /**
   * One unused KeyPackage for each confirmed device of these people (and your own other devices),
   * each handed out once. Limited, because claiming uses up other people's packages.
   */
  async claim(auth: ResolvedSession, userIds: string[]): Promise<ClaimedKeyPackages> {
    const me = await this.approvedCaller(auth);
    await this.enforce(Limits.e2eeClaim, auth.userId.toString());
    const ids = [...new Set(userIds)].map((u) => BigInt(u));
    for (const id of ids) {
      if (id !== auth.userId) await this.publicDevices(auth.userId, id); // 404 unless reachable
    }
    const targets: { userId: bigint; deviceId: bigint }[] = [];
    for (const id of ids) {
      const key = await this.currentKey(id);
      if (!key) continue;
      const rows = await this.db
        .select({ id: devices.id })
        .from(devices)
        .where(
          and(
            eq(devices.userId, id),
            eq(devices.status, "approved"),
            eq(devices.accountKeyVersion, key.version),
            ne(devices.id, me.id),
          ),
        );
      for (const r of rows) targets.push({ userId: id, deviceId: r.id });
    }

    const result: ClaimedKeyPackages = { packages: [], missing: [] };
    for (const t of targets) {
      // Take the oldest unused one; SKIP LOCKED keeps two claimers from getting the same package.
      const [got] = await this.db
        .update(keyPackages)
        .set({ claimedAt: new Date(), claimedBy: me.id })
        .where(
          eq(
            keyPackages.id,
            sql`(select id from key_packages where device_id = ${t.deviceId} and claimed_at is null order by id limit 1 for update skip locked)`,
          ),
        )
        .returning({ keyPackage: keyPackages.keyPackage });
      const ref = { userId: t.userId.toString(), deviceId: t.deviceId.toString() };
      if (got) result.packages.push({ ...ref, keyPackage: b64(got.keyPackage) });
      else result.missing.push(ref);
    }
    return result;
  }
}
