import { z } from "zod";

/**
 * "Ask Realm": the small help chat in Settings. Temporary (for the course project): delete this
 * file, `backend/api/src/modules/help/`, and the Settings pages that use it to take it out.
 */
export const HelpQuestion = z.object({ question: z.string().trim().min(1).max(300) });
export type HelpQuestion = z.infer<typeof HelpQuestion>;

/** Where an answer can take you: a website path and the phone app's screen. */
export const HelpLink = z.object({
  label: z.string().max(60),
  web: z.string().max(200),
  app: z.string().max(200).nullable(),
});
export type HelpLink = z.infer<typeof HelpLink>;

export const HelpAnswer = z
  .object({
    answer: z.string().max(1200),
    link: HelpLink.nullable(),
    /** A few next questions to tap. */
    suggestions: z.array(z.string().max(80)).max(4),
  })
  .meta({ id: "HelpAnswer" });
export type HelpAnswer = z.infer<typeof HelpAnswer>;
