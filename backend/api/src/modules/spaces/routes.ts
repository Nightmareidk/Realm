import {
  AckBody,
  Channel,
  Community,
  CreateCommunityBody,
  CreateInviteBody,
  CreateMessageBody,
  CreateRoomBody,
  DiscoverQuery,
  DiscoverSpace,
  Invite,
  MemberList,
  Message,
  MessagePage,
  MessagesQuery,
  OpenedPhoto,
  ReadState,
  Snowflake,
  SpaceDetail,
  UpdateCommunityBody,
  UpdateMessageBody,
  UpdateRoomBody,
  VoiceJoin,
} from "@realm/contracts";
import { Limits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { badRequest } from "../../lib/errors";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import { InvitesService } from "./invites";
import { MessagesService } from "./messages";
import { SpacesService } from "./service";

const SpaceParams = z.object({ space: z.string().min(1).max(40) });
const ChannelParams = z.object({ channelId: Snowflake });
const MessageParams = ChannelParams.extend({ messageId: Snowflake });
const ReactionParams = MessageParams.extend({ emoji: z.string().min(1).max(64) });
const InviteParams = z.object({ code: z.string().regex(/^[A-Za-z0-9]{4,32}$/) });

export interface SpacesModule {
  deps: Deps;
  spaces: SpacesService;
  invites: InvitesService;
  messages: MessagesService;
}

export function spacesModule(deps: Deps): SpacesModule {
  const spaces = new SpacesService(deps);
  return {
    deps,
    spaces,
    invites: new InvitesService(deps, spaces),
    messages: new MessagesService(deps),
  };
}

/** `/communities`: Spaces, their members, rooms and invites. */
export const communityRoutes =
  (deps: Deps, m: SpacesModule): FastifyPluginAsyncZod =>
  async (app) => {
    app.post(
      "/",
      {
        preHandler: requireAuth,
        schema: { body: CreateCommunityBody, response: { 201: SpaceDetail } },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.spaceCreate, userId.toString());
        return reply.status(201).send(await m.spaces.create(userId, req.body));
      },
    );

    app.get(
      "/:space",
      { preHandler: requireAuth, schema: { params: SpaceParams, response: { 200: SpaceDetail } } },
      async (req) => m.spaces.detailBySlug(req.params.space, authOf(req).userId),
    );

    app.patch(
      "/:space",
      {
        preHandler: requireAuth,
        schema: { params: SpaceParams, body: UpdateCommunityBody, response: { 200: Community } },
      },
      async (req) => m.spaces.update(req.params.space, authOf(req).userId, req.body),
    );

    app.delete(
      "/:space",
      { preHandler: requireAuth, schema: { params: SpaceParams } },
      async (req, reply) => {
        await m.spaces.remove(req.params.space, authOf(req).userId);
        return reply.status(204).send();
      },
    );

    app.post(
      "/:space/join",
      { preHandler: requireAuth, schema: { params: SpaceParams, response: { 200: SpaceDetail } } },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.inviteAccept, userId.toString());
        return m.spaces.joinOpen(req.params.space, userId);
      },
    );

    app.delete(
      "/:space/members/@me",
      { preHandler: requireAuth, schema: { params: SpaceParams } },
      async (req, reply) => {
        await m.spaces.leave(req.params.space, authOf(req).userId);
        return reply.status(204).send();
      },
    );

    app.get(
      "/:space/members",
      { preHandler: requireAuth, schema: { params: SpaceParams, response: { 200: MemberList } } },
      async (req) => m.spaces.members(req.params.space, authOf(req).userId),
    );

    app.post(
      "/:space/channels",
      {
        preHandler: requireAuth,
        schema: { params: SpaceParams, body: CreateRoomBody, response: { 201: Channel } },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.roomCreate, userId.toString());
        return reply
          .status(201)
          .send(await m.spaces.createRoom(req.params.space, userId, req.body));
      },
    );

    app.post(
      "/:space/invites",
      {
        preHandler: requireAuth,
        schema: { params: SpaceParams, body: CreateInviteBody, response: { 201: Invite } },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.inviteCreate, userId.toString());
        return reply.status(201).send(await m.invites.create(req.params.space, userId, req.body));
      },
    );

    app.get(
      "/:space/invites",
      {
        preHandler: requireAuth,
        schema: { params: SpaceParams, response: { 200: z.object({ invites: z.array(Invite) }) } },
      },
      async (req) => ({ invites: await m.invites.list(req.params.space, authOf(req).userId) }),
    );
  };

/** `/channels`: rooms and their messages. */
export const channelRoutes =
  (deps: Deps, m: SpacesModule): FastifyPluginAsyncZod =>
  async (app) => {
    app.patch(
      "/:channelId",
      {
        preHandler: requireAuth,
        schema: { params: ChannelParams, body: UpdateRoomBody, response: { 200: Channel } },
      },
      async (req) =>
        m.spaces.updateRoom(BigInt(req.params.channelId), authOf(req).userId, req.body),
    );

    app.delete(
      "/:channelId",
      { preHandler: requireAuth, schema: { params: ChannelParams } },
      async (req, reply) => {
        await m.spaces.removeRoom(BigInt(req.params.channelId), authOf(req).userId);
        return reply.status(204).send();
      },
    );

    app.get(
      "/:channelId/messages",
      {
        preHandler: requireAuth,
        schema: {
          params: ChannelParams,
          querystring: MessagesQuery,
          response: { 200: MessagePage },
        },
      },
      async (req) => m.messages.list(BigInt(req.params.channelId), authOf(req).userId, req.query),
    );

    app.post(
      "/:channelId/messages",
      {
        preHandler: requireAuth,
        schema: { params: ChannelParams, body: CreateMessageBody, response: { 201: Message } },
      },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.messageSend, userId.toString());
        return reply
          .status(201)
          .send(await m.messages.create(BigInt(req.params.channelId), userId, req.body));
      },
    );

    app.patch(
      "/:channelId/messages/:messageId",
      {
        preHandler: requireAuth,
        schema: { params: MessageParams, body: UpdateMessageBody, response: { 200: Message } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.messageEdit, userId.toString());
        return m.messages.edit(
          BigInt(req.params.channelId),
          BigInt(req.params.messageId),
          userId,
          req.body.content,
        );
      },
    );

    app.delete(
      "/:channelId/messages/:messageId",
      { preHandler: requireAuth, schema: { params: MessageParams } },
      async (req, reply) => {
        await m.messages.remove(
          BigInt(req.params.channelId),
          BigInt(req.params.messageId),
          authOf(req).userId,
        );
        return reply.status(204).send();
      },
    );

    // "Delete for you": gone from your view of the chat only.
    app.post(
      "/:channelId/messages/:messageId/hide",
      { preHandler: requireAuth, schema: { params: MessageParams } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.messageEdit, userId.toString());
        await m.messages.hide(BigInt(req.params.channelId), BigInt(req.params.messageId), userId);
        return reply.status(204).send();
      },
    );

    // Open a view-once photo (counts a view; short links to its photos).
    app.post(
      "/:channelId/messages/:messageId/open",
      {
        preHandler: requireAuth,
        schema: { params: MessageParams, response: { 200: OpenedPhoto } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.messageEdit, userId.toString());
        return m.messages.open(BigInt(req.params.channelId), BigInt(req.params.messageId), userId);
      },
    );

    app.post(
      "/:channelId/voice",
      { preHandler: requireAuth, schema: { params: ChannelParams, response: { 200: VoiceJoin } } },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.voiceJoin, userId.toString());
        return m.spaces.voiceJoin(BigInt(req.params.channelId), userId);
      },
    );

    // Your reaction on a message: any one emoji.
    for (const on of [true, false]) {
      const route = {
        preHandler: requireAuth,
        schema: { params: ReactionParams },
      };
      const handler = async (
        req: { params: z.infer<typeof ReactionParams> } & Parameters<typeof authOf>[0],
        reply: { status: (n: number) => { send: () => unknown } },
      ) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.react, userId.toString());
        await m.messages.react(
          BigInt(req.params.channelId),
          BigInt(req.params.messageId),
          userId,
          req.params.emoji,
          on,
        );
        return reply.status(204).send();
      };
      if (on) app.put("/:channelId/messages/:messageId/reactions/:emoji/@me", route, handler);
      else app.delete("/:channelId/messages/:messageId/reactions/:emoji/@me", route, handler);
    }

    app.get(
      "/:channelId/pins",
      {
        preHandler: requireAuth,
        schema: {
          params: ChannelParams,
          response: { 200: z.object({ messages: z.array(Message) }) },
        },
      },
      async (req) => ({
        messages: await m.messages.pins(BigInt(req.params.channelId), authOf(req).userId),
      }),
    );

    for (const on of [true, false]) {
      const route = {
        preHandler: requireAuth,
        schema: { params: MessageParams, response: { 200: Message } },
      };
      const handler = async (
        req: { params: z.infer<typeof MessageParams> } & Parameters<typeof authOf>[0],
      ) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.messageEdit, userId.toString());
        return m.messages.pin(
          BigInt(req.params.channelId),
          BigInt(req.params.messageId),
          userId,
          on,
        );
      };
      if (on) app.put("/:channelId/pins/:messageId", route, handler);
      else app.delete("/:channelId/pins/:messageId", route, handler);
    }

    app.post(
      "/:channelId/ack",
      {
        preHandler: requireAuth,
        schema: { params: ChannelParams, body: AckBody, response: { 200: ReadState } },
      },
      async (req) =>
        m.messages.ack(
          BigInt(req.params.channelId),
          authOf(req).userId,
          BigInt(req.body.messageId),
        ),
    );
  };

/** `/invites/:code`: the preview anyone can see, accepting, and turning one off. */
export const inviteRoutes =
  (deps: Deps, m: SpacesModule): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/:code",
      { schema: { params: InviteParams, response: { 200: Invite } } },
      async (req) => {
        await enforceLimit(deps, Limits.invitePreview, req.ip);
        return m.invites.preview(req.params.code);
      },
    );

    app.post(
      "/:code",
      { preHandler: requireAuth, schema: { params: InviteParams, response: { 200: SpaceDetail } } },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.inviteAccept, userId.toString());
        return m.invites.accept(req.params.code, userId);
      },
    );

    app.delete(
      "/:code",
      { preHandler: requireAuth, schema: { params: InviteParams } },
      async (req, reply) => {
        await m.invites.revoke(req.params.code, authOf(req).userId);
        return reply.status(204).send();
      },
    );
  };

/** `/discover/communities`: public Spaces for Explore. */
export const discoverRoutes =
  (_deps: Deps, m: SpacesModule): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/communities",
      {
        schema: {
          querystring: DiscoverQuery,
          response: { 200: z.object({ spaces: z.array(DiscoverSpace) }) },
        },
      },
      async (req) => {
        if (req.query.sort === "nearby") {
          throw badRequest("VALIDATION_FAILED", "Send nearby searches to POST /discover/nearby.");
        }
        return { spaces: await m.spaces.discover(req.auth?.userId ?? null, req.query) };
      },
    );

    // Nearby: the point to measure from goes in the body, so it never appears in a URL or a
    // request log ("Realm doesn't keep it").
    app.post(
      "/nearby",
      {
        schema: {
          body: z.object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
            limit: z.number().int().min(1).max(50).default(30),
          }),
          response: { 200: z.object({ spaces: z.array(DiscoverSpace) }) },
        },
      },
      async (req) => ({
        spaces: await m.spaces.discover(req.auth?.userId ?? null, {
          sort: "nearby",
          limit: req.body.limit,
          lat: Math.round(req.body.lat * 100) / 100,
          lng: Math.round(req.body.lng * 100) / 100,
        }),
      }),
    );

    // What's set up on this Realm, so the app never offers a feature that can't work.
    app.get(
      "/capabilities",
      { schema: { response: { 200: z.object({ voice: z.boolean(), push: z.boolean() }) } } },
      async () => ({ voice: Boolean(m.deps.livekit), push: m.deps.pusher.enabled }),
    );
  };

/** `/users/@me/...` pieces that belong to Spaces. */
export const meSpaceRoutes =
  (_deps: Deps, m: SpacesModule): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/@me/communities",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ spaces: z.array(SpaceDetail) }) } },
      },
      async (req) => ({ spaces: await m.spaces.listMine(authOf(req).userId) }),
    );

    app.get(
      "/@me/read-states",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ readStates: z.array(ReadState) }) } },
      },
      async (req) => ({ readStates: await m.messages.readStates(authOf(req).userId) }),
    );
  };
