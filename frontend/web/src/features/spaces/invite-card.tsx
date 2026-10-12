import { Globe, LockSimple } from "@phosphor-icons/react/dist/ssr";
import type { Invite } from "@realm/contracts";
import { Avatar } from "./person";
import { SpaceBadge, spaceLight } from "./space-badge";

function lasts(invite: Invite) {
  if (!invite.expiresAt) return "never expires";
  const ms = Date.parse(invite.expiresAt) - Date.now();
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return "works for less than an hour more";
  if (hours < 48) return `works for ${hours} more ${hours === 1 ? "hour" : "hours"}`;
  return `works for ${Math.round(hours / 24)} more days`;
}

/**
 * The Space you've been invited to, as the s3 preview shows it: its light, its badge, who sent
 * the link, how many are in it and around. A private Space shows nothing from inside before you
 * join; a public one lists its rooms.
 */
export function InviteCard({ invite }: { invite: Invite }) {
  const c = invite.community;
  const Vis = c.visibility === "public" ? Globe : LockSimple;
  return (
    <section
      aria-label={`${c.name}, the Space you're invited to`}
      className="rounded-[1.75rem] bg-surface p-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08),0_60px_120px_-50px_var(--r-shadow)]"
    >
      <div
        aria-hidden="true"
        className="h-32 rounded-[1.25rem] sm:h-40"
        style={{ background: spaceLight(c.accent) }}
      />
      <div className="-mt-9 flex items-end gap-4 px-4">
        <span className="rounded-[1.4rem] bg-surface p-1.5">
          <SpaceBadge name={c.name} accent={c.accent} size={72} />
        </span>
        {invite.inviter && (
          <span className="flex min-w-0 items-center gap-2 pb-2 text-fg-soft">
            <Avatar user={invite.inviter} size={30} />
            <span className="truncate">
              <strong className="text-fg">{invite.inviter.displayName}</strong> invited you
            </span>
          </span>
        )}
      </div>
      <div className="px-4 pt-4 pb-3">
        <h2 className="font-display text-[2rem] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance text-fg">
          {c.name}
        </h2>
        {c.description && <p className="mt-2 max-w-[48ch] text-fg-soft">{c.description}</p>}
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-fg-soft">
          <span className="inline-flex items-center gap-1.5">
            <Vis aria-hidden="true" size={16} />
            {c.visibility === "public" ? "Public Space" : "Private Space"}
          </span>
          <span className="font-bold text-fg">
            {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
          </span>
          {invite.hereNow > 0 && (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-presence" />
              {invite.hereNow} here now
            </span>
          )}
        </p>
        {invite.rooms.length > 0 && (
          <ul aria-label="Rooms" className="mt-4 flex flex-wrap gap-2">
            {invite.rooms.map((r) => (
              <li
                key={r}
                className="inline-flex h-8 items-center rounded-full px-3 text-[0.88rem] font-bold text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border-strong)]"
              >
                # {r}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[0.9rem] text-fg-soft">
          Invite{invite.inviter ? ` from ${invite.inviter.displayName}` : ""} · {lasts(invite)}
        </p>
      </div>
    </section>
  );
}
