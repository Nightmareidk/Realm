"use client";

import {
  CaretDown,
  CaretLeft,
  CaretUp,
  Lock,
  Plus,
  ShieldCheck,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import {
  PERMISSION_GROUPS,
  Permission,
  type Role,
  SPACE_ROLE_LIMIT,
  type SpaceDetail,
} from "@realm/contracts";
import { type FormEvent, useEffect, useId, useState } from "react";
import { FormNotice, labelClass, SubmitButton } from "@/components/form";
import { pill } from "@/components/pill";
import { loadMembers } from "@/features/realtime/actions";
import { patchSpace, setState, useRealm } from "@/features/realtime/store";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { spaceCan } from "./permissions";

/** Colours a role can wear (or none); the same set as the phone app. */
const COLOURS = [
  0x7ef2c4, 0x6ee7a8, 0x5ad1e6, 0x8ab4ff, 0xb69cff, 0xff8fd8, 0xff6b6b, 0xffa95e, 0xffd866,
  0xd9d9e0,
];
export const hex = (c: number | null) =>
  c === null ? null : `#${c.toString(16).padStart(6, "0")}`;
const count = (bits: bigint) => {
  let n = 0;
  for (let b = bits; b > 0n; b >>= 1n) n += Number(b & 1n);
  return n;
};

export function rankIn(space: SpaceDetail, userId: string, roleIds: readonly string[]) {
  if (space.ownerId === userId) return Number.POSITIVE_INFINITY;
  return Math.max(0, ...space.roles.filter((r) => roleIds.includes(r.id)).map((r) => r.position));
}

export const topDown = (space: SpaceDetail) =>
  [...space.roles].sort((a, b) =>
    a.id === space.id ? 1 : b.id === space.id ? -1 : b.position - a.position,
  );

/** Puts a saved role (or the new order) into the Space straight away; the live update agrees. */
function keep(spaceId: string, change: (roles: Role[]) => Role[]) {
  setState((s) => ({
    ...s,
    spaces: patchSpace(s.spaces, spaceId, (sp) => ({ ...sp, roles: change(sp.roles) })),
  }));
}

/**
 * A Space's roles, highest first: make new ones, move them up and down, and choose what each can
 * do in plain words. You change only roles below your own, and only permissions you have.
 */
export function RolesTab({ space }: { space: SpaceDetail }) {
  const members = useRealm((s) => s.members[space.id]);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [moving, setMoving] = useState(false);
  const rank = rankIn(space, space.self.user.id, space.self.roleIds);
  const manage = spaceCan(space, Permission.MANAGE_ROLES);
  const list = topDown(space);
  const movable = list.filter((r) => r.id !== space.id && r.position < rank);

  useEffect(() => {
    if (!members) void loadMembers(space.id).catch(() => {});
  }, [members, space.id]);

  const people = (r: Role) =>
    r.id === space.id
      ? (members?.length ?? space.memberCount)
      : (members?.filter((m) => m.roleIds.includes(r.id)).length ?? 0);

  const move = async (r: Role, by: -1 | 1) => {
    const i = movable.findIndex((x) => x.id === r.id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= movable.length) return;
    const order = movable.map((x) => x.id);
    [order[i], order[j]] = [order[j] as string, order[i] as string];
    setMoving(true);
    setNotice("");
    try {
      const res = await api<{ roles: Role[] }>(`/communities/${space.id}/roles/order`, {
        method: "PUT",
        body: { roleIds: order },
      });
      keep(space.id, () => res.roles);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Couldn't move it. Try again.");
    } finally {
      setMoving(false);
    }
  };

  if (editing) {
    return (
      <RoleEditor
        space={space}
        role={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-fg-soft">
        Roles decide what people can do here. Higher roles win, and you can only change roles below
        your own.
      </p>
      <FormNotice>{notice}</FormNotice>
      {manage && rank >= 1 && space.roles.length < SPACE_ROLE_LIMIT && (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex w-full items-center gap-3 rounded-card border-[1.5px] border-dashed border-line-strong p-2.5 text-left font-bold text-fg transition-colors hover:bg-surface-raised"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-on-accent">
            <Plus aria-hidden="true" size={18} weight="bold" />
          </span>
          Make a new role
        </button>
      )}
      <ul className="space-y-2">
        {list.map((r) => {
          const everyone = r.id === space.id;
          const editable = manage && r.position < rank;
          const at = movable.findIndex((x) => x.id === r.id);
          const colour = hex(r.color);
          const n = people(r);
          return (
            <li key={r.id} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!editable}
                onClick={() => setEditing(r)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-card bg-surface p-2.5 text-left transition-colors enabled:hover:bg-surface-raised disabled:cursor-default"
              >
                <span
                  className={cx(
                    "grid size-9 shrink-0 place-items-center rounded-xl",
                    !colour && "bg-surface-raised text-fg",
                  )}
                  style={colour ? { backgroundColor: colour, color: "#0b0b0e" } : undefined}
                >
                  {everyone ? (
                    <UsersThree aria-hidden="true" size={18} />
                  ) : (
                    <ShieldCheck aria-hidden="true" size={18} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-fg">
                    {everyone ? "Everyone" : r.name}
                  </span>
                  <span className="block truncate text-[0.88rem] text-fg-soft">
                    {everyone
                      ? "What every member can do"
                      : `${n} ${n === 1 ? "person" : "people"} · ${count(BigInt(r.permissions))} permissions`}
                  </span>
                </span>
                {!editable && (
                  <Lock
                    aria-label="Above you, so you can't change it"
                    size={16}
                    className="text-fg-soft"
                  />
                )}
              </button>
              {at >= 0 && (
                <span className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${r.name} up`}
                    disabled={moving || at === 0}
                    onClick={() => void move(r, -1)}
                    className="grid h-7 w-9 place-items-center rounded-lg bg-surface-raised text-fg disabled:opacity-40"
                  >
                    <CaretUp aria-hidden="true" size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${r.name} down`}
                    disabled={moving || at === movable.length - 1}
                    onClick={() => void move(r, 1)}
                    className="grid h-7 w-9 place-items-center rounded-lg bg-surface-raised text-fg disabled:opacity-40"
                  >
                    <CaretDown aria-hidden="true" size={15} />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled,
  danger,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const id = useId();
  return (
    <div
      className={cx(
        "flex items-center gap-4 border-t border-line py-2.5",
        disabled && "opacity-50",
      )}
    >
      <span className="min-w-0 flex-1">
        <span id={id} className={cx("block font-bold", danger ? "text-danger" : "text-fg")}>
          {label}
        </span>
        <span id={`${id}-hint`} className="block text-[0.9rem] text-fg-soft">
          {hint}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        aria-describedby={`${id}-hint`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 disabled:cursor-not-allowed",
          checked ? (danger ? "bg-danger-line" : "bg-accent") : "bg-line-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "absolute top-1 left-1 size-5 rounded-full bg-[#ffffff] shadow-[0_1px_3px_rgb(0_0_0/0.35)] transition-transform duration-150",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

function RoleEditor({
  space,
  role,
  onClose,
}: {
  space: SpaceDetail;
  role: Role | null;
  onClose: () => void;
}) {
  const everyone = role?.id === space.id;
  const [name, setName] = useState(role?.name ?? "");
  const [colour, setColour] = useState<number | null>(role ? role.color : (COLOURS[0] ?? null));
  const [hoist, setHoist] = useState(role?.hoist ?? true);
  const [mentionable, setMentionable] = useState(role?.mentionable ?? false);
  const [bits, setBits] = useState<bigint>(role ? BigInt(role.permissions) : 0n);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const shown = hex(colour);
  const nameId = useId();

  const flip = (bit: bigint, on: boolean, danger?: boolean, label?: string) => {
    if (
      on &&
      danger &&
      !window.confirm(
        bit === Permission.ADMINISTRATOR
          ? `Turn on "${label}"? Anyone with this role can do everything, in every room.`
          : `Turn on "${label}"? Anyone with this role can keep people out for good.`,
      )
    ) {
      return;
    }
    setBits((b) => (on ? b | bit : b & ~bit));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!everyone && !name.trim()) {
      setNotice("Give the role a name people will see.");
      return;
    }
    setPending(true);
    setNotice("");
    const body = everyone
      ? { permissions: bits.toString() }
      : { name: name.trim(), color: colour, hoist, mentionable, permissions: bits.toString() };
    try {
      const saved = role
        ? await api<Role>(`/communities/${space.id}/roles/${role.id}`, { method: "PATCH", body })
        : await api<Role>(`/communities/${space.id}/roles`, { body });
      keep(space.id, (roles) =>
        role
          ? roles.map((r) => (r.id === saved.id ? saved : r))
          : // A new role starts at the bottom; everyone else moves up one.
            [
              ...roles.map((r) => (r.position >= 1 ? { ...r, position: r.position + 1 } : r)),
              saved,
            ],
      );
      onClose();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Not saved. Try again.");
      setPending(false);
    }
  };

  const remove = async () => {
    if (!role) return;
    setNotice("");
    try {
      await api(`/communities/${space.id}/roles/${role.id}`, { method: "DELETE" });
      keep(space.id, (roles) =>
        roles
          .filter((r) => r.id !== role.id)
          .map((r) => (r.position > role.position ? { ...r, position: r.position - 1 } : r)),
      );
      onClose();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Not deleted. Try again.");
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-1.5 font-bold text-fg"
      >
        <CaretLeft aria-hidden="true" size={16} weight="bold" />
        All roles
      </button>

      <div
        className="flex items-center gap-3 rounded-card border-[1.5px] bg-surface p-3.5"
        style={{ borderColor: shown ?? "var(--r-border)" }}
      >
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full font-bold text-[#0b0b0e]"
          style={{ backgroundColor: shown ?? "var(--r-surface-raised)" }}
        >
          {space.self.user.displayName.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold" style={{ color: shown && !everyone ? shown : undefined }}>
              {space.self.user.displayName}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[0.8rem] font-bold"
              style={{
                backgroundColor: shown ?? "var(--r-surface-raised)",
                color: shown ? "#0b0b0e" : undefined,
              }}
            >
              {everyone ? "Everyone" : name.trim() || "New role"}
            </span>
          </span>
          <span className="block text-[0.9rem] text-fg-soft">
            This is how messages look with this role.
          </span>
        </span>
      </div>

      {everyone ? (
        <p className="text-fg-soft">
          Everyone is what every member can do. Other roles add to it, never take away.
        </p>
      ) : (
        <>
          <div>
            <label htmlFor={nameId} className={labelClass}>
              Name
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              placeholder="Like Helpers, Artists, Raid crew"
              className="block h-12 w-full rounded-input border-[1.5px] border-line-strong bg-base/70 px-4 text-fg placeholder:text-fg-muted focus-visible:border-accent focus-visible:outline-none"
            />
          </div>
          <fieldset>
            <legend className={labelClass}>Colour</legend>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                aria-pressed={colour === null}
                aria-label="No colour"
                onClick={() => setColour(null)}
                className={cx(
                  "grid size-9 place-items-center rounded-full border-[1.5px] border-line-strong text-fg-soft",
                  colour === null && "ring-[3px] ring-fg",
                )}
              >
                <X aria-hidden="true" size={16} />
              </button>
              {COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={colour === c}
                  aria-label={`Colour ${hex(c)}`}
                  onClick={() => setColour(c)}
                  className={cx("size-9 rounded-full", colour === c && "ring-[3px] ring-fg")}
                  style={{ backgroundColor: hex(c) ?? undefined }}
                />
              ))}
            </div>
          </fieldset>
          <div>
            <Switch
              label="Show them apart"
              hint="People with it get their own group in the member list."
              checked={hoist}
              onChange={setHoist}
            />
            <Switch
              label="Anyone can @mention it"
              hint="Pings everyone with this role."
              checked={mentionable}
              onChange={setMentionable}
            />
          </div>
        </>
      )}

      {PERMISSION_GROUPS.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h3 className="pb-1 text-[0.8rem] font-bold tracking-wider text-fg-soft uppercase">
            {g.title}
          </h3>
          {g.items.map((p) => {
            const bit = Permission[p.key];
            const mine = spaceCan(space, bit);
            return (
              <Switch
                key={p.key}
                label={p.label}
                hint={
                  mine ? p.line : `${p.line} You don't have this yourself, so you can't change it.`
                }
                checked={(bits & bit) === bit}
                disabled={!mine}
                danger={p.danger}
                onChange={(on) => flip(bit, on, p.danger, p.label)}
              />
            );
          })}
        </section>
      ))}

      <FormNotice>{notice}</FormNotice>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingLabel="Saving" size="md">
          {role ? "Save the role" : "Make the role"}
        </SubmitButton>
        {role && !everyone && !confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className={pill("quiet", "md", "text-danger")}
          >
            Delete the role
          </button>
        )}
        {confirmDelete && (
          <span className="flex items-center gap-2">
            <span className="text-fg">Everyone who has it loses it.</span>
            <button
              type="button"
              onClick={() => void remove()}
              className={pill(
                "ghost",
                "sm",
                "text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]",
              )}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className={pill("quiet", "sm")}
            >
              Keep it
            </button>
          </span>
        )}
      </div>
    </form>
  );
}
