import type { Channel } from "@realm/contracts";
import { type Conversation, Limits, type Member, type SpaceDetail } from "@realm/contracts";
import { conversationTitle } from "@/features/realtime/store";
import { Permission, roomCan, spaceCan } from "@/features/spaces/permissions";
import { MAPS_ON } from "@/lib/public-config";

/**
 * Where a chat happens, as the chat itself needs it: who you are, what people are called here,
 * what you may do, and what to call the place. One chat, used by a Space's rooms and by DMs and
 * group chats alike.
 */
export interface ChatScope {
  kind: "room" | "conversation";
  /** The room's Space (for reports, timeouts and the room's start); null in a conversation. */
  space: SpaceDetail | null;
  conversation: Conversation | null;
  meId: string;
  /** Person ID → the name to show (a Space nickname, or their display name). */
  names: Map<string, string>;
  /** "#general" or "Kenji": for the composer's placeholder and the message list's label. */
  label: string;
  canSend: boolean;
  /** Delete other people's messages and see what's hidden after reports. */
  canManage: boolean;
  canAttach: boolean;
  canPlace: boolean;
  canReact: boolean;
  canPin: boolean;
  canInvite: boolean;
  /** Why you can't post, when you can't. */
  cantSend: string;
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function roomScope(
  space: SpaceDetail,
  room: Channel,
  members: Member[] | undefined,
  teen: boolean,
): ChatScope {
  const timedOut = space.self.timeoutUntil && Date.parse(space.self.timeoutUntil) > Date.now();
  return {
    kind: "room",
    space,
    conversation: null,
    meId: space.self.user.id,
    names: new Map((members ?? []).map((m) => [m.user.id, m.nickname ?? m.user.displayName])),
    label: `#${room.name}`,
    canSend: roomCan(space, room, Permission.SEND_MESSAGES),
    canManage: roomCan(space, room, Permission.MANAGE_MESSAGES),
    canAttach: roomCan(space, room, Permission.ATTACH_FILES),
    // Under 18: places only in smaller Spaces (their own crowd).
    canPlace: MAPS_ON && !(teen && space.memberCount > Limits.teenPresenceSpaceSize),
    canReact: roomCan(space, room, Permission.ADD_REACTIONS),
    canPin: roomCan(space, room, Permission.PIN_MESSAGES),
    canInvite: spaceCan(space, Permission.CREATE_INVITES),
    cantSend:
      timedOut && space.self.timeoutUntil
        ? `You're timed out in ${space.name} until ${timeFormat.format(new Date(space.self.timeoutUntil))}. You can still read.`
        : "You can read this room, but not post in it.",
  };
}

export function conversationScope(
  c: Conversation,
  meId: string,
  blockedIds: readonly string[],
): ChatScope {
  // In a one-to-one DM, a block either way stops new messages (the server says so too).
  const blocked = c.type === "dm" && c.recipients.some((r) => blockedIds.includes(r.id));
  return {
    kind: "conversation",
    space: null,
    conversation: c,
    meId,
    names: new Map(c.recipients.map((r) => [r.id, r.displayName])),
    label: conversationTitle(c),
    canSend: !blocked,
    canManage: false,
    canAttach: !blocked,
    canPlace: MAPS_ON && !blocked,
    canReact: !blocked,
    canPin: true,
    canInvite: false,
    cantSend: blocked
      ? "You blocked this person. Unblock them in Privacy and safety to message them again."
      : "You can't send messages here.",
  };
}
