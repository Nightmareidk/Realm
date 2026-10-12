"use client";

import { DotsThree } from "@phosphor-icons/react";
import type { Member, SpaceDetail } from "@realm/contracts";
import { useState } from "react";
import { row as menuRow, Popover } from "@/features/app/menus";
import { useMessagePerson } from "@/features/messages/inbox";
import { isMuted, openReport, setState, useRealm } from "@/features/realtime/store";
import { ApiError, api } from "@/lib/api";
import { Avatar, presenceLabel } from "./person";

/**
 * Here now, inside a Space: who's around first, then everyone else. Presence shows only for
 * people who share it (and, for under-18s, only in small Spaces); the server decides.
 */
export function SpaceHereNow({ space }: { space: SpaceDetail }) {
  const members = useRealm((s) => s.members[space.id]);
  const presence = useRealm((s) => s.presence);
  const mods = new Set(space.roles.filter((r) => r.name === "Mods").map((r) => r.id));

  const status = (m: Member) => {
    const p =
      m.user.id === space.self.user.id ? (presence[m.user.id] ?? "online") : presence[m.user.id];
    return p ?? "offline";
  };
  const sorted = [...(members ?? [])].sort((a, b) =>
    (a.nickname ?? a.user.displayName).localeCompare(b.nickname ?? b.user.displayName),
  );
  const around = sorted.filter((m) => status(m) !== "offline");
  const away = sorted.filter((m) => status(m) === "offline");

  const tag = (m: Member) =>
    m.user.id === space.ownerId ? "Owner" : m.roleIds.some((r) => mods.has(r)) ? "Mods" : null;

  const row = (m: Member) => {
    const p = status(m);
    const you = m.user.id === space.self.user.id;
    const t = tag(m);
    return (
      <li key={m.user.id} className="flex items-center gap-3 px-1 py-1.5">
        <Avatar user={m.user} size={38} presence={p} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-bold text-fg">
            <span className="truncate">
              {m.nickname ?? m.user.displayName}
              {you && <span className="font-normal text-fg-soft"> (you)</span>}
            </span>
            {t && (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[0.74rem] font-bold text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border-strong)]">
                {t}
              </span>
            )}
          </p>
          {p !== "offline" && (
            <p className="truncate text-[0.86rem] text-fg-soft">{presenceLabel[p]}</p>
          )}
        </div>
        {!you && <PersonMenu member={m} space={space} />}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2
          id="here-now-title"
          tabIndex={-1}
          className="font-display text-[1.25rem] font-extrabold tracking-[-0.025em] text-fg outline-none"
        >
          Here now
        </h2>
        {members && (
          <span className="text-[0.88rem] text-fg-soft">
            {around.length} of {members.length}
          </span>
        )}
      </div>
      {!members ? (
        <p role="status" className="px-1 text-fg-soft">
          Seeing who's around…
        </p>
      ) : (
        <>
          <ul aria-label="Around now">{around.map(row)}</ul>
          {away.length > 0 && (
            <section aria-labelledby="here-away" className="border-t border-line pt-3">
              <h3 id="here-away" className="px-1 pb-1 text-[0.82rem] font-bold text-fg-soft">
                Away
              </h3>
              <ul>{away.map(row)}</ul>
            </section>
          )}
          {members.length < 2 && (
            <p className="border-t border-line px-1 pt-3 text-[0.92rem] text-fg-soft">
              Just you so far. Invite your crew from the top of the Space.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** What you can do about someone else: report, block (their messages fold away) or mute. */
function PersonMenu({ member, space }: { member: Member; space: SpaceDetail }) {
  const blocked = useRealm((s) => s.blocked.includes(member.user.id));
  const muted = useRealm((s) => isMuted(s, "user", member.user.id));
  const name = member.nickname ?? member.user.displayName;
  const id = member.user.id;
  const message = useMessagePerson();
  const [error, setError] = useState("");
  return (
    <Popover
      label={`More for ${name}`}
      panelClass="w-[14rem]"
      buttonClass="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg aria-expanded:bg-fg/8"
      button={<DotsThree aria-hidden="true" size={20} weight="bold" />}
    >
      {(close) => (
        <div>
          {!blocked && (
            <button
              type="button"
              className={menuRow}
              onClick={() =>
                message(id)
                  .then(close)
                  .catch((err) =>
                    setError(err instanceof ApiError ? err.message : "Couldn't open a chat."),
                  )
              }
            >
              Send {name} a message
            </button>
          )}
          {error && (
            <p role="alert" className="px-3 pb-2 text-[0.88rem] text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            className={menuRow}
            onClick={() => {
              close();
              const path = `/users/@me/mutes/user/${id}`;
              void (
                muted ? api(path, { method: "DELETE" }) : api(path, { method: "PUT", body: {} })
              ).catch(() => {});
              setState((s) => ({
                ...s,
                mutes: muted
                  ? s.mutes.filter((m) => !(m.targetType === "user" && m.targetId === id))
                  : [...s.mutes, { targetType: "user", targetId: id, until: null }],
              }));
            }}
          >
            {muted ? "Unmute" : "Mute"} {name}
          </button>
          <button
            type="button"
            className={menuRow}
            onClick={() => {
              close();
              const path = `/users/@me/blocks/${id}`;
              void (blocked ? api(path, { method: "DELETE" }) : api(path, { method: "PUT" })).catch(
                () => {},
              );
              setState((s) => ({
                ...s,
                blocked: blocked ? s.blocked.filter((b) => b !== id) : [...s.blocked, id],
              }));
            }}
          >
            {blocked ? "Unblock" : "Block"} {name}
          </button>
          <button
            type="button"
            className={menuRow}
            onClick={() => {
              close();
              openReport({
                targetType: "user",
                targetId: id,
                communityId: space.id,
                label: name,
                blockUserId: id,
              });
            }}
          >
            Report {name}
          </button>
        </div>
      )}
    </Popover>
  );
}
