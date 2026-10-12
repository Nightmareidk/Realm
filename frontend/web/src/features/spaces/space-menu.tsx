"use client";

import {
  Bell,
  BellSlash,
  ClockCounterClockwise,
  DotsThree,
  Flag,
  GearSix,
  Hash,
  PencilSimple,
  SignOut,
  SpeakerHigh,
  Trash,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react";
import { CommunityName, RoomName, type SpaceDetail } from "@realm/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { FormNotice, SubmitButton, TextField } from "@/components/form";
import { pill } from "@/components/pill";
import { iconButton, Popover, row } from "@/features/app/menus";
import { createRoom, deleteSpace, leaveSpace } from "@/features/realtime/actions";
import {
  isMuted,
  openInvite,
  openManage,
  openReport,
  patchSpace,
  setState,
  useRealm,
} from "@/features/realtime/store";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { Permission, spaceCan } from "./permissions";

type Sheet = "room" | "rename" | "leave" | "delete" | null;

/**
 * The Space's "More" menu: only what you're allowed to do shows (UX-ARCHITECTURE rule 1:
 * tools appear for the people who can use them).
 */
export function SpaceMenu({ space }: { space: SpaceDetail }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const owner = space.ownerId === space.self.user.id;
  const canInvite = spaceCan(space, Permission.CREATE_INVITES);
  const canRooms = spaceCan(space, Permission.MANAGE_CHANNELS);
  const canManage = spaceCan(space, Permission.MANAGE_COMMUNITY);
  const canMembers =
    spaceCan(space, Permission.KICK_MEMBERS) ||
    spaceCan(space, Permission.BAN_MEMBERS) ||
    spaceCan(space, Permission.TIMEOUT_MEMBERS) ||
    spaceCan(space, Permission.MANAGE_ROLES);
  const canReports = spaceCan(space, Permission.MODERATE_REPORTS);
  const canLog = spaceCan(space, Permission.VIEW_AUDIT_LOG);
  const muted = useRealm((s) => isMuted(s, "community", space.id));
  const toggleMute = async () => {
    const path = `/users/@me/mutes/community/${space.id}`;
    if (muted) await api(path, { method: "DELETE" }).catch(() => {});
    else await api(path, { method: "PUT", body: {} }).catch(() => {});
    setState((s) => ({
      ...s,
      mutes: muted
        ? s.mutes.filter((m) => !(m.targetType === "community" && m.targetId === space.id))
        : [...s.mutes, { targetType: "community", targetId: space.id, until: null }],
    }));
  };

  return (
    <>
      <Popover
        label={`More for ${space.name}`}
        buttonClass={iconButton}
        panelClass="w-[16rem]"
        button={<DotsThree aria-hidden="true" size={22} weight="bold" />}
      >
        {(close) => (
          <div>
            {canInvite && (
              <button
                type="button"
                className={row}
                onClick={() => {
                  close();
                  openInvite(space.id);
                }}
              >
                <UserPlus aria-hidden="true" size={20} />
                Invite people
              </button>
            )}
            {canRooms && (
              <button
                type="button"
                className={row}
                onClick={() => {
                  close();
                  setSheet("room");
                }}
              >
                <Hash aria-hidden="true" size={20} />
                New room
              </button>
            )}
            {canManage && (
              <button
                type="button"
                className={row}
                onClick={() => {
                  close();
                  setSheet("rename");
                }}
              >
                <PencilSimple aria-hidden="true" size={20} />
                Rename Space
              </button>
            )}
            {(canManage || canMembers || canReports || canLog) && (
              <div className="mt-1.5 border-t border-line pt-1.5">
                {canManage && (
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      close();
                      openManage(space.id, "settings");
                    }}
                  >
                    <GearSix aria-hidden="true" size={20} />
                    Space settings
                  </button>
                )}
                {canMembers && (
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      close();
                      openManage(space.id, "members");
                    }}
                  >
                    <UsersThree aria-hidden="true" size={20} />
                    Members
                  </button>
                )}
                {canReports && (
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      close();
                      openManage(space.id, "reports");
                    }}
                  >
                    <Flag aria-hidden="true" size={20} />
                    Reports
                  </button>
                )}
                {canLog && (
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      close();
                      openManage(space.id, "activity");
                    }}
                  >
                    <ClockCounterClockwise aria-hidden="true" size={20} />
                    Activity log
                  </button>
                )}
              </div>
            )}
            <div className="mt-1.5 border-t border-line pt-1.5">
              <button
                type="button"
                className={row}
                onClick={() => {
                  close();
                  void toggleMute();
                }}
              >
                {muted ? (
                  <Bell aria-hidden="true" size={20} />
                ) : (
                  <BellSlash aria-hidden="true" size={20} />
                )}
                {muted ? "Unmute this Space" : "Mute this Space"}
              </button>
              {!owner && (
                <button
                  type="button"
                  className={row}
                  onClick={() => {
                    close();
                    openReport({ targetType: "community", targetId: space.id, label: space.name });
                  }}
                >
                  <Flag aria-hidden="true" size={20} />
                  Report this Space
                </button>
              )}
            </div>
            <div className="mt-1.5 border-t border-line pt-1.5">
              {owner ? (
                <button
                  type="button"
                  className={cx(row, "text-danger hover:text-danger")}
                  onClick={() => {
                    close();
                    setSheet("delete");
                  }}
                >
                  <Trash aria-hidden="true" size={20} />
                  Delete Space
                </button>
              ) : (
                <button
                  type="button"
                  className={cx(row, "text-danger hover:text-danger")}
                  onClick={() => {
                    close();
                    setSheet("leave");
                  }}
                >
                  <SignOut aria-hidden="true" size={20} />
                  Leave Space
                </button>
              )}
            </div>
          </div>
        )}
      </Popover>

      <Dialog open={sheet === "room"} onClose={() => setSheet(null)} title="New room">
        <NewRoomForm space={space} onDone={() => setSheet(null)} />
      </Dialog>
      <Dialog open={sheet === "rename"} onClose={() => setSheet(null)} title="Rename Space">
        <RenameForm space={space} onDone={() => setSheet(null)} />
      </Dialog>
      <Dialog
        open={sheet === "leave"}
        onClose={() => setSheet(null)}
        title={`Leave ${space.name}?`}
        lead="You'll need a new invite to come back."
      >
        <LeaveForm space={space} onCancel={() => setSheet(null)} />
      </Dialog>
      <Dialog
        open={sheet === "delete"}
        onClose={() => setSheet(null)}
        title={`Delete ${space.name}?`}
        lead="Everyone loses it: its rooms and everything said in them. This can't be undone from here."
      >
        <DeleteForm space={space} onCancel={() => setSheet(null)} />
      </Dialog>
    </>
  );
}

function NewRoomForm({ space, onDone }: { space: SpaceDetail; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const parsed = RoomName.safeParse(name);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the name");
      input.current?.focus();
      return;
    }
    setPending(true);
    try {
      const room = await createRoom(space.id, parsed.data, type);
      onDone();
      router.push(`/spaces/${space.slug}/${room.name}`);
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiError ? err.message : "Couldn't make the room. Try again.");
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <TextField
        label="Room name"
        hint="Lowercase, with dashes between words, so it works in links."
        name="room-name"
        autoComplete="off"
        autoFocus
        placeholder="clips"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
        status={parsed.success && name ? `It'll be #${parsed.data}` : undefined}
        inputRef={input}
      />
      <fieldset>
        <legend className="mb-2 block text-[0.95rem] font-bold text-fg">Kind of room</legend>
        <div className="flex flex-wrap gap-2.5">
          {(
            [
              { id: "text", label: "Chat", icon: Hash },
              { id: "voice", label: "Voice", icon: SpeakerHigh },
            ] as const
          ).map((k) => {
            const on = type === k.id;
            const Icon = k.icon;
            return (
              <label
                key={k.id}
                className={cx(
                  "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 font-bold transition-shadow duration-150",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  on
                    ? "bg-surface text-fg shadow-[inset_0_0_0_1.5px_var(--r-text)]"
                    : "text-fg-soft shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] hover:text-fg",
                )}
              >
                <input
                  type="radio"
                  name="room-kind"
                  value={k.id}
                  checked={on}
                  onChange={() => setType(k.id)}
                  className="sr-only"
                />
                <Icon aria-hidden="true" size={18} />
                {k.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-[0.92rem] text-fg-soft">
        {type === "voice"
          ? "Drop in to talk, turn on cameras, or share a screen. Calls aren't end-to-end encrypted."
          : "Board rooms, for threads and votes, arrive with posts."}
      </p>
      <SubmitButton pending={pending} pendingLabel="Making the room" size="md">
        Make the room
      </SubmitButton>
    </form>
  );
}

function RenameForm({ space, onDone }: { space: SpaceDetail; onDone: () => void }) {
  const [name, setName] = useState(space.name);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = CommunityName.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the name");
    setPending(true);
    try {
      await api(`/communities/${space.id}`, { method: "PATCH", body: { name: parsed.data } });
      setState((s) => ({
        ...s,
        spaces: patchSpace(s.spaces, space.id, (sp) => ({ ...sp, name: parsed.data })),
      }));
      onDone();
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiError ? err.message : "Couldn't rename it. Try again.");
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <TextField
        label="Name"
        name="space-rename"
        autoComplete="off"
        autoFocus
        maxLength={64}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
        hint="Its link stays the same."
      />
      <SubmitButton pending={pending} pendingLabel="Saving" size="md">
        Save
      </SubmitButton>
    </form>
  );
}

function LeaveForm({ space, onCancel }: { space: SpaceDetail; onCancel: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div>
      <FormNotice>{error}</FormNotice>
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          aria-disabled={pending || undefined}
          onClick={async () => {
            setPending(true);
            try {
              await leaveSpace(space.id);
              router.push("/spaces");
            } catch (err) {
              setPending(false);
              setError(err instanceof ApiError ? err.message : "Couldn't leave. Try again.");
            }
          }}
          className={pill(
            "ghost",
            "md",
            "text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]",
          )}
        >
          {pending ? "Leaving" : "Leave Space"}
        </button>
        <button type="button" onClick={onCancel} className={pill("quiet", "md")}>
          Stay
        </button>
      </div>
    </div>
  );
}

function DeleteForm({ space, onCancel }: { space: SpaceDetail; onCancel: () => void }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const matches = typed.trim() === space.name;
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!matches) return setError(`Type ${space.name} exactly to delete it.`);
        setPending(true);
        try {
          await deleteSpace(space.id);
          router.push("/spaces");
        } catch (err) {
          setPending(false);
          setError(err instanceof ApiError ? err.message : "Couldn't delete it. Try again.");
        }
      }}
      className="space-y-5"
    >
      <TextField
        label={`Type ${space.name} to confirm`}
        name="confirm-delete"
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        error={error}
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          aria-disabled={!matches || pending || undefined}
          className={pill(
            "ghost",
            "md",
            "text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)] aria-disabled:opacity-60",
          )}
        >
          {pending ? "Deleting" : "Delete Space"}
        </button>
        <button type="button" onClick={onCancel} className={pill("quiet", "md")}>
          Keep it
        </button>
      </div>
    </form>
  );
}
