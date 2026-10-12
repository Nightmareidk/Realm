"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import type { SafetyLists, SelfUser } from "@realm/contracts";
import { useCallback, useEffect, useState } from "react";
import { pill } from "@/components/pill";
import { setState, useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { api } from "@/lib/api";

const section = "border-t border-line pt-8 pb-2 first:border-t-0 first:pt-0";
const heading = "font-display text-[1.35rem] font-extrabold tracking-[-0.025em] text-fg";

/** Who you've blocked and what you've muted, how reports work, and (under 18) your defaults. */
export function SafetyPanel({ viewer }: { viewer: SelfUser }) {
  const [lists, setLists] = useState<SafetyLists | null>(null);
  const spaces = useRealm((s) => s.spaces);

  const load = useCallback(async () => {
    const l = await api<SafetyLists>("/users/@me/safety").catch(() => ({ blocked: [], mutes: [] }));
    setLists(l);
    setState((s) => ({ ...s, blocked: l.blocked.map((u) => u.id), mutes: l.mutes }));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const mutedSpaces = (lists?.mutes ?? []).filter((m) => m.targetType === "community");

  return (
    <div className="max-w-[44rem] space-y-9">
      {viewer.teen && (
        <section aria-labelledby="teen" className={section}>
          <h2 id="teen" className={heading}>
            Because you're under 18
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-fg-soft">
            <li>Your profile starts private.</li>
            <li>
              Only friends can message you directly, and only friends of friends can send requests.
            </li>
            <li>Others see you're around only in Spaces of 200 people or fewer.</li>
            <li>You can't join Spaces marked for adults, or look for Spaces nearby.</li>
          </ul>
        </section>
      )}

      <section aria-labelledby="blocked" className={section}>
        <h2 id="blocked" className={heading}>
          Blocked
        </h2>
        <p className="mt-2 mb-5 text-fg-soft">
          Their messages fold away for you, and they never trigger notifications. They aren't told.
        </p>
        {!lists ? (
          <p role="status" className="text-fg-soft">
            Loading…
          </p>
        ) : lists.blocked.length === 0 ? (
          <p className="text-fg-soft">
            You haven't blocked anyone. You can from any message or from Here now.
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {lists.blocked.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <Avatar user={u} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-fg">{u.displayName}</span>
                  <span className="block text-[0.88rem] text-fg-soft">@{u.username}</span>
                </span>
                <button
                  type="button"
                  className={pill("ghost", "sm")}
                  onClick={async () => {
                    await api(`/users/@me/blocks/${u.id}`, { method: "DELETE" }).catch(() => {});
                    await load();
                  }}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="muted" className={section}>
        <h2 id="muted" className={heading}>
          Muted Spaces
        </h2>
        <p className="mt-2 mb-5 text-fg-soft">
          No dots and no notifications from these; you're still in them.
        </p>
        {mutedSpaces.length === 0 ? (
          <p className="text-fg-soft">Nothing muted. Mute a Space from its menu.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {mutedSpaces.map((m) => (
              <li key={m.targetId} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 font-bold text-fg">
                  {spaces.find((s) => s.id === m.targetId)?.name ?? "A Space you left"}
                </span>
                <button
                  type="button"
                  className={pill("ghost", "sm")}
                  onClick={async () => {
                    await api(`/users/@me/mutes/community/${m.targetId}`, {
                      method: "DELETE",
                    }).catch(() => {});
                    await load();
                  }}
                >
                  Unmute
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reports" className={section}>
        <h2 id="reports" className={heading}>
          How reports work
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-fg-soft">
          <li>Reports go to the Space's own moderators, and never say who sent them.</li>
          <li>
            A message hides itself after 2 reports in a Space of 10 or fewer people, or 3 in a
            bigger one, until a moderator decides.
          </li>
          <li>Reports of sexual content involving someone under 18 go straight to Realm.</li>
          <li>
            Spam is slowed down automatically: bursts, repeats, and links from brand-new accounts.
          </li>
        </ul>
        <p className="mt-4 inline-flex items-center gap-2 text-fg">
          <ShieldCheck aria-hidden="true" size={18} className="text-success" />
          Room messages aren't end-to-end encrypted, which is what lets moderators act on reports.
        </p>
      </section>
    </div>
  );
}
