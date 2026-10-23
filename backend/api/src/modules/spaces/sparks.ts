import {
  type AutoModRules,
  DEFAULT_AUTOMOD,
  GLOW_LEVELS,
  glowLevel,
  has,
  Permission,
  SPARK_DAYS,
  SPARKS_PER_PERSON,
  type SparkStatus,
} from "@realm/contracts";
import { and, desc, eq, gt, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, badRequest } from "../../lib/errors";
import { memberAccess } from "./access";

const { spaceSparks, communities, users, auditLog } = schema;

/** A Space's Glow level right now (from its live Sparks). */
export async function spaceGlow(db: Deps["db"], communityId: bigint) {
  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(spaceSparks)
    .where(and(eq(spaceSparks.communityId, communityId), gt(spaceSparks.endsAt, new Date())));
  return glowLevel(count?.n ?? 0);
}

/** Refuses a perk the Space hasn't lit up yet, saying how many Sparks it takes. */
export async function needGlow(db: Deps["db"], communityId: bigint, level: number, what: string) {
  if ((await spaceGlow(db, communityId)) >= level) return;
  const sparks = GLOW_LEVELS.find((g) => g.level === level)?.sparks ?? 0;
  throw new AppError(
    403,
    "MISSING_PERMISSION",
    `${what} needs Glow ${level} (${sparks} Sparks). Members can give Sparks in Space settings.`,
  );
}

/**
 * Sparks (Realm's boosting) and AutoMod for Spaces. Sparks need real payments in production;
 * until those exist, anyone can try them free while Realm is being built (marked as tests).
 */
export class SparksService {
  constructor(private readonly deps: Deps) {}

  private get db() {
    return this.deps.db;
  }

  private get testing() {
    return !this.deps.config.isProduction;
  }

  private get payments() {
    return Boolean(this.deps.config.STRIPE_SECRET_KEY);
  }

  async status(space: string, userId: bigint): Promise<SparkStatus> {
    const access = await memberAccess(this.db, space, userId);
    const id = access.community.id;
    const live = and(eq(spaceSparks.communityId, id), gt(spaceSparks.endsAt, new Date()));
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(spaceSparks)
      .where(live);
    const [mine] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(spaceSparks)
      .where(and(live, eq(spaceSparks.userId, userId)));
    const backers = await this.db
      .selectDistinctOn([spaceSparks.userId], {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      })
      .from(spaceSparks)
      .innerJoin(users, eq(users.id, spaceSparks.userId))
      .where(live)
      .orderBy(spaceSparks.userId, desc(spaceSparks.startedAt))
      .limit(30);
    const n = count?.n ?? 0;
    const level = glowLevel(n);
    const next = GLOW_LEVELS.find((g) => g.level === level + 1);
    return {
      count: n,
      level,
      toNext: next ? next.sparks - n : null,
      mine: mine?.n ?? 0,
      backers: backers.map((b) => ({
        id: b.id.toString(),
        username: b.username,
        displayName: b.displayName,
      })),
      payments: this.payments,
      testing: this.testing && !this.payments,
    };
  }

  /** Give a Space a Spark (free to try until payments exist; refused in production without them). */
  async give(space: string, userId: bigint): Promise<SparkStatus> {
    const access = await memberAccess(this.db, space, userId);
    if (!this.payments && !this.testing) {
      throw new AppError(503, "PAYMENTS_NOT_SET_UP", "Sparks open once payments are set up.");
    }
    if (this.payments) {
      throw new AppError(503, "PAYMENTS_NOT_SET_UP", "Paying for Sparks comes next.");
    }
    const [mine] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(spaceSparks)
      .where(
        and(
          eq(spaceSparks.communityId, access.community.id),
          eq(spaceSparks.userId, userId),
          gt(spaceSparks.endsAt, new Date()),
        ),
      );
    if ((mine?.n ?? 0) >= SPARKS_PER_PERSON) {
      throw badRequest("BAD_REQUEST", `You can give a Space up to ${SPARKS_PER_PERSON} Sparks.`);
    }
    await this.db.insert(spaceSparks).values({
      id: this.deps.ids.next(),
      communityId: access.community.id,
      userId,
      source: "test",
      endsAt: new Date(Date.now() + SPARK_DAYS * 86_400_000),
    });
    await this.db.insert(auditLog).values({
      id: this.deps.ids.next(),
      communityId: access.community.id,
      actorId: userId,
      action: "spark.give",
      targetType: "community",
      targetId: access.community.id,
    });
    return this.status(space, userId);
  }

  async automod(space: string, userId: bigint): Promise<AutoModRules> {
    const access = await memberAccess(this.db, space, userId);
    return { ...DEFAULT_AUTOMOD, ...access.community.automod };
  }

  async setAutomod(space: string, userId: bigint, rules: AutoModRules): Promise<AutoModRules> {
    const access = await memberAccess(this.db, space, userId);
    if (!has(access.base, Permission.MANAGE_COMMUNITY)) {
      throw new AppError(
        403,
        "MISSING_PERMISSION",
        "Only people who manage this Space can change AutoMod.",
      );
    }
    const words = [...new Set(rules.words.map((w) => w.toLowerCase()))];
    await this.db
      .update(communities)
      .set({ automod: { ...rules, words } })
      .where(eq(communities.id, access.community.id));
    await this.db.insert(auditLog).values({
      id: this.deps.ids.next(),
      communityId: access.community.id,
      actorId: userId,
      action: "automod.update",
      targetType: "community",
      targetId: access.community.id,
    });
    return { ...rules, words };
  }
}

const LINK = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.[a-z]{2,}/i;
const INVITE =
  /\b(discord\.gg|discord\.com\/invite|chat\.whatsapp\.com|t\.me|tomyrealm\.com\/invite)\//i;

/**
 * Whether AutoMod holds a message back in a Space room, and why (shown to the sender). People
 * who can manage messages are never held back.
 */
export function automodBlocks(
  rules: Partial<AutoModRules> | null | undefined,
  text: string,
  author: { createdAt: Date },
  joinedAt: Date | null,
): string | null {
  if (!rules) return null;
  const lower = text.toLowerCase();
  for (const w of rules.words ?? []) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(lower)) {
      return "This Space doesn't allow one of the words in that message.";
    }
  }
  if (rules.blockInvites && INVITE.test(text))
    return "Invites to other places aren't allowed here.";
  if (rules.blockLinks && LINK.test(text)) return "Links aren't allowed in this Space.";
  const days = rules.minAccountDays ?? 0;
  if (days > 0 && Date.now() - author.createdAt.getTime() < days * 86_400_000) {
    return `This Space lets accounts post once they're ${days} ${days === 1 ? "day" : "days"} old.`;
  }
  const minutes = rules.minMemberMinutes ?? 0;
  if (minutes > 0 && joinedAt && Date.now() - joinedAt.getTime() < minutes * 60_000) {
    return `New members can post here after ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
  }
  return null;
}
