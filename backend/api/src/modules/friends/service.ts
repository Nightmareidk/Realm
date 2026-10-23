import type { Relationship } from "@realm/contracts";
import { and, eq, inArray, or, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, badRequest, notFound } from "../../lib/errors";
import { summaryColumns, toUserSummary } from "../../lib/serialize-spaces";
import { blockedEitherWay } from "../spaces/access";

const { relationships, users, userSettings } = schema;

/**
 * Friends, the way chat apps do them: ask, and once they say yes you're friends both ways.
 * Separate from following (which is about posts). Each person chooses who may ask (everyone,
 * friends of friends, or nobody), and a block always wins. Friends can message each other
 * straight away and add each other to groups.
 */
export class FriendsService {
  constructor(private readonly deps: Deps) {}

  private get db() {
    return this.deps.db;
  }

  async list(userId: bigint): Promise<Relationship[]> {
    const rows = await this.db
      .select({ type: relationships.type, at: relationships.createdAt, user: summaryColumns })
      .from(relationships)
      .innerJoin(users, eq(users.id, relationships.targetId))
      .where(
        and(
          eq(relationships.userId, userId),
          inArray(relationships.type, ["friend", "pending_incoming", "pending_outgoing"]),
        ),
      )
      .limit(1000);
    return rows.map((r) => ({
      user: toUserSummary(r.user),
      type: r.type,
      since: r.at.toISOString(),
    }));
  }

  private async person(username: string) {
    const [row] = await this.db
      .select({ id: users.id, name: users.displayName, status: users.status })
      .from(users)
      .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
      .limit(1);
    if (row?.status !== "active") throw notFound("Person");
    return row;
  }

  private async rowOf(userId: bigint, targetId: bigint) {
    const [row] = await this.db
      .select({ type: relationships.type })
      .from(relationships)
      .where(and(eq(relationships.userId, userId), eq(relationships.targetId, targetId)))
      .limit(1);
    return row?.type ?? null;
  }

  private async tell(userId: bigint, otherId: bigint) {
    const [row] = await this.list(userId).then((all) =>
      all.filter((r) => r.user.id === otherId.toString()),
    );
    await this.deps.bus.publish(
      `user:${userId}`,
      row
        ? { type: "RELATIONSHIP_ADD", data: row }
        : { type: "RELATIONSHIP_REMOVE", data: { userId: otherId.toString() } },
    );
  }

  /** Ask to be friends, or say yes to someone who asked you. */
  async add(userId: bigint, username: string): Promise<Relationship["type"]> {
    const them = await this.person(username);
    if (them.id === userId) throw badRequest("BAD_REQUEST", "That's you.");
    if (await blockedEitherWay(this.db, userId, them.id)) {
      throw new AppError(403, "BLOCKED", "You can't add this person.");
    }
    const mine = await this.rowOf(userId, them.id);
    if (mine === "friend") return "friend";
    if (mine === "pending_outgoing") return "pending_outgoing";
    if (mine === "pending_incoming") {
      // They asked: now you're friends, both ways.
      await this.db.transaction(async (tx) => {
        await tx
          .update(relationships)
          .set({ type: "friend", createdAt: new Date() })
          .where(
            or(
              and(eq(relationships.userId, userId), eq(relationships.targetId, them.id)),
              and(eq(relationships.userId, them.id), eq(relationships.targetId, userId)),
            ),
          );
      });
      await this.tell(userId, them.id);
      await this.tell(them.id, userId);
      return "friend";
    }
    // Who may ask: their choice.
    const [setting] = await this.db
      .select({ policy: userSettings.friendRequestPolicy })
      .from(userSettings)
      .where(eq(userSettings.userId, them.id))
      .limit(1);
    const policy = setting?.policy ?? "everyone";
    if (policy === "nobody") {
      throw new AppError(403, "FORBIDDEN", `${them.name} isn't taking friend requests.`);
    }
    if (policy === "friends_of_friends") {
      const [shared] = await this.db
        .select({ id: relationships.targetId })
        .from(relationships)
        .where(
          and(
            eq(relationships.userId, userId),
            eq(relationships.type, "friend"),
            sql`${relationships.targetId} in (select target_id from relationships where user_id = ${them.id} and type = 'friend')`,
          ),
        )
        .limit(1);
      if (!shared) {
        throw new AppError(
          403,
          "FORBIDDEN",
          `${them.name} takes friend requests only from friends of friends.`,
        );
      }
    }
    await this.db.transaction(async (tx) => {
      await tx
        .insert(relationships)
        .values({ userId, targetId: them.id, type: "pending_outgoing" })
        .onConflictDoNothing();
      await tx
        .insert(relationships)
        .values({ userId: them.id, targetId: userId, type: "pending_incoming" })
        .onConflictDoNothing();
    });
    await this.tell(userId, them.id);
    await this.tell(them.id, userId);
    return "pending_outgoing";
  }

  /** Unfriend, cancel your request, or turn theirs down. Blocks are left alone. */
  async remove(userId: bigint, username: string) {
    const them = await this.person(username);
    await this.db
      .delete(relationships)
      .where(
        and(
          inArray(relationships.type, ["friend", "pending_incoming", "pending_outgoing"]),
          or(
            and(eq(relationships.userId, userId), eq(relationships.targetId, them.id)),
            and(eq(relationships.userId, them.id), eq(relationships.targetId, userId)),
          ),
        ),
      );
    await this.tell(userId, them.id);
    await this.tell(them.id, userId);
  }
}
