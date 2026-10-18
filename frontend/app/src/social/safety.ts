import type { UserSummary } from "@realm/contracts";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { postsChanged } from "../data";
import { ApiError, api } from "../server";
import { useSheet } from "../sheet";

/** What can be reported from the app, and what each is called in a sentence. */
export type ReportKind = "post" | "comment" | "message" | "user";
export const KIND_NAME: Record<ReportKind, string> = {
  post: "post",
  comment: "comment",
  message: "message",
  user: "account",
};

/** The tools everyone has against someone else: report what they posted, or block them. */
export function useSafety() {
  const router = useRouter();
  const sheet = useSheet();
  return useMemo(
    () => ({
      /** Opens the report screen for a post, comment, message or account by `author`. */
      report(kind: ReportKind, id: string, author: UserSummary) {
        router.push({
          pathname: "/report",
          params: {
            kind,
            id,
            userId: author.id,
            username: author.username,
            name: author.displayName,
          },
        });
      },

      /** Asks first, then blocks. `done` runs once it's done (to leave their profile, say). */
      block(user: UserSummary, done?: () => void) {
        sheet({
          title: `Block ${user.displayName}?`,
          line: "They won't find your profile, see your posts or Clips, or be able to message you, and you'll stop following each other. They aren't told. You can unblock them in Settings.",
          actions: [
            {
              label: `Block @${user.username}`,
              icon: "Prohibit",
              danger: true,
              onPress: async () => {
                try {
                  await api(`/users/@me/blocks/${user.id}`, { method: "PUT" });
                  postsChanged();
                  done?.();
                } catch (err) {
                  sheet({
                    title: "Not blocked",
                    line:
                      err instanceof ApiError ? err.message : "Something went wrong. Try again.",
                    actions: [],
                  });
                }
              },
            },
          ],
        });
      },
    }),
    [router, sheet],
  );
}
