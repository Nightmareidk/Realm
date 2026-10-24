"use client";

import {
  CaretDown,
  CaretUp,
  CheckCircle,
  Hash,
  Lock,
  Plus,
  Sparkle,
  SpeakerHigh,
  Trash,
} from "@phosphor-icons/react";
import {
  type AutoModRules,
  type Channel,
  GLOW_LEVELS,
  Permission,
  SLOWMODE_CHOICES,
  type SpaceDetail,
  type SparkStatus,
} from "@realm/contracts";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { FormNotice } from "@/components/form";
import { pill } from "@/components/pill";
import { useFetch } from "@/features/social/shared";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { spaceCan } from "./permissions";

const field =
  "h-11 w-full rounded-input border-[1.5px] border-line-strong bg-base/70 px-3.5 text-fg outline-none placeholder:text-fg-muted focus-visible:border-accent";

/** "30s", "5 min", "1 h". */
const slowWords = (n: number) => (n < 60 ? `${n}s` : n < 3600 ? `${n / 60} min` : `${n / 3600} h`);

// ── Glow ─────────────────────────────────────────────────────────────────────

/** Glow: the Sparks members gave the Space, what each level unlocks, and who's lighting it up. */
export function GlowTab({ space }: { space: SpaceDetail }) {
  const status = useFetch<SparkStatus>(`/communities/${space.id}/sparks`);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const d = status.data;
  const give = async () => {
    setBusy(true);
    setNotice("");
    try {
      status.setData(await api<SparkStatus>(`/communities/${space.id}/sparks`, { body: {} }));
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "No Spark given. Try again.");
    } finally {
      setBusy(false);
    }
  };
  if (!d)
    return (
      <p role="status" className="text-fg-soft">
        Loading Glow…
      </p>
    );
  const next = GLOW_LEVELS.find((g) => g.level === d.level + 1);
  const progress = next ? Math.min(1, d.count / next.sparks) : 1;
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,var(--r-light-1),var(--r-accent),var(--r-light-2))] p-6 text-center text-[#0b0b0e]">
        <Sparkle aria-hidden="true" size={34} weight="fill" className="mx-auto" />
        <p className="mt-1 font-display text-[1.8rem] font-extrabold">
          {d.level ? `Glow ${d.level}` : "No Glow yet"}
        </p>
        <p className="font-bold">
          {d.count} {d.count === 1 ? "Spark" : "Sparks"}
          {next ? ` · ${d.toNext} more for ${next.name}` : " · the brightest it gets"}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgb(0_0_0/0.2)]">
          <div
            className="h-full rounded-full bg-[#0b0b0e]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
      <FormNotice>{notice}</FormNotice>
      <button
        type="button"
        onClick={() => void give()}
        aria-disabled={busy || undefined}
        className={pill("action", "md", "w-full")}
      >
        {busy
          ? "Giving…"
          : d.mine
            ? `Give another Spark (${d.mine} given)`
            : "Give this Space a Spark"}
      </button>
      <p className="text-center text-[0.88rem] text-fg-soft">
        {d.testing
          ? "Sparks are free to try while Realm is being built. Each lasts 30 days; you can give a Space up to two."
          : "Each Spark lasts a month. You can give a Space up to two."}
      </p>
      <ul className="space-y-2.5">
        {GLOW_LEVELS.map((g) => (
          <li
            key={g.level}
            className={cx(
              "rounded-[18px] bg-fg/[0.04] p-4 shadow-[inset_0_0_0_1.5px_var(--r-border)]",
              d.level >= g.level && "shadow-[inset_0_0_0_1.5px_var(--r-accent)]",
            )}
          >
            <p className="flex items-center justify-between font-bold text-fg">
              {g.name}
              <span className="text-[0.85rem] text-fg-soft">
                {d.level >= g.level ? "Unlocked" : `${g.sparks} Sparks`}
              </span>
            </p>
            <ul className="mt-2 space-y-1.5">
              {g.perks.map((p) => {
                const soon = "soon" in p && p.soon;
                const on = d.level >= g.level && !soon;
                return (
                  <li
                    key={p.text}
                    className={cx(
                      "flex items-center gap-2 text-[0.92rem]",
                      soon ? "text-fg-soft" : "text-fg",
                    )}
                  >
                    {on ? (
                      <CheckCircle
                        aria-hidden="true"
                        size={17}
                        weight="fill"
                        className="text-accent"
                      />
                    ) : (
                      <Sparkle aria-hidden="true" size={17} className="text-fg-soft" />
                    )}
                    <span className="flex-1">{p.text}</span>
                    {soon && (
                      <span className="rounded-full px-2 py-0.5 text-[0.75rem] font-bold shadow-[inset_0_0_0_1px_var(--r-border)]">
                        Soon
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {d.backers.length > 0 && (
        <p className="text-[0.92rem] text-fg-soft">
          <b className="text-fg">Lighting it up:</b>{" "}
          {d.backers.map((b) => b.displayName).join(", ")}
        </p>
      )}
    </div>
  );
}

// ── AutoMod ──────────────────────────────────────────────────────────────────

/** AutoMod: stops messages before anyone sees them. Moderators are never held back. */
export function AutoModTab({ space }: { space: SpaceDetail }) {
  const current = useFetch<AutoModRules>(`/communities/${space.id}/automod`);
  const [rules, setRules] = useState<AutoModRules | null>(null);
  const [words, setWords] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  useEffect(() => {
    if (current.data) {
      setRules(current.data);
      setWords(current.data.words.join(", "));
    }
  }, [current.data]);
  if (!rules)
    return (
      <p role="status" className="text-fg-soft">
        Loading AutoMod…
      </p>
    );
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    try {
      const list = words
        .split(/[,\n]/)
        .map((w) => w.trim())
        .filter(Boolean)
        .slice(0, 200);
      setRules(
        await api<AutoModRules>(`/communities/${space.id}/automod`, {
          method: "PUT",
          body: { ...rules, words: list },
        }),
      );
      setNotice({ tone: "success", text: "AutoMod saved. It's in the activity log." });
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Not saved. Try again.",
      });
    }
  };
  const steps = (key: "minAccountDays" | "minMemberMinutes", unit: string, choices: number[]) => (
    <div className="flex flex-wrap gap-1.5">
      {choices.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={rules[key] === n}
          onClick={() => setRules({ ...rules, [key]: n })}
          className={cx(
            "h-9 rounded-full px-3.5 text-[0.88rem] font-bold",
            rules[key] === n ? "bg-fg text-base" : "bg-fg/8 text-fg",
          )}
        >
          {n ? `${n} ${unit}` : "Off"}
        </button>
      ))}
    </div>
  );
  return (
    <form onSubmit={save} className="space-y-5">
      <p className="text-fg-soft">
        AutoMod stops messages before anyone sees them. Moderators are never held back.
      </p>
      <label className="block">
        <span className="mb-1.5 block font-bold text-fg">Blocked words</span>
        <textarea
          value={words}
          onChange={(e) => setWords(e.target.value)}
          rows={3}
          placeholder="Words or phrases, separated by commas"
          className="w-full resize-none rounded-input border-[1.5px] border-line-strong bg-base/70 px-3.5 py-2.5 text-fg outline-none focus-visible:border-accent"
        />
      </label>
      {(
        [
          ["blockLinks", "Block links", "No web links in messages"],
          ["blockInvites", "Block invites", "No invites to other Spaces or servers"],
        ] as const
      ).map(([key, title, line]) => (
        <label key={key} className="flex items-center gap-3 border-t border-line pt-4">
          <span className="flex-1">
            <span className="block font-bold text-fg">{title}</span>
            <span className="block text-[0.9rem] text-fg-soft">{line}</span>
          </span>
          <input
            type="checkbox"
            checked={rules[key]}
            onChange={(e) => setRules({ ...rules, [key]: e.target.checked })}
            className="size-5 accent-[var(--r-accent)]"
          />
        </label>
      ))}
      <div className="border-t border-line pt-4">
        <p className="mb-2 font-bold text-fg">Brand-new accounts wait</p>
        {steps("minAccountDays", "days", [0, 1, 3, 7])}
      </div>
      <div className="border-t border-line pt-4">
        <p className="mb-2 font-bold text-fg">New members wait</p>
        {steps("minMemberMinutes", "min", [0, 5, 10, 30])}
      </div>
      {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
      <button type="submit" className={pill("action", "md")}>
        Save AutoMod
      </button>
    </form>
  );
}

// ── Rooms ────────────────────────────────────────────────────────────────────

const VIEW = Permission.VIEW_CHANNEL;
const privacyOf = (space: SpaceDetail, room: Channel) => {
  const everyone = room.overwrites.find((o) => o.targetType === "role" && o.targetId === space.id);
  return {
    private: Boolean(everyone && (BigInt(everyone.deny) & VIEW) === VIEW),
    roleIds: room.overwrites
      .filter(
        (o) =>
          o.targetType === "role" && o.targetId !== space.id && (BigInt(o.allow) & VIEW) === VIEW,
      )
      .map((o) => o.targetId),
  };
};

/** One room's settings: name, what it's for, its group, slow mode, and who can see it. */
function RoomEditor({
  space,
  room,
  onDone,
}: {
  space: SpaceDetail;
  room: Channel;
  onDone: () => void;
}) {
  const group = room.type === "category";
  const before = privacyOf(space, room);
  const [name, setName] = useState(room.name ?? "");
  const [topic, setTopic] = useState(room.topic ?? "");
  const [parentId, setParentId] = useState<string | null>(room.parentId);
  const [slow, setSlow] = useState<number>(room.slowmodeSeconds);
  const [closed, setClosed] = useState(before.private);
  const [roleIds, setRoleIds] = useState<string[]>(before.roleIds);
  const [error, setError] = useState("");
  const canPrivacy = spaceCan(space, Permission.MANAGE_ROLES);
  const groups = space.channels.filter((c) => c.type === "category");
  const roles = space.roles
    .filter((r) => r.id !== space.id)
    .sort((a, b) => b.position - a.position);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (closed && canPrivacy && !roleIds.length)
      return setError("Pick at least one role, or turn private off.");
    const changedPrivacy =
      canPrivacy &&
      (closed !== before.private ||
        [...roleIds].sort().join() !== [...before.roleIds].sort().join());
    try {
      await api(`/channels/${room.id}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          ...(group
            ? {}
            : {
                topic: topic.trim() || null,
                parentId,
                ...(room.type === "text" ? { slowmodeSeconds: slow } : {}),
                ...(changedPrivacy
                  ? { privacy: { private: closed, roleIds: closed ? roleIds : [] } }
                  : {}),
              }),
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not saved. Try again.");
    }
  };
  return (
    <form
      onSubmit={save}
      className="mt-2 space-y-3 rounded-[18px] bg-fg/[0.04] p-4 shadow-[inset_0_0_0_1px_var(--r-border)]"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        aria-label="Name"
        className={field}
      />
      {!group && (
        <>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={300}
            placeholder="What it's for (optional)"
            aria-label="What it's for"
            className={field}
          />
          {groups.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-[0.9rem] font-bold text-fg">Group</span>
              <select
                value={parentId ?? ""}
                onChange={(e) => setParentId(e.target.value || null)}
                className={field}
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {room.type === "text" && (
            <div>
              <p className="mb-1.5 text-[0.9rem] font-bold text-fg">Slow mode</p>
              <div className="flex flex-wrap gap-1.5">
                {SLOWMODE_CHOICES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={slow === n}
                    onClick={() => setSlow(n)}
                    className={cx(
                      "h-8 rounded-full px-3 text-[0.85rem] font-bold",
                      slow === n ? "bg-fg text-base" : "bg-fg/8 text-fg",
                    )}
                  >
                    {n ? slowWords(n) : "Off"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {canPrivacy && (
            <div>
              <label className="flex items-center gap-2.5 font-bold text-fg">
                <input
                  type="checkbox"
                  checked={closed}
                  onChange={(e) => setClosed(e.target.checked)}
                  className="size-4 accent-[var(--r-accent)]"
                />
                Private: only some roles can see it
              </label>
              {closed && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {roles.map((r) => {
                    const on = roleIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setRoleIds((ids) => (on ? ids.filter((x) => x !== r.id) : [...ids, r.id]))
                        }
                        className={cx(
                          "h-8 rounded-full px-3 text-[0.85rem] font-bold",
                          on ? "bg-fg text-base" : "bg-fg/8 text-fg",
                        )}
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {error && <p className="text-[0.9rem] text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className={pill("action", "sm")}>
          Save
        </button>
        <button type="button" onClick={onDone} className={pill("quiet", "sm")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Rooms: every room and group in order, to rename, sort, group, slow down, make private or
 * delete, and add new ones. Changes reach everyone in the Space live.
 */
export function RoomsTab({ space }: { space: SpaceDetail }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<"text" | "voice" | "category" | null>(null);
  const [newName, setNewName] = useState("");
  const [notice, setNotice] = useState("");
  const byPlace = (a: Channel, b: Channel) => a.position - b.position;
  const groups = space.channels.filter((c) => c.type === "category").sort(byPlace);
  const known = new Set(groups.map((g) => g.id));
  const rooms = space.channels.filter((c) => c.type !== "category").sort(byPlace);
  const sections = [
    {
      group: null as Channel | null,
      rooms: rooms.filter((r) => !r.parentId || !known.has(r.parentId)),
    },
    ...groups.map((g) => ({
      group: g as Channel | null,
      rooms: rooms.filter((r) => r.parentId === g.id),
    })),
  ];
  const flatten = (list: typeof sections) =>
    list.flatMap((sec) => [
      ...(sec.group ? [{ id: sec.group.id, parentId: null }] : []),
      ...sec.rooms.map((r) => ({ id: r.id, parentId: sec.group?.id ?? null })),
    ]);
  const run = useCallback(async (what: () => Promise<unknown>) => {
    setNotice("");
    try {
      await what();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  }, []);
  const move = (id: string, by: -1 | 1) => {
    const next = sections.map((sec) => ({ ...sec, rooms: [...sec.rooms] }));
    const g = next.findIndex((sec) => sec.group?.id === id);
    if (g > 0) {
      const to = g + by;
      if (to < 1 || to >= next.length) return;
      [next[g], next[to]] = [next[to] as (typeof next)[number], next[g] as (typeof next)[number]];
    } else {
      for (const sec of next) {
        const i = sec.rooms.findIndex((r) => r.id === id);
        if (i < 0) continue;
        const j = i + by;
        if (j < 0 || j >= sec.rooms.length) return;
        [sec.rooms[i], sec.rooms[j]] = [sec.rooms[j] as Channel, sec.rooms[i] as Channel];
      }
    }
    void run(() =>
      api(`/communities/${space.id}/channels/order`, {
        method: "PUT",
        body: { items: flatten(next) },
      }),
    );
  };
  const remove = (c: Channel) => {
    const ok = confirm(
      c.type === "category"
        ? `Delete the group "${c.name}"? Its rooms stay.`
        : `Delete #${c.name}? Its messages go with it.`,
    );
    if (ok) void run(() => api(`/channels/${c.id}`, { method: "DELETE" }));
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!adding || !newName.trim()) return;
    void run(async () => {
      await api(`/communities/${space.id}/channels`, {
        body: { name: newName.trim(), type: adding },
      });
      setNewName("");
      setAdding(null);
    });
  };

  const row = (c: Channel) => {
    const closed = c.type !== "category" && privacyOf(space, c).private;
    return (
      <li key={c.id}>
        <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-fg/[0.04]">
          {c.type === "voice" ? (
            <SpeakerHigh aria-hidden="true" size={17} className="text-fg-soft" />
          ) : c.type === "category" ? null : (
            <Hash aria-hidden="true" size={17} className="text-fg-soft" />
          )}
          <span
            className={cx(
              "min-w-0 flex-1 truncate",
              c.type === "category"
                ? "text-[0.8rem] font-bold tracking-wider text-fg-soft uppercase"
                : "font-bold text-fg",
            )}
          >
            {c.name}
          </span>
          {closed && <Lock aria-label="Private" size={14} className="text-fg-soft" />}
          {c.slowmodeSeconds > 0 && (
            <span className="text-[0.78rem] text-fg-soft">Slow {slowWords(c.slowmodeSeconds)}</span>
          )}
          <button
            type="button"
            onClick={() => move(c.id, -1)}
            className="grid size-7 place-items-center rounded-lg text-fg-soft hover:bg-fg/8 hover:text-fg"
          >
            <CaretUp aria-hidden="true" size={14} />
            <span className="sr-only">Move {c.name} up</span>
          </button>
          <button
            type="button"
            onClick={() => move(c.id, 1)}
            className="grid size-7 place-items-center rounded-lg text-fg-soft hover:bg-fg/8 hover:text-fg"
          >
            <CaretDown aria-hidden="true" size={14} />
            <span className="sr-only">Move {c.name} down</span>
          </button>
          <button
            type="button"
            onClick={() => setEditing(editing === c.id ? null : c.id)}
            className={pill("quiet", "sm")}
          >
            Edit<span className="sr-only"> {c.name}</span>
          </button>
          <button
            type="button"
            onClick={() => remove(c)}
            className="grid size-8 place-items-center rounded-lg text-fg-soft hover:bg-fg/8 hover:text-danger"
          >
            <Trash aria-hidden="true" size={15} />
            <span className="sr-only">Delete {c.name}</span>
          </button>
        </div>
        {editing === c.id && <RoomEditor space={space} room={c} onDone={() => setEditing(null)} />}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <FormNotice>{notice}</FormNotice>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["text", "Chat room"],
            ["voice", "Voice room"],
            ["category", "Group"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setAdding(adding === k ? null : k)}
            className={pill(adding === k ? "action" : "ghost", "sm")}
          >
            <Plus aria-hidden="true" size={15} />
            {label}
          </button>
        ))}
      </div>
      {adding && (
        <form onSubmit={add} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={100}
            placeholder={
              adding === "category" ? "Group name, like Game nights" : "Room name, like late-night"
            }
            aria-label="Name"
            className={field}
          />
          <button type="submit" className={pill("action", "md")}>
            Add
          </button>
        </form>
      )}
      {sections.map((sec) =>
        !sec.group && !sec.rooms.length ? null : (
          <ul key={sec.group?.id ?? "top"} className="space-y-0.5">
            {sec.group && row(sec.group)}
            <li>
              <ul className={cx("space-y-0.5", sec.group && "ml-3 border-l border-line pl-2")}>
                {sec.rooms.map(row)}
              </ul>
            </li>
          </ul>
        ),
      )}
    </div>
  );
}
