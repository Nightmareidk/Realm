import {
  isMinor,
  PublicUser,
  SelfUser,
  TEEN_USER_SETTINGS,
  UpdateSelf,
  UpdateUserSettings,
  Username,
  UserSettings,
} from "@realm/contracts";
import { and, eq, schema, sql } from "@realm/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { badRequest, conflict, notFound } from "../../lib/errors";
import { toPublicUser, toSelfUser, toUserSettings } from "../../lib/serialize";
import { authOf, requireAuth } from "../../plugins/context";
import { RESERVED_USERNAMES } from "../auth/reserved";

const { users, userSettings } = schema;

export const userRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/@me",
      { preHandler: requireAuth, schema: { response: { 200: SelfUser } } },
      async (req) => {
        const [user] = await deps.db
          .select()
          .from(users)
          .where(eq(users.id, authOf(req).userId));
        if (!user) throw notFound("User");
        return toSelfUser(user);
      },
    );

    app.patch(
      "/@me",
      { preHandler: requireAuth, schema: { body: UpdateSelf, response: { 200: SelfUser } } },
      async (req) => {
        const { userId } = authOf(req);
        const body = req.body;

        if (body.username !== undefined) {
          if (RESERVED_USERNAMES.has(body.username)) {
            throw conflict("USERNAME_RESERVED", "That username isn't available");
          }
          const [taken] = await deps.db
            .select({ id: users.id })
            .from(users)
            .where(sql`lower(${users.username}) = ${body.username} and ${users.id} <> ${userId}`)
            .limit(1);
          if (taken) throw conflict("USERNAME_TAKEN", "That username is taken");
        }

        // A new picture must be your own finished image upload.
        for (const id of [body.avatarMediaId, body.bannerMediaId]) {
          if (!id) continue;
          const [file] = await deps.db
            .select({ kind: schema.media.kind, status: schema.media.status })
            .from(schema.media)
            .where(and(eq(schema.media.id, BigInt(id)), eq(schema.media.ownerId, userId)))
            .limit(1);
          if (file?.kind !== "image" || file.status !== "ready") {
            throw badRequest("UPLOAD_INVALID", "Pick a photo you've uploaded.");
          }
        }

        const [user] = await deps.db
          .update(users)
          .set({
            displayName: body.displayName,
            username: body.username,
            bio: body.bio === undefined ? undefined : body.bio || null,
            pronouns: body.pronouns === undefined ? undefined : body.pronouns || null,
            accentColor: body.accentColor,
            avatarMediaId:
              body.avatarMediaId === undefined
                ? undefined
                : body.avatarMediaId === null
                  ? null
                  : BigInt(body.avatarMediaId),
            bannerMediaId:
              body.bannerMediaId === undefined
                ? undefined
                : body.bannerMediaId === null
                  ? null
                  : BigInt(body.bannerMediaId),
          })
          .where(eq(users.id, userId))
          .returning();
        if (!user) throw notFound("User");

        const self = toSelfUser(user);
        await deps.bus.publish(`user:${userId}`, { type: "USER_UPDATE", data: self });
        return self;
      },
    );

    app.get(
      "/@me/settings",
      { preHandler: requireAuth, schema: { response: { 200: UserSettings } } },
      async (req) => {
        const { userId } = authOf(req);
        const [row] = await deps.db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, userId));
        if (row) return toUserSettings(row);
        const [me] = await deps.db
          .select({ birthDate: users.birthDate })
          .from(users)
          .where(eq(users.id, userId));
        const teen = me && isMinor(me.birthDate) ? TEEN_USER_SETTINGS : {};
        const [created] = await deps.db
          .insert(userSettings)
          .values({ userId, ...teen })
          .returning();
        if (!created) throw notFound("Settings");
        return toUserSettings(created);
      },
    );

    app.patch(
      "/@me/settings",
      {
        preHandler: requireAuth,
        schema: { body: UpdateUserSettings, response: { 200: UserSettings } },
      },
      async (req) => {
        const { userId } = authOf(req);
        const [row] = await deps.db
          .insert(userSettings)
          .values({ userId, ...req.body })
          .onConflictDoUpdate({ target: userSettings.userId, set: req.body })
          .returning();
        if (!row) throw notFound("Settings");
        const settings = toUserSettings(row);
        await deps.bus.publish(`user:${userId}`, { type: "USER_SETTINGS_UPDATE", data: settings });
        return settings;
      },
    );

    app.get(
      "/:username",
      { schema: { params: z.object({ username: Username }), response: { 200: PublicUser } } },
      async (req) => {
        const [user] = await deps.db
          .select()
          .from(users)
          .where(
            sql`lower(${users.username}) = ${req.params.username} and ${users.status} = 'active'`,
          )
          .limit(1);
        if (!user) throw notFound("User");
        return toPublicUser(user);
      },
    );
  };
