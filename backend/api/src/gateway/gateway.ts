import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import {
  has,
  Permission,
  type Presence,
  type PresenceStatus,
  type SpaceDetail,
} from "@realm/contracts";
import { ClientFrame, GatewayClose, Op, type ReadyPayload } from "@realm/contracts/gateway";
import { and, eq, gt, inArray, isNull, schema } from "@realm/db";
import type { BusEvent } from "@realm/server-core";
import { sha256Hex } from "@realm/server-core";
import { type WebSocket, WebSocketServer } from "ws";
import type { Deps } from "../deps";
import { trustedOrigin } from "../lib/origins";
import { presenceVisibleIn, readPresences, writePresence } from "../lib/presence";
import { toSelfUser, toUserSettings } from "../lib/serialize";
import { resolveSession } from "../lib/sessions";
import { ConversationsService } from "../modules/dms/service";
import { canSeePost } from "../modules/social/access";
import { findSpace, roomAccess, spaceRoomAccess, topicOf } from "../modules/spaces/access";
import { MessagesService } from "../modules/spaces/messages";
import { SpacesService } from "../modules/spaces/service";

const { sessions, users, userSettings, channelRecipients } = schema;

export const HEARTBEAT_INTERVAL_MS = 41_250;
const IDENTIFY_TIMEOUT_MS = 10_000;
/** Re-check that the session still holds (signed out elsewhere, suspended). */
const SESSION_RECHECK_MS = 5 * 60_000;
const FRAMES_PER_MINUTE = 120;
const TYPING_THROTTLE_MS = 5_000;

/** Events about one room: delivered only to people who can see that room. */
const ROOM_EVENTS = new Set([
  "MESSAGE_CREATE",
  "MESSAGE_UPDATE",
  "MESSAGE_DELETE",
  "MESSAGE_REACTION_ADD",
  "MESSAGE_REACTION_REMOVE",
  "CHANNEL_PINS_UPDATE",
  "TYPING_START",
  "VOICE_STATE_UPDATE",
]);
/** Events that can change who sees which room: refresh the Space first. */
const SHAPE_EVENTS = new Set([
  "CHANNEL_CREATE",
  "CHANNEL_UPDATE",
  "COMMUNITY_ROLE_CREATE",
  "COMMUNITY_ROLE_UPDATE",
  "COMMUNITY_ROLE_DELETE",
  "COMMUNITY_MEMBER_UPDATE",
]);

interface Person {
  userId: string;
  sessionId: bigint;
  showPresence: boolean;
  /** Read receipts are mutual: off means you neither show nor see them. */
  showReadReceipts: boolean;
  birthDate: string;
}

/**
 * The realtime gateway (docs/API.md "Realtime gateway"). Durable writes go through REST; this
 * only carries their news to the right sockets, plus the ephemeral things: heartbeats, presence
 * and typing. In single-process development it rides on the API's own HTTP server; in
 * production it runs as its own process (gateway-main.ts) and hears the API over Redis.
 */
export class Gateway {
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  private readonly connections = new Set<Connection>();
  /** Open connections per person on this node, so presence goes offline only with the last one. */
  readonly localCount = new Map<string, number>();
  /**
   * Who's in each voice room: room ID → person ID → connections in it. Kept per gateway node,
   * which is fine for one node (the free-tier setup); several nodes would share it in Redis.
   */
  readonly voice = new Map<string, Map<string, number>>();

  voiceIn(channelId: string) {
    return [...(this.voice.get(channelId)?.keys() ?? [])];
  }

  /** Adds or removes one connection's presence in a room; true if the person's state changed. */
  voiceMove(channelId: string, userId: string, delta: 1 | -1) {
    const room = this.voice.get(channelId) ?? new Map<string, number>();
    const before = room.get(userId) ?? 0;
    const after = Math.max(0, before + delta);
    if (after === 0) room.delete(userId);
    else room.set(userId, after);
    if (room.size) this.voice.set(channelId, room);
    else this.voice.delete(channelId);
    return (before === 0) !== (after === 0);
  }
  readonly spaces: SpacesService;
  readonly messages: MessagesService;
  readonly dms: ConversationsService;

  constructor(readonly deps: Deps) {
    this.spaces = new SpacesService(deps);
    this.messages = new MessagesService(deps);
    this.dms = new ConversationsService(deps, this.messages);
  }

  /**
   * Browsers must come from Realm's web origin. Native apps sign in with a token, and send either
   * no Origin or (Android's WebSocket, unasked) the gateway's own address: no web page is served
   * from there, so that's the app.
   */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const origin = req.headers.origin;
    const own = req.headers.host
      ? [`http://${req.headers.host}`, `https://${req.headers.host}`]
      : [];
    if (origin && !trustedOrigin(this.deps, origin) && !own.includes(origin)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      const conn = new Connection(this, ws);
      this.connections.add(conn);
      ws.on("close", () => {
        this.connections.delete(conn);
        void conn.dispose();
      });
    });
  }

  async close() {
    for (const c of this.connections) c.ws.close(1001, "server shutting down");
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }

  /** Announce someone's presence to every Space where it may be seen. */
  async broadcastPresence(
    person: Person,
    status: PresenceStatus,
    spaceIds: Iterable<string>,
    dmIds: Iterable<string> = [],
  ) {
    if (!person.showPresence) return;
    const presence: Presence = { userId: person.userId, status, activity: null };
    for (const id of spaceIds) {
      const space = await findSpace(this.deps.db, id);
      if (!space || !presenceVisibleIn(person, space)) continue;
      await this.deps.bus.publish(`community:${id}`, { type: "PRESENCE_UPDATE", data: presence });
    }
    // The people you talk to directly see you come and go too.
    for (const id of dmIds) {
      await this.deps.bus.publish(`dm:${id}`, { type: "PRESENCE_UPDATE", data: presence });
    }
  }
}

class Connection {
  private seq = 0;
  private person: Person | null = null;
  private status: PresenceStatus = "online";
  private readonly sessionId = randomUUID();
  /** Topic → unsubscribe. */
  private readonly subs = new Map<string, () => Promise<void>>();
  /** Space ID → the room IDs this person can see there. */
  private readonly visible = new Map<string, Set<string>>();
  /** The DMs and group chats this person is in (closed ones too, so they come back). */
  private readonly dms = new Set<string>();
  private readonly typing = new Map<string, number>();
  /** The voice room this connection is in, if any. */
  private inVoice: { channelId: string; spaceId: string } | null = null;
  private lastBeat = Date.now();
  private lastCheck = Date.now();
  private frames = 0;
  private frameWindow = Date.now();
  private readonly timers: NodeJS.Timeout[] = [];
  private closed = false;

  constructor(
    private readonly gw: Gateway,
    readonly ws: WebSocket,
  ) {
    this.send({ op: Op.HELLO, d: { heartbeatInterval: HEARTBEAT_INTERVAL_MS } });
    this.timers.push(
      setTimeout(() => {
        if (!this.person) this.ws.close(GatewayClose.NOT_AUTHENTICATED, "identify first");
      }, IDENTIFY_TIMEOUT_MS),
      setInterval(() => void this.tick(), 15_000),
    );
    ws.on("message", (data, isBinary) => {
      if (isBinary) return this.ws.close(GatewayClose.DECODE_ERROR, "text frames only");
      void this.receive(data.toString("utf8")).catch((err) => {
        this.gw.deps.logger.error({ err }, "gateway: frame failed");
        this.ws.close(GatewayClose.UNKNOWN_ERROR, "something went wrong");
      });
    });
    ws.on("error", () => this.ws.terminate());
  }

  private send(frame: unknown) {
    if (this.ws.readyState === 1) this.ws.send(JSON.stringify(frame));
  }

  private dispatch(t: string, d: unknown) {
    this.seq += 1;
    this.send({ op: Op.DISPATCH, t, s: this.seq, d });
  }

  private async tick() {
    const now = Date.now();
    if (this.person && now - this.lastBeat > HEARTBEAT_INTERVAL_MS * 2) {
      this.ws.close(GatewayClose.SESSION_TIMED_OUT, "missed heartbeats");
      return;
    }
    if (this.person && now - this.lastCheck > SESSION_RECHECK_MS) {
      this.lastCheck = now;
      if (!(await this.sessionHolds(this.person.sessionId))) {
        this.ws.close(GatewayClose.AUTHENTICATION_FAILED, "signed out");
      }
    }
  }

  private async sessionHolds(sessionId: bigint) {
    const [row] = await this.gw.deps.db
      .select({ id: sessions.id })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.id, sessionId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
          eq(users.status, "active"),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  private async receive(raw: string) {
    const now = Date.now();
    if (now - this.frameWindow > 60_000) {
      this.frameWindow = now;
      this.frames = 0;
    }
    if (++this.frames > FRAMES_PER_MINUTE) {
      this.ws.close(GatewayClose.RATE_LIMITED, "slow down");
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      this.ws.close(GatewayClose.DECODE_ERROR, "not JSON");
      return;
    }
    const parsed = ClientFrame.safeParse(json);
    if (!parsed.success) {
      this.ws.close(GatewayClose.DECODE_ERROR, "unknown frame");
      return;
    }
    const frame = parsed.data;
    if (frame.op === Op.IDENTIFY) return this.identify(frame.d);
    if (!this.person) {
      this.ws.close(GatewayClose.NOT_AUTHENTICATED, "identify first");
      return;
    }
    switch (frame.op) {
      case Op.HEARTBEAT:
        this.lastBeat = now;
        this.send({ op: Op.HEARTBEAT_ACK, d: null });
        if (this.person.showPresence && this.status !== "offline") {
          await writePresence(this.gw.deps.kv, this.person.userId, this.status);
        }
        return;
      case Op.TYPING:
        return this.typingIn(frame.d.channelId);
      case Op.PRESENCE_UPDATE:
        this.status = frame.d.status;
        await writePresence(this.gw.deps.kv, this.person.userId, this.status);
        await this.gw.broadcastPresence(this.person, this.status, this.visible.keys(), this.dms);
        return;
      case Op.VOICE_STATE:
        return this.voiceTo(frame.d.channelId);
      case Op.WATCH_POSTS:
        return this.watchPosts(frame.d.postIds);
      case Op.RESUME:
        // No replay buffer yet: start a fresh session and refetch.
        this.send({ op: Op.INVALID_SESSION, d: { resumable: false } });
        return;
      default:
        // SUBSCRIBE / UNSUBSCRIBE: every Space is small enough to receive in full for now.
        return;
    }
  }

  private async identify(d: {
    token?: string;
    ticket?: string;
    presence?: { status: PresenceStatus };
  }) {
    if (this.person) {
      this.ws.close(GatewayClose.ALREADY_AUTHENTICATED, "already identified");
      return;
    }
    const deps = this.gw.deps;
    let userId: string | null = null;
    let sessionId: bigint | null = null;
    if (d.ticket) {
      const raw = await deps.kv.take(`gwt:${sha256Hex(d.ticket)}`);
      if (raw) {
        const ticket = JSON.parse(raw) as { userId: string; sessionId: string };
        if (await this.sessionHolds(BigInt(ticket.sessionId))) {
          userId = ticket.userId;
          sessionId = BigInt(ticket.sessionId);
        }
      }
    } else if (d.token) {
      const session = await resolveSession(deps, d.token, { peek: true });
      if (session) {
        userId = session.userId.toString();
        sessionId = session.sessionId;
      }
    }
    if (!userId || sessionId === null) {
      this.ws.close(GatewayClose.AUTHENTICATION_FAILED, "sign in again");
      return;
    }
    const id = BigInt(userId);
    const [user] = await deps.db.select().from(users).where(eq(users.id, id));
    if (!user) {
      this.ws.close(GatewayClose.AUTHENTICATION_FAILED, "sign in again");
      return;
    }
    const [settingsRow] = await deps.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, id));
    const settings = settingsRow ? toUserSettings(settingsRow) : null;
    this.person = {
      userId,
      sessionId,
      showPresence: settings?.showPresence ?? true,
      showReadReceipts: settings?.showReadReceipts ?? true,
      birthDate: user.birthDate,
    };
    this.status = d.presence?.status ?? "online";
    this.lastBeat = Date.now();
    this.lastCheck = Date.now();

    await this.subscribe(`user:${userId}`);
    const communities = await this.gw.spaces.listMine(id);
    for (const space of communities) await this.track(space);
    const memberships = await deps.db
      .select({ channelId: channelRecipients.channelId })
      .from(channelRecipients)
      .where(eq(channelRecipients.userId, id));
    for (const m of memberships) await this.follow(m.channelId.toString());
    const dmChannels = await this.gw.dms.list(id);

    // Who's around in your Spaces (each Space's own visibility rules apply), and the people in
    // your conversations.
    const presences = new Map<string, Presence>();
    for (const space of communities) {
      const list = await this.gw.spaces.members(space.id, id);
      for (const p of list.presences) presences.set(p.userId, p);
    }
    const peers = [...new Set(dmChannels.flatMap((c) => c.recipients.map((r) => r.id)))].filter(
      (p) => !presences.has(p),
    );
    if (peers.length) {
      const visibleTo = await deps.db
        .select({ id: userSettings.userId, show: userSettings.showPresence })
        .from(userSettings)
        .where(inArray(userSettings.userId, peers.map(BigInt)));
      const hidden = new Set(visibleTo.filter((v) => !v.show).map((v) => v.id.toString()));
      const live = await readPresences(
        deps.kv,
        peers.filter((p) => !hidden.has(p)),
      );
      for (const [userId, status] of live) {
        if (status !== "offline") presences.set(userId, { userId, status, activity: null });
      }
    }

    const ready: ReadyPayload = {
      sessionId: this.sessionId,
      user: toSelfUser(user),
      settings: settings ?? {
        theme: "system",
        accent: "mint",
        reducedMotion: "system",
        locale: "en",
        profileVisibility: "public",
        dmPolicy: "friends_and_communities",
        friendRequestPolicy: "everyone",
        showPresence: true,
        showReadReceipts: true,
      },
      relationships: [],
      communities,
      dmChannels,
      readStates: await this.gw.messages.readStates(id),
      presences: [...presences.values()],
      voiceStates: communities.flatMap((space) =>
        space.channels
          .filter((c) => c.type === "voice")
          .flatMap((c) => this.gw.voiceIn(c.id).map((userId) => ({ channelId: c.id, userId }))),
      ),
    };
    this.dispatch("READY", ready);

    this.gw.localCount.set(userId, (this.gw.localCount.get(userId) ?? 0) + 1);
    if (this.person.showPresence && this.status !== "offline") {
      await writePresence(deps.kv, userId, this.status);
      await this.gw.broadcastPresence(this.person, this.status, this.visible.keys(), this.dms);
    }
  }

  private async subscribe(topic: string) {
    if (this.subs.has(topic) || this.closed) return;
    const off = await this.gw.deps.bus.subscribe(topic, (t, event) => {
      void this.deliver(t, event).catch((err) =>
        this.gw.deps.logger.error({ err, topic: t }, "gateway: delivery failed"),
      );
    });
    this.subs.set(topic, off);
  }

  private async unsubscribe(topic: string) {
    const off = this.subs.get(topic);
    this.subs.delete(topic);
    await off?.();
  }

  /** Follow a Space: hear its events, and remember which of its rooms you can see. */
  private async track(space: SpaceDetail) {
    this.visible.set(space.id, new Set(space.channels.map((c) => c.id)));
    await this.subscribe(`community:${space.id}`);
  }

  /** Follow a DM or group chat. */
  /** Posts on this person's screen: hear their likes and comments, if they may see them. */
  private watching = new Set<string>();
  private async watchPosts(ids: string[]) {
    if (!this.person) return;
    const want = new Set(ids.slice(0, 30));
    for (const id of this.watching) {
      if (!want.has(id)) {
        this.watching.delete(id);
        await this.unsubscribe(`post:${id}`);
      }
    }
    const fresh = [...want].filter((id) => !this.watching.has(id));
    if (!fresh.length) return;
    const rows = await this.gw.deps.db
      .select()
      .from(schema.posts)
      .where(inArray(schema.posts.id, fresh.map(BigInt)));
    for (const post of rows) {
      if (!(await canSeePost(this.gw.deps.db, post, BigInt(this.person.userId)))) continue;
      this.watching.add(post.id.toString());
      await this.subscribe(`post:${post.id}`);
    }
  }

  private async follow(channelId: string) {
    this.dms.add(channelId);
    await this.subscribe(`dm:${channelId}`);
  }

  private async unfollow(channelId: string) {
    this.dms.delete(channelId);
    await this.unsubscribe(`dm:${channelId}`);
  }

  private async forget(spaceId: string) {
    this.visible.delete(spaceId);
    await this.unsubscribe(`community:${spaceId}`);
  }

  private async refresh(spaceId: string) {
    if (!this.person) return;
    const space = await findSpace(this.gw.deps.db, spaceId);
    if (!space) return this.forget(spaceId);
    try {
      const detail = await this.gw.spaces.detail(space, BigInt(this.person.userId));
      this.visible.set(spaceId, new Set(detail.channels.map((c) => c.id)));
    } catch {
      await this.forget(spaceId);
    }
  }

  private async deliver(topic: string, event: BusEvent) {
    if (!this.person || this.closed) return;
    if (event.userIds && !event.userIds.includes(this.person.userId)) return;
    const data = event.data as Record<string, unknown>;

    if (topic.startsWith("user:")) {
      if (event.type === "COMMUNITY_CREATE") await this.track(event.data as SpaceDetail);
      if (event.type === "COMMUNITY_DELETE") await this.forget(String(data.id));
      if (event.type === "CHANNEL_CREATE" && data.communityId === null) {
        await this.follow(String(data.id));
      }
      // Closing a DM keeps you in it (it comes back with a new message); leaving a group doesn't.
      if (event.type === "CHANNEL_DELETE" && data.communityId === null) {
        const [still] = await this.gw.deps.db
          .select({ userId: channelRecipients.userId })
          .from(channelRecipients)
          .where(
            and(
              eq(channelRecipients.channelId, BigInt(String(data.id))),
              eq(channelRecipients.userId, BigInt(this.person.userId)),
            ),
          )
          .limit(1);
        if (!still) await this.unfollow(String(data.id));
      }
      this.dispatch(event.type, event.data);
      return;
    }

    if (topic.startsWith("post:")) {
      this.dispatch(event.type, event.data);
      return;
    }

    if (topic.startsWith("dm:")) {
      if (event.type === "TYPING_START" && data.userId === this.person.userId) return;
      if (event.type === "PRESENCE_UPDATE" && data.userId === this.person.userId) return;
      if (event.type === "MESSAGE_ACK") {
        if (data.userId === this.person.userId || !this.person.showReadReceipts) return;
      }
      this.dispatch(event.type, event.data);
      return;
    }

    const spaceId = topic.slice("community:".length);
    if (event.type === "COMMUNITY_DELETE") {
      await this.forget(spaceId);
      this.dispatch(event.type, event.data);
      return;
    }
    if (event.type === "COMMUNITY_MEMBER_REMOVE" && data.userId === this.person.userId) {
      await this.forget(spaceId);
      this.dispatch("COMMUNITY_DELETE", { id: spaceId, unavailable: false });
      return;
    }
    if (SHAPE_EVENTS.has(event.type)) await this.refresh(spaceId);
    if (event.type === "CHANNEL_CREATE" || event.type === "CHANNEL_UPDATE") {
      if (!this.visible.get(spaceId)?.has(String(data.id))) return;
    }
    if (event.type === "CHANNEL_DELETE") {
      const rooms = this.visible.get(spaceId);
      if (!rooms?.has(String(data.id))) return;
      rooms.delete(String(data.id));
    }
    if (ROOM_EVENTS.has(event.type)) {
      if (!this.visible.get(spaceId)?.has(String(data.channelId))) return;
      // Your own typing isn't news to you.
      if (event.type === "TYPING_START" && data.userId === this.person.userId) return;
    }
    this.dispatch(event.type, event.data);
  }

  /** Joined a voice room (or left voice, with null). The room must be one you can connect to. */
  private async voiceTo(channelId: string | null) {
    if (!this.person) return;
    const userId = this.person.userId;
    if (this.inVoice && this.inVoice.channelId !== channelId) {
      const was = this.inVoice;
      this.inVoice = null;
      if (this.gw.voiceMove(was.channelId, userId, -1)) {
        await this.gw.deps.bus.publish(`community:${was.spaceId}`, {
          type: "VOICE_STATE_UPDATE",
          data: { communityId: was.spaceId, channelId: was.channelId, userId, joined: false },
        });
      }
    }
    if (!channelId || this.inVoice) return;
    try {
      const { channel, access, permissions } = await spaceRoomAccess(
        this.gw.deps.db,
        BigInt(channelId),
        BigInt(userId),
      );
      if (channel.type !== "voice" || !has(permissions, Permission.CONNECT)) return;
      const spaceId = access.community.id.toString();
      this.inVoice = { channelId, spaceId };
      if (this.gw.voiceMove(channelId, userId, 1)) {
        await this.gw.deps.bus.publish(`community:${spaceId}`, {
          type: "VOICE_STATE_UPDATE",
          data: { communityId: spaceId, channelId, userId, joined: true },
        });
      }
    } catch {
      // A room you can't see: nothing to say.
    }
  }

  private async typingIn(channelId: string) {
    if (!this.person) return;
    const now = Date.now();
    if (now - (this.typing.get(channelId) ?? 0) < TYPING_THROTTLE_MS) return;
    this.typing.set(channelId, now);
    try {
      const ctx = await roomAccess(this.gw.deps.db, BigInt(channelId), BigInt(this.person.userId));
      if (!has(ctx.permissions, Permission.SEND_MESSAGES)) return;
      await this.gw.deps.bus.publish(topicOf(ctx), {
        type: "TYPING_START",
        data: { channelId, userId: this.person.userId, at: now },
      });
    } catch {
      // A room you can't see: say nothing.
    }
  }

  async dispose() {
    if (this.closed) return;
    this.closed = true;
    for (const t of this.timers) clearTimeout(t);
    const person = this.person;
    const spaceIds = [...this.visible.keys()];
    if (person && this.inVoice) {
      const was = this.inVoice;
      this.inVoice = null;
      if (this.gw.voiceMove(was.channelId, person.userId, -1)) {
        await this.gw.deps.bus
          .publish(`community:${was.spaceId}`, {
            type: "VOICE_STATE_UPDATE",
            data: {
              communityId: was.spaceId,
              channelId: was.channelId,
              userId: person.userId,
              joined: false,
            },
          })
          .catch(() => {});
      }
    }
    await Promise.allSettled([...this.subs.keys()].map((t) => this.unsubscribe(t)));
    if (!person) return;
    const left = (this.gw.localCount.get(person.userId) ?? 1) - 1;
    if (left > 0) {
      this.gw.localCount.set(person.userId, left);
      return;
    }
    this.gw.localCount.delete(person.userId);
    await writePresence(this.gw.deps.kv, person.userId, "offline");
    await this.gw.broadcastPresence(person, "offline", spaceIds);
  }
}

/** Wires the gateway onto an HTTP server's upgrade requests at `path`. */
export function attachGateway(
  server: import("node:http").Server,
  deps: Deps,
  path = "/gateway",
): Gateway {
  const gateway = new Gateway(deps);
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== path) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    gateway.handleUpgrade(req, socket, head);
  });
  return gateway;
}
