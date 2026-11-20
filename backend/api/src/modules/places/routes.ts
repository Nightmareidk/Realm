import { PlaceAt, PlaceList, PlacePointQuery, PlaceSearchQuery } from "@realm/contracts";
import { Limits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Deps } from "../../deps";
import { AppError } from "../../lib/errors";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import { PlacesBusy, PlacesService } from "./service";

const busy = () =>
  new AppError(503, "SERVICE_UNAVAILABLE", "Place search is busy. Try again in a minute.");

/** `/places`: search for a place to share, and name a point tapped on the map. */
export const placeRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    const places = new PlacesService(deps);

    app.get(
      "/search",
      {
        preHandler: requireAuth,
        schema: { querystring: PlaceSearchQuery, response: { 200: PlaceList } },
      },
      async (req, reply) => {
        await enforceLimit(deps, Limits.placeSearch, authOf(req).userId.toString());
        const { q, lat, lng, cities } = req.query;
        const near = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
        try {
          const items = await places.search(q, { near, cities: cities === "1" });
          reply.header("Cache-Control", "private, max-age=300");
          return { items };
        } catch (err) {
          if (err instanceof PlacesBusy) throw busy();
          throw err;
        }
      },
    );

    app.get(
      "/at",
      {
        preHandler: requireAuth,
        schema: { querystring: PlacePointQuery, response: { 200: PlaceAt } },
      },
      async (req) => {
        await enforceLimit(deps, Limits.placeSearch, authOf(req).userId.toString());
        try {
          return { place: await places.nameOf(req.query.lat, req.query.lng) };
        } catch (err) {
          if (err instanceof PlacesBusy) throw busy();
          throw err;
        }
      },
    );
  };
