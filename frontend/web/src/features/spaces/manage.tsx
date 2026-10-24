"use client";

import { DotsThree, Flag, MapPin, ShieldCheck } from "@phosphor-icons/react";
import {
  type AuditEntry,
  type Ban,
  CommunityDescription,
  type Member,
  type ReportedItem,
  type Role,
  type SpaceDetail,
  TIMEOUT_CHOICES_MS,
} from "@realm/contracts";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { FormNotice, labelClass, SubmitButton } from "@/components/form";
import { pill, textLink } from "@/components/pill";
import { Popover, row } from "@/features/app/menus";
import { type Found, searchPlaces } from "@/features/maps/geocode";
import { loadMembers } from "@/features/realtime/actions";
import {
  type ManageTab,
  openManage,
  patchSpace,
  setState,
  useRealm,
} from "@/features/realtime/store";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { MAPS_ON } from "@/lib/public-config";
import { uploadFile } from "@/lib/upload";
import { Permission, spaceCan } from "./permissions";
import { Avatar } from "./person";
import { hex, RolesTab, rankIn, topDown } from "./roles-tab";
import { spaceLight } from "./space-badge";
import { AutoModTab, GlowTab, RoomsTab } from "./space-extras";

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const TIMEOUT_LABEL: Record<number, string> = {
  60000: "1 minute",
  300000: "5 minutes",
  600000: "10 minutes",
  3600000: "1 hour",
  86400000: "1 day",
  604800000: "1 week",
};
const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate: "Hate",
  violence: "Threats",
  sexual_content: "Sexual content",
  sexual_minors: "Involves a minor",
  self_harm: "Self-harm",
  impersonation: "Impersonation",
  intellectual_property: "Someone else's work",
  other: "Other",
};
/** What a moderator can take down from the queue, and what the button says. */
const TAKE_DOWN: Partial<Record<ReportedItem["targetType"], string>> = {
  message: "Remove the message",
  post: "Remove the post",
  comment: "Remove the comment",
};

/**
 * Running a Space: its settings, its people, its roles, the reports its members sent, and the log of what
 * moderators did. Each tab shows only to people with the matching permission.
 */
export function ManageSpaceDialog() {
  const target = useRealm((s) => s.ui.manage);
  const space = useRealm((s) => s.spaces.find((x) => x.id === s.ui.manage?.spaceId));
  if (!target || !space) return null;
  const tabs: { id: ManageTab; label: string; show: boolean }[] = [
    { id: "settings", label: "Settings", show: spaceCan(space, Permission.MANAGE_COMMUNITY) },
    { id: "rooms", label: "Rooms", show: spaceCan(space, Permission.MANAGE_CHANNELS) },
    {
      id: "members",
      label: "Members",
      show:
        spaceCan(space, Permission.KICK_MEMBERS) ||
        spaceCan(space, Permission.BAN_MEMBERS) ||
        spaceCan(space, Permission.TIMEOUT_MEMBERS) ||
        spaceCan(space, Permission.MANAGE_ROLES),
    },
    { id: "roles", label: "Roles", show: spaceCan(space, Permission.MANAGE_ROLES) },
    { id: "reports", label: "Reports", show: spaceCan(space, Permission.MODERATE_REPORTS) },
    { id: "automod", label: "AutoMod", show: spaceCan(space, Permission.MANAGE_COMMUNITY) },
    { id: "activity", label: "Activity", show: spaceCan(space, Permission.VIEW_AUDIT_LOG) },
    { id: "glow", label: "Glow", show: true },
  ];
  const visible = tabs.filter((t) => t.show);
  const tab = visible.some((t) => t.id === target.tab) ? target.tab : visible[0]?.id;
  return (
    <Dialog
      open
      onClose={() => openManage(null)}
      title={space.name}
      className="w-[min(46rem,calc(100vw-1.5rem))]"
    >
      <div
        role="tablist"
        aria-label="Manage the Space"
        className="-mt-2 mb-6 flex flex-wrap gap-1.5"
      >
        {visible.map((t, i) => (
          <button
            key={t.id}
            id={`manage-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="manage-panel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => openManage(space.id, t.id)}
            onKeyDown={(e) => {
              const last = visible.length - 1;
              const to =
                e.key === "ArrowRight"
                  ? (i + 1) % visible.length
                  : e.key === "ArrowLeft"
                    ? (i - 1 + visible.length) % visible.length
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? last
                        : null;
              if (to === null) return;
              e.preventDefault();
              const next = visible[to];
              if (!next) return;
              openManage(space.id, next.id);
              requestAnimationFrame(() =>
                document.getElementById(`manage-tab-${next.id}`)?.focus(),
              );
            }}
            className={cx(
              "h-10 rounded-full px-4 text-[0.95rem] font-bold transition-colors duration-150",
              tab === t.id
                ? "bg-fg/8 text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
                : "text-fg-soft hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id="manage-panel"
        role="tabpanel"
        aria-labelledby={`manage-tab-${tab}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a tab panel takes focus when it has nothing focusable first (ARIA tabs pattern).
        tabIndex={0}
        className="max-h-[60vh] overflow-y-auto pr-1 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
      >
        {tab === "settings" && <SettingsTab space={space} />}
        {tab === "members" && <MembersTab space={space} />}
        {tab === "roles" && <RolesTab space={space} />}
        {tab === "rooms" && <RoomsTab space={space} />}
        {tab === "automod" && <AutoModTab space={space} />}
        {tab === "glow" && <GlowTab space={space} />}
        {tab === "reports" && <ReportsTab space={space} />}
        {tab === "activity" && <ActivityTab space={space} />}
      </div>
    </Dialog>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

/**
 * The Space's banner: the picture on its poster, its live tiles and its header. Until it has one,
 * the Space's own colours stand in. Your own photo upload only (the server checks).
 */
function BannerField({
  space,
  onNotice,
}: {
  space: SpaceDetail;
  onNotice: (n: { tone: "error" | "success"; text: string } | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const apply = async (bannerMediaId: string | null) => {
    const updated = await api<{ bannerUrl: string | null }>(`/communities/${space.id}`, {
      method: "PATCH",
      body: { bannerMediaId },
    });
    setState((s) => ({
      ...s,
      spaces: patchSpace(s.spaces, space.id, (sp) => ({ ...sp, bannerUrl: updated.bannerUrl })),
    }));
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    onNotice(null);
    setProgress(0);
    try {
      const media = await uploadFile(file, { kind: "image", filename: file.name }, setProgress);
      await apply(media.id);
      onNotice({ tone: "success", text: "Banner updated." });
    } catch (err) {
      onNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Couldn't upload that picture. Try again.",
      });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <p className={labelClass}>Banner</p>
      <div className="flex flex-wrap items-end gap-4">
        <div
          aria-hidden="true"
          className="relative aspect-[3/1] w-full max-w-[22rem] overflow-hidden rounded-[1rem] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]"
          style={space.bannerUrl ? undefined : { background: spaceLight(space.accent) }}
        >
          {space.bannerUrl && (
            // biome-ignore lint/performance/noImgElement: an uploaded banner behind an access check.
            <img src={space.bannerUrl} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            aria-disabled={progress !== null || undefined}
            onClick={() => progress === null && input.current?.click()}
            className={pill("ghost", "sm")}
          >
            {progress !== null
              ? `Uploading ${Math.round(progress * 100)}%`
              : space.bannerUrl
                ? "Change the picture"
                : "Choose a picture"}
          </button>
          {space.bannerUrl && progress === null && (
            <button
              type="button"
              onClick={() =>
                void apply(null)
                  .then(() => onNotice({ tone: "success", text: "Banner removed." }))
                  .catch(() => onNotice({ tone: "error", text: "Couldn't remove it. Try again." }))
              }
              className={pill("quiet", "sm")}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-[0.88rem] text-fg-soft">
        Shown on your Space's poster and when it's live. A wide photo works best.
      </p>
    </div>
  );
}

function SettingsTab({ space }: { space: SpaceDetail }) {
  const [description, setDescription] = useState(space.description ?? "");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<Found[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) return setCities([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void searchPlaces(query, { cities: true, signal: ctrl.signal })
        .then(setCities)
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const save = async (body: Record<string, unknown>, done: string) => {
    setPending(true);
    setNotice(null);
    try {
      const updated = await api<{ city: string | null; description: string | null }>(
        `/communities/${space.id}`,
        { method: "PATCH", body },
      );
      setState((s) => ({
        ...s,
        spaces: patchSpace(s.spaces, space.id, (sp) => ({
          ...sp,
          city: updated.city,
          description: updated.description,
        })),
      }));
      setNotice({ tone: "success", text: done });
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Couldn't save. Try again.",
      });
    } finally {
      setPending(false);
    }
  };

  const onDescription = (e: FormEvent) => {
    e.preventDefault();
    const parsed = CommunityDescription.safeParse(description);
    if (!parsed.success) return setNotice({ tone: "error", text: "That's too long." });
    void save({ description: parsed.data || null }, "Saved.");
  };

  return (
    <div className="space-y-8">
      {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
      <BannerField space={space} onNotice={setNotice} />
      <form noValidate onSubmit={onDescription} className="space-y-3">
        <label htmlFor="space-about" className={labelClass}>
          What it's about
        </label>
        <textarea
          id="space-about"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ranked nights, clips and very long calls."
          className="block w-full resize-y rounded-input bg-base/70 px-4 py-3 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
        />
        <SubmitButton pending={pending} pendingLabel="Saving" size="md" variant="secondary">
          Save
        </SubmitButton>
      </form>

      <section aria-labelledby="space-city" className="space-y-3 border-t border-line pt-6">
        <h3 id="space-city" className="font-bold text-fg">
          Its city
        </h3>
        <p className="text-[0.95rem] text-fg-soft">
          {space.visibility === "public"
            ? "Public Spaces with a city can be found by people nearby in Explore (not by under-18s). It's kept to the city, never an address."
            : "Private Spaces never show in Explore. The city is just for your members to see."}
        </p>
        <p className="text-fg">
          {space.city ? (
            <span className="inline-flex items-center gap-1.5 font-bold">
              <MapPin aria-hidden="true" size={18} />
              {space.city}
            </span>
          ) : (
            <span className="text-fg-soft">No city set.</span>
          )}
          {space.city && (
            <button
              type="button"
              className={cx(textLink, "ml-3")}
              onClick={() => void save({ location: null }, "City cleared.")}
            >
              Clear
            </button>
          )}
        </p>
        {MAPS_ON ? (
          <div>
            <label htmlFor="city-search" className="sr-only">
              Search for a city
            </label>
            <input
              id="city-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a city"
              autoComplete="off"
              className="h-12 w-full rounded-input bg-base/70 px-4 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none placeholder:text-fg-muted focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
            />
            {cities.length > 0 && (
              <ul
                aria-label="Cities"
                className="mt-2 rounded-card bg-surface p-1 shadow-[inset_0_0_0_1px_var(--r-border)]"
              >
                {cities.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setCities([]);
                        void save(
                          { location: { city: c.name, lat: c.lat, lng: c.lng } },
                          `City set to ${c.name}.`,
                        );
                      }}
                      className="flex w-full flex-col items-start rounded-[0.7rem] px-3 py-2 text-left hover:bg-fg/8"
                    >
                      <span className="font-bold text-fg">{c.name}</span>
                      {c.address && (
                        <span className="text-[0.88rem] text-fg-soft">{c.address}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-[0.92rem] text-fg-soft">Maps aren't set up on this Realm yet.</p>
        )}
      </section>
    </div>
  );
}

// ── Members ──────────────────────────────────────────────────────────────────

function MembersTab({ space }: { space: SpaceDetail }) {
  const members = useRealm((s) => s.members[space.id]);
  const [assignable, setAssignable] = useState<string[]>([]);
  const [bans, setBans] = useState<Ban[] | null>(null);
  const [notice, setNotice] = useState("");
  const canBan = spaceCan(space, Permission.BAN_MEMBERS);

  const reload = useCallback(async () => {
    await loadMembers(space.id).catch(() => {});
    setAssignable(
      (
        await api<{ roleIds: string[] }>(`/communities/${space.id}/assignable-roles`).catch(() => ({
          roleIds: [],
        }))
      ).roleIds,
    );
    if (canBan)
      setBans(
        (await api<{ bans: Ban[] }>(`/communities/${space.id}/bans`).catch(() => ({ bans: [] })))
          .bans,
      );
  }, [space.id, canBan]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = async (fn: () => Promise<unknown>) => {
    setNotice("");
    try {
      await fn();
      await reload();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  };

  const sorted = [...(members ?? [])].sort((a, b) =>
    a.user.displayName.localeCompare(b.user.displayName),
  );
  return (
    <div className="space-y-6">
      <FormNotice>{notice}</FormNotice>
      {!members ? (
        <p role="status" className="text-fg-soft">
          Loading members…
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {sorted.map((m) => (
            <MemberRow
              key={m.user.id}
              m={m}
              space={space}
              assignable={topDown(space).filter((r) => assignable.includes(r.id))}
              act={act}
            />
          ))}
        </ul>
      )}
      {canBan && bans && bans.length > 0 && (
        <section aria-labelledby="bans" className="space-y-2">
          <h3 id="bans" className="font-bold text-fg">
            Banned
          </h3>
          <ul className="divide-y divide-line border-y border-line">
            {bans.map((b) => (
              <li key={b.user.id} className="flex items-center gap-3 py-2.5">
                <Avatar user={b.user} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-fg">{b.user.displayName}</span>
                  {b.reason && (
                    <span className="block text-[0.88rem] text-fg-soft">{b.reason}</span>
                  )}
                </span>
                <button
                  type="button"
                  className={pill("ghost", "sm")}
                  onClick={() =>
                    void act(() =>
                      api(`/communities/${space.id}/bans/${b.user.id}`, { method: "DELETE" }),
                    )
                  }
                >
                  Lift ban
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MemberRow({
  m,
  space,
  assignable,
  act,
}: {
  m: Member;
  space: SpaceDetail;
  /** Roles you may give or take: below your own. */
  assignable: Role[];
  act: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<"kick" | "ban" | null>(null);
  const [wipe, setWipe] = useState(true);
  const me = m.user.id === space.self.user.id;
  const owner = m.user.id === space.ownerId;
  const theirs = topDown(space).filter((r) => r.id !== space.id && m.roleIds.includes(r.id));
  const timedOut = m.timeoutUntil && Date.parse(m.timeoutUntil) > Date.now();
  // Only people below you: everyone for the owner, people under your highest role for others.
  const actionable =
    !me &&
    !owner &&
    rankIn(space, m.user.id, m.roleIds) < rankIn(space, space.self.user.id, space.self.roleIds);
  const base = `/communities/${space.id}/members/${m.user.id}`;

  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        <Avatar user={m.user} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-bold text-fg">
            <span className="truncate">{m.nickname ?? m.user.displayName}</span>
            {me && <span className="font-normal text-fg-soft">(you)</span>}
            {owner && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.74rem] text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border-strong)]">
                <ShieldCheck aria-hidden="true" size={12} />
                Owner
              </span>
            )}
            {theirs.slice(0, 3).map((r) => (
              <span
                key={r.id}
                className="inline-flex max-w-[9rem] items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.74rem] text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border-strong)]"
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full bg-fg-soft"
                  style={{ backgroundColor: hex(r.color) ?? undefined }}
                />
                <span className="truncate">{r.name}</span>
              </span>
            ))}
            {theirs.length > 3 && (
              <span className="text-[0.74rem] font-normal text-fg-soft">+{theirs.length - 3}</span>
            )}
          </span>
          <span className="block text-[0.86rem] text-fg-soft">
            @{m.user.username}
            {timedOut && m.timeoutUntil
              ? ` · timed out until ${when.format(new Date(m.timeoutUntil))}`
              : ""}
          </span>
        </span>
        {actionable && (
          <Popover
            label={`Actions for ${m.user.displayName}`}
            panelClass="w-[16rem]"
            buttonClass="inline-flex size-10 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg aria-expanded:bg-fg/8"
            button={<DotsThree aria-hidden="true" size={22} weight="bold" />}
          >
            {(close) => (
              <div>
                {assignable.map((r) => {
                  const hasIt = m.roleIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={row}
                      onClick={() => {
                        close();
                        const next = hasIt
                          ? m.roleIds.filter((id) => id !== r.id)
                          : [...m.roleIds, r.id];
                        void act(() => api(base, { method: "PATCH", body: { roleIds: next } }));
                      }}
                    >
                      {hasIt ? `Take away ${r.name}` : `Give ${r.name}`}
                    </button>
                  );
                })}
                {spaceCan(space, Permission.TIMEOUT_MEMBERS) &&
                  (timedOut ? (
                    <button
                      type="button"
                      className={row}
                      onClick={() => {
                        close();
                        void act(() =>
                          api(base, { method: "PATCH", body: { timeoutUntil: null } }),
                        );
                      }}
                    >
                      Lift the timeout
                    </button>
                  ) : (
                    <div className="px-3 pt-2 pb-1">
                      <p className="text-[0.85rem] font-bold text-fg-soft">Time out for</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {TIMEOUT_CHOICES_MS.map((ms) => (
                          <button
                            key={ms}
                            type="button"
                            onClick={() => {
                              close();
                              const until = new Date(Date.now() + ms).toISOString();
                              void act(() =>
                                api(base, { method: "PATCH", body: { timeoutUntil: until } }),
                              );
                            }}
                            className="h-8 rounded-full px-2.5 text-[0.82rem] font-bold text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border-strong)] hover:text-fg"
                          >
                            {TIMEOUT_LABEL[ms]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                {spaceCan(space, Permission.KICK_MEMBERS) && (
                  <button
                    type="button"
                    className={cx(row, "text-danger hover:text-danger")}
                    onClick={() => {
                      close();
                      setConfirm("kick");
                    }}
                  >
                    Remove from the Space
                  </button>
                )}
                {spaceCan(space, Permission.BAN_MEMBERS) && (
                  <button
                    type="button"
                    className={cx(row, "text-danger hover:text-danger")}
                    onClick={() => {
                      close();
                      setConfirm("ban");
                    }}
                  >
                    Ban
                  </button>
                )}
              </div>
            )}
          </Popover>
        )}
      </div>
      {confirm && (
        <div className="mt-2.5 ml-12 rounded-card bg-surface px-4 py-3 shadow-[inset_0_0_0_1px_var(--r-border)]">
          <p className="text-fg">
            {confirm === "kick"
              ? `Remove ${m.user.displayName}? They can come back with a new invite.`
              : `Ban ${m.user.displayName}? They can't come back until the ban is lifted.`}
          </p>
          {confirm === "ban" && (
            <label className="mt-2 flex items-center gap-2.5 text-[0.95rem] text-fg">
              <input
                type="checkbox"
                checked={wipe}
                onChange={(e) => setWipe(e.target.checked)}
                className="size-4 accent-[var(--r-text)]"
              />
              Also remove their messages from the last day
            </label>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={pill(
                "ghost",
                "sm",
                "text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]",
              )}
              onClick={() => {
                setConfirm(null);
                void act(() =>
                  confirm === "kick"
                    ? api(base, { method: "DELETE" })
                    : api(`/communities/${space.id}/bans/${m.user.id}`, {
                        method: "PUT",
                        body: { deleteMessagesHours: wipe ? 24 : 0 },
                      }),
                );
              }}
            >
              {confirm === "kick" ? "Remove" : "Ban"}
            </button>
            <button type="button" className={pill("quiet", "sm")} onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────

function ReportsTab({ space }: { space: SpaceDetail }) {
  const [items, setItems] = useState<ReportedItem[] | null>(null);
  const myId = useRealm((s) => s.me?.id);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: ReportedItem[] }>(`/communities/${space.id}/reports`)).items);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Couldn't load reports.");
    }
  }, [space.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (item: ReportedItem, action: "dismiss" | "remove") => {
    setNotice("");
    try {
      await api(`/communities/${space.id}/reports/${item.targetId}`, { body: { action } });
      await load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  };

  /** Settle it in one place: a day's timeout or a ban for the author (logged like any other). */
  const toAuthor = async (authorId: string, what: "timeout" | "ban") => {
    setNotice("");
    try {
      if (what === "timeout") {
        await api(`/communities/${space.id}/members/${authorId}`, {
          method: "PATCH",
          body: {
            timeoutUntil: new Date(Date.now() + 86_400_000).toISOString(),
            reason: "After reports",
          },
        });
      } else {
        await api(`/communities/${space.id}/bans/${authorId}`, {
          method: "PUT",
          body: { reason: "After reports", deleteMessagesHours: 24 },
        });
      }
      setNotice("");
      await load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  };
  const canTimeout = spaceCan(space, Permission.TIMEOUT_MEMBERS);
  const canBan = spaceCan(space, Permission.BAN_MEMBERS);

  if (!items)
    return (
      <p role="status" className="text-fg-soft">
        Loading reports…
      </p>
    );
  return (
    <div className="space-y-4">
      <FormNotice>{notice}</FormNotice>
      <p className="text-[0.95rem] text-fg-soft">
        A message, post or comment hides itself after 2 reports in a Space of 10 or fewer people, or
        3 in a bigger one, until you decide. Who reported stays private.
      </p>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-fg">
          <ShieldCheck aria-hidden="true" size={20} className="text-success" />
          Nothing waiting. Your Space is in good shape.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((it) => (
            <li key={it.id} className="py-4">
              <p className="flex flex-wrap items-center gap-2 text-[0.88rem] text-fg-soft">
                <Flag aria-hidden="true" size={15} />
                {it.count} {it.count === 1 ? "report" : "reports"} ·{" "}
                {it.reasons.map((r) => REASON_LABEL[r] ?? r).join(", ")}
                {it.hidden && <span className="font-bold text-fg">· hidden now</span>}
              </p>
              {it.evidence && (
                <blockquote className="mt-2 border-l border-line-strong pl-3 text-fg">
                  {it.evidence.author && (
                    <span className="block text-[0.88rem] font-bold text-fg-soft">
                      {it.evidence.author.displayName}
                    </span>
                  )}
                  {it.evidence.content || (
                    <span className="text-fg-soft">
                      {it.targetType === "user"
                        ? "(a person, not a message)"
                        : "(no words, only media)"}
                    </span>
                  )}
                </blockquote>
              )}
              {it.details.length > 0 && (
                <ul className="mt-2 space-y-1 text-[0.92rem] text-fg-soft">
                  {it.details.map((d) => (
                    <li key={d}>"{d}"</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={pill("ghost", "sm")}
                  onClick={() => void decide(it, "dismiss")}
                >
                  Nothing wrong
                </button>
                {TAKE_DOWN[it.targetType] && spaceCan(space, Permission.MANAGE_MESSAGES) && (
                  <button
                    type="button"
                    className={pill(
                      "ghost",
                      "sm",
                      "text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]",
                    )}
                    onClick={() => void decide(it, "remove")}
                  >
                    {TAKE_DOWN[it.targetType]}
                  </button>
                )}
                {it.evidence?.author &&
                  it.evidence.author.id !== myId &&
                  (canTimeout || canBan) && (
                    // The author's name is just above; the buttons say it to screen readers too.
                    <>
                      <span aria-hidden="true" className="mx-1 w-px self-stretch bg-line" />
                      {canTimeout && (
                        <button
                          type="button"
                          className={pill("ghost", "sm")}
                          onClick={() =>
                            it.evidence?.author && void toAuthor(it.evidence.author.id, "timeout")
                          }
                        >
                          <span>
                            Time out
                            <span className="sr-only"> {it.evidence.author.displayName}</span> for a
                            day
                          </span>
                        </button>
                      )}
                      {canBan && (
                        <button
                          type="button"
                          className={pill(
                            "ghost",
                            "sm",
                            "text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]",
                          )}
                          onClick={() =>
                            it.evidence?.author && void toAuthor(it.evidence.author.id, "ban")
                          }
                        >
                          Ban<span className="sr-only"> {it.evidence.author.displayName}</span>
                        </button>
                      )}
                    </>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Activity log ─────────────────────────────────────────────────────────────

const SENTENCE: Record<string, string> = {
  "member.kick": "removed",
  "member.ban": "banned",
  "member.unban": "lifted the ban on",
  "member.timeout": "timed out",
  "member.timeout_lift": "lifted the timeout on",
  "member.roles": "changed the roles of",
  "message.remove": "removed a reported message",
  "report.dismiss": "dismissed a report",
  "role.create": "made a role",
  "role.update": "changed a role",
  "role.delete": "deleted a role",
  "role.reorder": "reordered the roles",
  "automod.update": "changed AutoMod",
  "spark.give": "gave a Spark",
};

function ActivityTab({ space }: { space: SpaceDetail }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  useEffect(() => {
    void api<{ entries: AuditEntry[] }>(`/communities/${space.id}/audit-log`)
      .then((r) => setEntries(r.entries))
      .catch(() => setEntries([]));
  }, [space.id]);
  if (!entries)
    return (
      <p role="status" className="text-fg-soft">
        Loading the activity log…
      </p>
    );
  if (entries.length === 0) return <p className="text-fg-soft">No moderator actions yet.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {entries.map((e) => (
        <li key={e.id} className="py-2.5 text-fg">
          <strong>{e.actor.displayName}</strong> {SENTENCE[e.action] ?? e.action}
          {e.target ? <strong> {e.target.displayName}</strong> : null}
          {e.reason ? <span className="text-fg-soft"> · "{e.reason}"</span> : null}
          <span className="block text-[0.86rem] text-fg-soft">
            {when.format(new Date(e.createdAt))}
          </span>
        </li>
      ))}
    </ul>
  );
}
