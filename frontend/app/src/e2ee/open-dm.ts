import type { Channel } from "@realm/contracts";
import { E2eeNotice, E2eeRequestError } from "@realm/e2ee";
import { ApiError, api } from "../server";
import { e2ee } from "./index";

/**
 * Opens the chat with someone when you choose to message them: the end-to-end encrypted one when
 * this device and theirs are both set up for it, and the ordinary DM otherwise (the chat screen
 * says which it is). Failures come back as an `ApiError`, in words that can be shown as they are.
 */
export async function openDmWith(userId: string): Promise<{ id: string; secure: boolean }> {
  const client = e2ee.client;
  if (client) {
    try {
      return { id: await client.openDm(userId), secure: true };
    } catch (err) {
      const notSetUp = err instanceof E2eeNotice && err.reason === "they-are-not-set-up";
      if (!notSetUp) {
        if (err instanceof E2eeRequestError) throw new ApiError(err.status, err.code, err.message);
        if (err instanceof E2eeNotice) throw new ApiError(409, "CONFLICT", err.message);
        throw err;
      }
      // They haven't opened a version of Realm with encrypted chats yet: the ordinary DM works.
    }
  }
  const dm = await api<Channel>("/users/@me/channels", { body: { recipientIds: [userId] } });
  return { id: dm.id, secure: false };
}

/** The route params for a chat opened with `openDmWith`. */
export const dmParams = (dm: { id: string; secure: boolean }, title: string) => ({
  id: dm.id,
  title,
  kind: "dm",
  ...(dm.secure ? { secure: "1" } : {}),
});
