import { z } from "zod";
import { Limits } from "../limits";

/**
 * What travels INSIDE an encrypted message (docs/E2EE.md §7.3): the server never sees any of
 * this. A device that decrypts a message checks it against this shape before using it, because
 * the other side of a chat is not trusted to send well-formed data.
 */

/** A message's id inside its chat, made up by the sending device (128 random bits, hex). */
export const ChatMessageId = z.string().regex(/^[0-9a-f]{32}$/, "Invalid message id");

const Emoji = z.string().min(1).max(32);

export const ChatEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    id: ChatMessageId,
    text: z.string().min(1).max(Limits.message.max),
    replyTo: ChatMessageId.optional(),
  }),
  /** Only the person who wrote a message may edit or delete it; receivers check the sender. */
  z.object({
    type: z.literal("edit"),
    target: ChatMessageId,
    text: z.string().min(1).max(Limits.message.max),
  }),
  z.object({ type: z.literal("delete"), target: ChatMessageId }),
  z.object({
    type: z.literal("reaction"),
    target: ChatMessageId,
    emoji: Emoji,
    remove: z.boolean().optional(),
  }),
  /** "I've read up to here." */
  z.object({ type: z.literal("seen"), upTo: ChatMessageId }),
]);
export type ChatEvent = z.infer<typeof ChatEvent>;
