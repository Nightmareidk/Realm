import { HelpAnswer, HelpQuestion } from "@realm/contracts";
import { Limits } from "@realm/server-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { authOf, requireAuth } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import { answer, STARTERS } from "./answers";

/**
 * `/help`: "Ask Realm", the small help chat in Settings. TEMPORARY (course project). It answers
 * from the list in answers.ts; questions aren't stored or logged.
 */
export const helpRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/starters",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ suggestions: z.array(z.string()) }) } },
      },
      async () => ({ suggestions: STARTERS }),
    );

    app.post(
      "/ask",
      // Quiet: no request lines for what people ask.
      {
        preHandler: requireAuth,
        logLevel: "warn",
        schema: { body: HelpQuestion, response: { 200: HelpAnswer } },
      },
      async (req) => {
        await enforceLimit(deps, Limits.helpAsk, authOf(req).userId.toString());
        return answer(req.body.question);
      },
    );
  };
