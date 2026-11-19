import {
  CreateSoundBody,
  CreateStoryBody,
  Highlight,
  HighlightBody,
  HighlightDetail,
  ListeningFriends,
  MOODS,
  type MoodId,
  MusicHome,
  NowPlayingBody,
  Playlist,
  PlaylistBody,
  PlaylistDetail,
  ReportSongBody,
  Snowflake,
  Sound,
  SoundList,
  SoundSearchQuery,
  Story,
  StoryFeed,
  StoryViewer,
  UpdateHighlightBody,
  UploadSongBody,
  Username,
  WeekRecap,
} from "@realm/contracts";
import { Limits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import { HighlightsService } from "./highlights";
import { MusicLibrary } from "./library";
import type { MusicService } from "./service";
import { ListeningNow, Recap } from "./together";

const Id = z.object({ id: Snowflake });

/** `/sounds`: the free library, creators' own sounds. */
export const soundRoutes =
  (deps: Deps, music: MusicService): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/",
      {
        preHandler: requireAuth,
        schema: { querystring: SoundSearchQuery, response: { 200: SoundList } },
      },
      async (req) => {
        await enforceLimit(deps, Limits.soundSearch, authOf(req).userId.toString());
        return music.search(req.query.q);
      },
    );
    app.get(
      "/trending",
      { preHandler: requireAuth, schema: { response: { 200: SoundList } } },
      async () => ({ items: await music.trending() }),
    );
    app.get(
      "/mine",
      { preHandler: requireAuth, schema: { response: { 200: SoundList } } },
      async (req) => ({ items: await music.mine(authOf(req).userId) }),
    );
    app.post(
      "/",
      { preHandler: requireAuth, schema: { body: CreateSoundBody, response: { 201: Sound } } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.postCreate, userId.toString());
        return reply.status(201).send(await music.create(userId, req.body));
      },
    );
    app.get(
      "/:id",
      { preHandler: requireAuth, schema: { params: Id, response: { 200: Sound } } },
      async (req) => music.get(BigInt(req.params.id)),
    );

    // Your own music: share a whole song, see anyone's songs, take yours down, report one.
    app.post(
      "/songs",
      { preHandler: requireAuth, schema: { body: UploadSongBody, response: { 201: Sound } } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.songUpload, userId.toString());
        return reply.status(201).send(await music.uploadSong(userId, req.body));
      },
    );
    app.get(
      "/by/:username",
      {
        preHandler: requireAuth,
        schema: {
          params: z.object({ username: z.string().min(1).max(40) }),
          response: { 200: SoundList },
        },
      },
      async (req) => ({ items: await music.byCreator(req.params.username, authOf(req).userId) }),
    );
    app.delete("/:id", { preHandler: requireAuth, schema: { params: Id } }, async (req, reply) => {
      await music.removeSong(authOf(req).userId, BigInt(req.params.id));
      return reply.status(204).send();
    });
    app.post(
      "/:id/report",
      { preHandler: requireAuth, schema: { params: Id, body: ReportSongBody } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.songReport, userId.toString());
        await music.reportSong(userId, BigInt(req.params.id), req.body);
        return reply.status(204).send();
      },
    );
  };

/** `/stories`: a day-long photo or video, with music if you like. */
export const storyRoutes =
  (deps: Deps, music: MusicService): FastifyPluginAsyncZod =>
  async (app) => {
    app.post(
      "/",
      { preHandler: requireAuth, schema: { body: CreateStoryBody, response: { 201: Story } } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.storyCreate, userId.toString());
        return reply.status(201).send(await music.createStory(userId, req.body));
      },
    );
    app.get(
      "/feed",
      { preHandler: requireAuth, schema: { response: { 200: StoryFeed } } },
      async (req) => music.feed(authOf(req).userId),
    );
    app.get(
      "/of/:username",
      {
        preHandler: requireAuth,
        schema: {
          params: z.object({ username: Username }),
          response: { 200: z.object({ items: z.array(Story) }) },
        },
      },
      async (req) => ({ items: await music.ofUser(req.params.username, authOf(req).userId) }),
    );
    // Highlights: Stories kept on a profile.
    const highlights = new HighlightsService(deps, music);
    const HighlightId = z.object({ id: Snowflake });
    app.get(
      "/archive",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ items: z.array(Story) }) } },
      },
      async (req) => ({ items: await highlights.archive(authOf(req).userId) }),
    );
    app.get(
      "/highlights/of/:username",
      {
        preHandler: requireAuth,
        schema: {
          params: z.object({ username: Username }),
          response: { 200: z.object({ items: z.array(Highlight) }) },
        },
      },
      async (req) => ({
        items: await highlights.ofUser(req.params.username, authOf(req).userId),
      }),
    );
    app.get(
      "/highlights/:id",
      {
        preHandler: requireAuth,
        schema: { params: HighlightId, response: { 200: HighlightDetail } },
      },
      async (req) => highlights.get(BigInt(req.params.id), authOf(req).userId),
    );
    app.post(
      "/highlights",
      { preHandler: requireAuth, schema: { body: HighlightBody, response: { 201: Highlight } } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.storyCreate, userId.toString());
        return reply.status(201).send(await highlights.create(userId, req.body));
      },
    );
    app.patch(
      "/highlights/:id",
      {
        preHandler: requireAuth,
        schema: { params: HighlightId, body: UpdateHighlightBody, response: { 200: Highlight } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.storyCreate, userId.toString());
        return highlights.update(userId, BigInt(req.params.id), req.body);
      },
    );
    app.delete(
      "/highlights/:id",
      { preHandler: requireAuth, schema: { params: HighlightId } },
      async (req, reply) => {
        await highlights.remove(authOf(req).userId, BigInt(req.params.id));
        return reply.status(204).send();
      },
    );

    app.get(
      "/:id/viewers",
      {
        preHandler: requireAuth,
        schema: { params: Id, response: { 200: z.object({ items: z.array(StoryViewer) }) } },
      },
      async (req) => ({ items: await music.viewers(authOf(req).userId, BigInt(req.params.id)) }),
    );
    app.post(
      "/:id/view",
      { preHandler: requireAuth, schema: { params: Id } },
      async (req, reply) => {
        await music.view(authOf(req).userId, BigInt(req.params.id));
        return reply.status(204).send();
      },
    );
    app.delete("/:id", { preHandler: requireAuth, schema: { params: Id } }, async (req, reply) => {
      await music.remove(authOf(req).userId, BigInt(req.params.id));
      return reply.status(204).send();
    });
  };

/**
 * `/music`: playing songs in Realm like a music app. Your home (recently played, Liked songs,
 * your playlists, popular), liking songs, playlists, and moods to browse.
 */
export const musicRoutes =
  (deps: Deps, music: MusicService): FastifyPluginAsyncZod =>
  async (app) => {
    const library = new MusicLibrary(deps, music);
    const together = new ListeningNow(deps, music);
    const recap = new Recap(deps, music);
    const SoundId = z.object({ soundId: Snowflake });
    const ListId = z.object({ id: Snowflake });
    const Item = ListId.extend({ soundId: Snowflake });
    const limited = async (userId: bigint) =>
      enforceLimit(deps, Limits.dmChange, userId.toString());

    app.get(
      "/home",
      { preHandler: requireAuth, schema: { response: { 200: MusicHome } } },
      async (req) => library.home(authOf(req).userId),
    );
    app.get(
      "/moods/:mood",
      {
        preHandler: requireAuth,
        schema: {
          params: z.object({ mood: z.enum(MOODS.map((m) => m.id) as [MoodId, ...MoodId[]]) }),
          response: { 200: SoundList },
        },
      },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.soundSearch, userId.toString());
        const mood = MOODS.find((m) => m.id === req.params.mood);
        const found = await music.search(mood?.query);
        return { ...found, items: await music.toSounds(await music.rowsOf(found.items), userId) };
      },
    );
    app.get(
      "/liked",
      { preHandler: requireAuth, schema: { response: { 200: SoundList } } },
      async (req) => ({ items: await library.liked(authOf(req).userId) }),
    );
    app.put(
      "/liked/:soundId",
      { preHandler: requireAuth, schema: { params: SoundId } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limited(userId);
        await library.like(userId, BigInt(req.params.soundId), true);
        return reply.status(204).send();
      },
    );
    app.delete(
      "/liked/:soundId",
      { preHandler: requireAuth, schema: { params: SoundId } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limited(userId);
        await library.like(userId, BigInt(req.params.soundId), false);
        return reply.status(204).send();
      },
    );
    app.post(
      "/played/:soundId",
      { preHandler: requireAuth, schema: { params: SoundId } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.listenNow, userId.toString());
        if (await library.played(userId, BigInt(req.params.soundId))) {
          await recap.played(userId, BigInt(req.params.soundId));
        }
        return reply.status(204).send();
      },
    );

    // Listening together: say what's playing, see what friends play, and your week.
    app.put(
      "/now",
      { preHandler: requireAuth, schema: { body: NowPlayingBody } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.listenNow, userId.toString());
        await together.set(userId, BigInt(req.body.soundId), req.body.positionMs);
        return reply.status(204).send();
      },
    );
    app.delete("/now", { preHandler: requireAuth }, async (req, reply) => {
      await together.clear(authOf(req).userId);
      return reply.status(204).send();
    });
    app.get(
      "/friends",
      { preHandler: requireAuth, schema: { response: { 200: ListeningFriends } } },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.listenNow, userId.toString());
        return { items: await together.friends(userId) };
      },
    );
    app.get(
      "/recap",
      { preHandler: requireAuth, schema: { response: { 200: WeekRecap } } },
      async (req) => {
        const { userId } = authOf(req);
        await enforceLimit(deps, Limits.soundSearch, userId.toString());
        return recap.week(userId);
      },
    );

    app.get(
      "/playlists",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ items: z.array(Playlist) }) } },
      },
      async (req) => ({ items: await library.mine(authOf(req).userId) }),
    );
    app.post(
      "/playlists",
      { preHandler: requireAuth, schema: { body: PlaylistBody, response: { 201: Playlist } } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limited(userId);
        return reply.status(201).send(await library.create(userId, req.body));
      },
    );
    app.get(
      "/playlists/:id",
      { preHandler: requireAuth, schema: { params: ListId, response: { 200: PlaylistDetail } } },
      async (req) => library.detail(authOf(req).userId, BigInt(req.params.id)),
    );
    app.patch(
      "/playlists/:id",
      {
        preHandler: requireAuth,
        schema: { params: ListId, body: PlaylistBody.partial(), response: { 200: PlaylistDetail } },
      },
      async (req) => {
        const { userId } = authOf(req);
        await limited(userId);
        return library.update(userId, BigInt(req.params.id), req.body);
      },
    );
    app.delete(
      "/playlists/:id",
      { preHandler: requireAuth, schema: { params: ListId } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limited(userId);
        await library.remove(userId, BigInt(req.params.id));
        return reply.status(204).send();
      },
    );
    app.put(
      "/playlists/:id/items/:soundId",
      { preHandler: requireAuth, schema: { params: Item } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limited(userId);
        await library.add(userId, BigInt(req.params.id), BigInt(req.params.soundId));
        return reply.status(204).send();
      },
    );
    app.delete(
      "/playlists/:id/items/:soundId",
      { preHandler: requireAuth, schema: { params: Item } },
      async (req, reply) => {
        const { userId } = authOf(req);
        await limited(userId);
        await library.take(userId, BigInt(req.params.id), BigInt(req.params.soundId));
        return reply.status(204).send();
      },
    );
  };
