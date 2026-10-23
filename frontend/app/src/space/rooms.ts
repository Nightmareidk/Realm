import { type Channel, Permission, type SpaceDetail } from "@realm/contracts";

export interface RoomSection {
  /** null: the rooms that sit in no group (shown first). */
  group: Channel | null;
  rooms: Channel[];
}

const byPlace = (a: Channel, b: Channel) => a.position - b.position || (a.id < b.id ? -1 : 1);

/** A Space's rooms as they show: ungrouped rooms first, then each group with its rooms. */
export function sections(space: SpaceDetail): RoomSection[] {
  const groups = space.channels.filter((c) => c.type === "category").sort(byPlace);
  const known = new Set(groups.map((g) => g.id));
  const rooms = space.channels.filter((c) => c.type !== "category").sort(byPlace);
  return [
    { group: null, rooms: rooms.filter((r) => !r.parentId || !known.has(r.parentId)) },
    ...groups.map((g) => ({ group: g, rooms: rooms.filter((r) => r.parentId === g.id) })),
  ];
}

/** The order the server takes: every room and group top to bottom, each with its group. */
export function flatten(list: RoomSection[]) {
  return list.flatMap((sec) => [
    ...(sec.group ? [{ id: sec.group.id, parentId: null }] : []),
    ...sec.rooms.map((r) => ({ id: r.id, parentId: sec.group?.id ?? null })),
  ]);
}

/** A room or a whole group moved one place up or down, within where it sits. */
export function moved(list: RoomSection[], id: string, by: -1 | 1): RoomSection[] {
  const next = list.map((sec) => ({ ...sec, rooms: [...sec.rooms] }));
  const g = next.findIndex((sec) => sec.group?.id === id);
  if (g > 0) {
    const to = g + by;
    if (to < 1 || to >= next.length) return list;
    [next[g], next[to]] = [next[to] as RoomSection, next[g] as RoomSection];
    return next;
  }
  for (const sec of next) {
    const i = sec.rooms.findIndex((r) => r.id === id);
    if (i < 0) continue;
    const j = i + by;
    if (j < 0 || j >= sec.rooms.length) return list;
    [sec.rooms[i], sec.rooms[j]] = [sec.rooms[j] as Channel, sec.rooms[i] as Channel];
    return next;
  }
  return list;
}

/** Whether a room is kept to some roles, and which. */
export function privacyOf(space: SpaceDetail, room: Channel) {
  const VIEW = Permission.VIEW_CHANNEL;
  const everyone = room.overwrites.find((o) => o.targetType === "role" && o.targetId === space.id);
  const closed = Boolean(everyone && (BigInt(everyone.deny) & VIEW) === VIEW);
  const roleIds = room.overwrites
    .filter(
      (o) =>
        o.targetType === "role" && o.targetId !== space.id && (BigInt(o.allow) & VIEW) === VIEW,
    )
    .map((o) => o.targetId);
  return { private: closed, roleIds };
}

/** "30s", "5 min", "1 h". */
export function slowWords(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60} min`;
  return `${seconds / 3600} h`;
}
