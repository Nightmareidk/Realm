"use client";

import type {
  AdminOverview,
  AdminReport,
  AdminUser,
  ReservedHandle,
  StaffAction,
  StaffRole,
  VerificationRequest,
  VerifiedKind,
} from "@realm/contracts";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { pill, textLink } from "@/components/pill";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { Tracks } from "./tracks";

type Tab = "overview" | "accounts" | "verification" | "reports" | "names" | "music" | "record";
const TABS: { id: Tab; label: string; admin?: boolean }[] = [
  { id: "overview", label: "Overview" },
  { id: "accounts", label: "Accounts" },
  { id: "reports", label: "Reports" },
  { id: "verification", label: "Verification", admin: true },
  { id: "names", label: "Kept-back names", admin: true },
  { id: "music", label: "Music library", admin: true },
  { id: "record", label: "Staff record", admin: true },
];

/** What a staff action needs before it goes: a short reason, kept in the record for good. */
interface Ask {
  title: string;
  line?: string;
  confirm: string;
  danger?: boolean;
  /** Ask for a value too (a new username). */
  value?: { label: string; initial: string };
  run: (reason: string, value?: string) => Promise<void>;
}

const message = (err: unknown) =>
  err instanceof ApiError ? err.message : "That didn't work. Try again.";

/**
 * Realm's admin pages: the numbers at a glance, accounts (suspend, verify, staff, rename, sign
 * out), reports to act on, verification requests, famous names kept back, and the record of
 * every staff action. The server checks the role on every request; this page only shows what the
 * role allows.
 */
export function AdminHome() {
  const [role, setRole] = useState<StaffRole | null | "none">(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api<{ role: StaffRole }>("/admin/me")
      .then((r) => setRole(r.role))
      .catch(() => setRole("none"));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (role === null) return <p className="text-fg-soft">Checking your access…</p>;
  if (role === "none") {
    return (
      <div className="rounded-2xl bg-surface p-8">
        <h2 className="font-display text-xl font-bold text-fg">This page is for Realm's staff</h2>
        <p className="mt-2 text-fg-soft">If you should have access, ask an admin to add you.</p>
      </div>
    );
  }

  const tabs = TABS.filter((t) => !t.admin || role === "admin");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Admin sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={pill(tab === t.id ? "action" : "ghost", "sm")}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto rounded-full bg-surface-raised px-3 py-1 text-sm font-bold text-fg-soft">
          You're {role === "admin" ? "an admin" : "a moderator"}
        </span>
      </div>
      <div className="mt-6">
        {tab === "overview" && <Overview onGo={setTab} />}
        {tab === "accounts" && <Accounts role={role} onAsk={setAsk} onDone={setToast} />}
        {tab === "reports" && <Reports onAsk={setAsk} onDone={setToast} />}
        {tab === "verification" && <Verification onAsk={setAsk} onDone={setToast} />}
        {tab === "names" && <Names onDone={setToast} />}
        {tab === "music" && <Tracks onDone={setToast} />}
        {tab === "record" && <Record />}
      </div>
      {ask && <AskDialog ask={ask} onClose={() => setAsk(null)} onDone={setToast} />}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-fg px-5 py-3 font-bold text-bg shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function AskDialog({
  ask,
  onClose,
  onDone,
}: {
  ask: Ask;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [value, setValue] = useState(ask.value?.initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) return setError("Say why, for the record.");
    setBusy(true);
    setError(null);
    try {
      await ask.run(reason.trim(), ask.value ? value.trim() : undefined);
      onDone("Done. It's in the staff record.");
      onClose();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-title"
        onSubmit={submit}
        className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl"
      >
        <h2 id="ask-title" className="font-display text-xl font-bold text-fg">
          {ask.title}
        </h2>
        {ask.line && <p className="mt-2 text-fg-soft">{ask.line}</p>}
        {ask.value && (
          <label className="mt-4 block">
            <span className="text-sm font-bold text-fg">{ask.value.label}</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl bg-surface-raised px-3 text-fg outline-none focus:ring-2 focus:ring-[var(--r-accent)]"
            />
          </label>
        )}
        <label className="mt-4 block">
          <span className="text-sm font-bold text-fg">Why (kept in the staff record)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            className="mt-1 w-full rounded-xl bg-surface-raised p-3 text-fg outline-none focus:ring-2 focus:ring-[var(--r-accent)]"
          />
        </label>
        {error && (
          <p className="mt-3 font-bold text-[var(--r-danger,#ff6b6b)]" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={pill("ghost", "md")}>
            Cancel
          </button>
          <button type="submit" aria-disabled={busy} className={pill("action", "md")}>
            {busy ? "Saving…" : ask.confirm}
          </button>
        </div>
      </form>
    </div>
  );
}

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    api<T>(path)
      .then(setData)
      .catch((err) => setError(message(err)));
  }, [path]);
  useEffect(load, [load]);
  return { data, error, load };
}

function Stat({ label, n, onClick }: { label: string; n: number; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx("rounded-2xl bg-surface p-5 text-left", onClick && "hover:bg-surface-raised")}
    >
      <div className="font-display text-3xl font-bold text-fg tabular-nums">
        {n.toLocaleString()}
      </div>
      <div className="mt-1 text-sm font-bold text-fg-soft">{label}</div>
    </Tag>
  );
}

function Overview({ onGo }: { onGo: (t: Tab) => void }) {
  const { data, error } = useLoad<AdminOverview>("/admin/overview");
  if (error) return <p className="text-fg-soft">{error}</p>;
  if (!data) return <p className="text-fg-soft">Loading…</p>;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Stat label="Accounts" n={data.users} onClick={() => onGo("accounts")} />
      <Stat label="New today" n={data.newToday} />
      <Stat label="Posts" n={data.posts} />
      <Stat label="Open reports" n={data.openReports} onClick={() => onGo("reports")} />
      <Stat
        label="Asking to be verified"
        n={data.pendingVerifications}
        onClick={() => onGo("verification")}
      />
      <Stat label="Suspended" n={data.suspended} />
    </div>
  );
}

function Badge({
  children,
  tone = "soft",
}: {
  children: ReactNode;
  tone?: "soft" | "blue" | "red" | "mint";
}) {
  const tones = {
    soft: "bg-surface-raised text-fg-soft",
    blue: "bg-[#3b9cff]/20 text-[#8cc4ff]",
    red: "bg-[#ff3040]/20 text-[#ff8a95]",
    mint: "bg-[#7ef2c4]/20 text-[#7ef2c4]",
  };
  return (
    <span className={cx("rounded-full px-2 py-0.5 text-xs font-bold", tones[tone])}>
      {children}
    </span>
  );
}

function Accounts({
  role,
  onAsk,
  onDone,
}: {
  role: StaffRole;
  onAsk: (a: Ask) => void;
  onDone: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "staff" | "suspended">("all");
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ filter, ...(q.trim() ? { q: q.trim() } : {}) });
    api<{ items: AdminUser[] }>(`/admin/users?${params}`)
      .then((r) => {
        setItems(r.items);
        setError(null);
      })
      .catch((err) => setError(message(err)));
  }, [q, filter]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const change = (
    u: AdminUser,
    body: Record<string, unknown>,
    title: string,
    line: string,
    confirm: string,
    danger = false,
  ) =>
    onAsk({
      title,
      line,
      confirm,
      danger,
      run: async (reason) => {
        await api(`/admin/users/${u.user.id}`, { method: "PATCH", body: { ...body, reason } });
        load();
      },
    });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={role === "admin" ? "Name, @username or email" : "Name or @username"}
          aria-label="Search accounts"
          className="h-11 min-w-[16rem] flex-1 rounded-xl bg-surface px-4 text-fg outline-none focus:ring-2 focus:ring-[var(--r-accent)]"
        />
        {(["all", "verified", "staff", "suspended"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={pill(filter === f ? "action" : "ghost", "sm")}
            aria-pressed={filter === f}
          >
            {f === "all" ? "All" : f[0]?.toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-fg-soft">{error}</p>}
      <ul className="mt-4 divide-y divide-[var(--r-border)] rounded-2xl bg-surface">
        {items?.map((u) => (
          <li key={u.user.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/@${u.user.username}`} className="font-bold text-fg hover:underline">
                  {u.user.displayName}
                </a>
                <span className="text-fg-soft">@{u.user.username}</span>
                {u.verified && (
                  <Badge tone={u.verified === "official" ? "mint" : "blue"}>
                    Verified · {u.verified}
                  </Badge>
                )}
                {u.staff && <Badge tone="mint">{u.staff}</Badge>}
                {u.status === "suspended" && <Badge tone="red">Suspended</Badge>}
                {u.teen && <Badge>Under 18</Badge>}
                {u.accountKind === "business" && <Badge>Business</Badge>}
              </div>
              <div className="mt-1 text-sm text-fg-soft">
                {u.email && (
                  <>
                    {u.email}
                    {u.emailVerified ? "" : " (not confirmed)"} ·{" "}
                  </>
                )}
                {u.followers} followers · {u.posts} posts · {u.reportsAgainst} reports · joined{" "}
                {new Date(u.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {u.status === "suspended" ? (
                <button
                  type="button"
                  className={pill("ghost", "sm")}
                  onClick={() =>
                    change(
                      u,
                      { status: "active" },
                      `Let @${u.user.username} back in?`,
                      "They can sign in again.",
                      "Unsuspend",
                    )
                  }
                >
                  Unsuspend
                </button>
              ) : (
                <button
                  type="button"
                  className={pill("ghost", "sm")}
                  onClick={() =>
                    change(
                      u,
                      { status: "suspended" },
                      `Suspend @${u.user.username}?`,
                      "They're signed out everywhere and can't sign in until unsuspended.",
                      "Suspend",
                      true,
                    )
                  }
                >
                  Suspend
                </button>
              )}
              {role === "admin" && (
                <>
                  {u.verified ? (
                    <button
                      type="button"
                      className={pill("ghost", "sm")}
                      onClick={() =>
                        change(
                          u,
                          { verified: null },
                          `Remove @${u.user.username}'s badge?`,
                          "Their kept-back name stays theirs.",
                          "Remove badge",
                        )
                      }
                    >
                      Remove badge
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={pill("ghost", "sm")}
                        onClick={() =>
                          change(
                            u,
                            { verified: "notable" satisfies VerifiedKind },
                            `Verify @${u.user.username} as a notable person?`,
                            "The blue badge shows next to their name everywhere.",
                            "Verify",
                          )
                        }
                      >
                        Verify person
                      </button>
                      <button
                        type="button"
                        className={pill("ghost", "sm")}
                        onClick={() =>
                          change(
                            u,
                            { verified: "business" satisfies VerifiedKind },
                            `Verify @${u.user.username} as a business?`,
                            "The blue badge shows next to their name everywhere.",
                            "Verify",
                          )
                        }
                      >
                        Verify business
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={pill("ghost", "sm")}
                    onClick={() =>
                      onAsk({
                        title: `Change @${u.user.username}'s username`,
                        line: "Staff can give a kept-back famous name, but only to a verified account.",
                        confirm: "Change it",
                        value: { label: "New username", initial: u.user.username },
                        run: async (reason, value) => {
                          await api(`/admin/users/${u.user.id}`, {
                            method: "PATCH",
                            body: { username: value, reason },
                          });
                          load();
                        },
                      })
                    }
                  >
                    Rename
                  </button>
                  <select
                    aria-label={`Staff role for @${u.user.username}`}
                    value={u.staff ?? "none"}
                    onChange={(e) => {
                      const next = e.target.value === "none" ? null : e.target.value;
                      change(
                        u,
                        { staff: next },
                        next
                          ? `Make @${u.user.username} ${next === "admin" ? "an admin" : "a moderator"}?`
                          : `Remove @${u.user.username} from staff?`,
                        next === "admin"
                          ? "Admins can do everything here, including choosing staff."
                          : next
                            ? "Moderators handle reports and suspensions."
                            : "They lose access to these pages.",
                        "Save",
                      );
                    }}
                    className="h-9 rounded-full bg-surface-raised px-3 text-sm font-bold text-fg"
                  >
                    <option value="none">Not staff</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    className={pill("quiet", "sm")}
                    onClick={() =>
                      onAsk({
                        title: `Sign @${u.user.username} out everywhere?`,
                        line: "Every phone and browser they're signed in on.",
                        confirm: "Sign out",
                        run: async (reason) => {
                          await api(`/admin/users/${u.user.id}/sign-out`, { body: { reason } });
                        },
                      })
                    }
                  >
                    Sign out everywhere
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {items && items.length === 0 && <li className="p-6 text-fg-soft">Nobody matches that.</li>}
      </ul>
      {!items && !error && <p className="mt-4 text-fg-soft">Loading…</p>}
      <span className="sr-only" aria-live="polite">
        {items ? `${items.length} accounts` : ""}
      </span>
      <button type="button" className="sr-only" onClick={() => onDone("Refreshed")}>
        Refresh
      </button>
    </div>
  );
}

function Reports({ onAsk }: { onAsk: (a: Ask) => void; onDone: (m: string) => void }) {
  const [status, setStatus] = useState<"open" | "actioned" | "dismissed">("open");
  const { data, error, load } = useLoad<{ items: AdminReport[] }>(
    `/admin/reports?status=${status}`,
  );
  const act = (r: AdminReport, action: "dismiss" | "remove" | "remove_and_suspend") =>
    onAsk({
      title:
        action === "dismiss"
          ? "Dismiss this report?"
          : action === "remove"
            ? "Take it down?"
            : "Take it down and suspend them?",
      line:
        action === "dismiss"
          ? "Nothing changes for the person reported. Other open reports on the same thing close too."
          : action === "remove"
            ? "It's hidden for everyone. Other open reports on the same thing close too."
            : "It's hidden, and they're signed out and can't sign in until unsuspended.",
      confirm:
        action === "dismiss"
          ? "Dismiss"
          : action === "remove"
            ? "Take down"
            : "Take down and suspend",
      danger: action !== "dismiss",
      run: async (reason) => {
        await api(`/admin/reports/${r.id}`, { body: { action, reason } });
        load();
      },
    });
  return (
    <div>
      <div className="flex gap-2">
        {(["open", "actioned", "dismissed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={pill(status === s ? "action" : "ghost", "sm")}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
          >
            {s === "open" ? "Open" : s === "actioned" ? "Acted on" : "Dismissed"}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-fg-soft">{error}</p>}
      <ul className="mt-4 space-y-3">
        {data?.items.map((r) => (
          <li key={r.id} className="rounded-2xl bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="red">{r.reason.replaceAll("_", " ")}</Badge>
              <Badge>{r.targetType}</Badge>
              <span className="text-sm text-fg-soft">
                reported by @{r.reporter.username} · {new Date(r.createdAt).toLocaleString()}
              </span>
            </div>
            {r.owner && (
              <p className="mt-2 text-fg">
                About{" "}
                <a className={textLink} href={`/@${r.owner.username}`}>
                  @{r.owner.username}
                </a>
              </p>
            )}
            {typeof r.evidence.content === "string" && r.evidence.content && (
              <blockquote className="mt-2 rounded-xl bg-surface-raised p-3 text-fg">
                {r.evidence.content}
              </blockquote>
            )}
            {r.details && <p className="mt-2 text-fg-soft">"{r.details}"</p>}
            {r.status === "open" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={pill("ghost", "sm")}
                  onClick={() => act(r, "dismiss")}
                >
                  Dismiss
                </button>
                {r.targetType !== "user" && (
                  <button
                    type="button"
                    className={pill("ghost", "sm")}
                    onClick={() => act(r, "remove")}
                  >
                    Take down
                  </button>
                )}
                <button
                  type="button"
                  className={pill("action", "sm")}
                  onClick={() => act(r, "remove_and_suspend")}
                >
                  {r.targetType === "user" ? "Suspend account" : "Take down and suspend"}
                </button>
              </div>
            )}
          </li>
        ))}
        {data && data.items.length === 0 && (
          <li className="rounded-2xl bg-surface p-6 text-fg-soft">Nothing here.</li>
        )}
      </ul>
    </div>
  );
}

function Verification({ onAsk }: { onAsk: (a: Ask) => void; onDone: (m: string) => void }) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const { data, error, load } = useLoad<{ items: VerificationRequest[] }>(
    `/admin/verification?status=${status}`,
  );
  const decide = (r: VerificationRequest, approve: boolean) =>
    onAsk({
      title: approve ? `Verify @${r.user.username}?` : `Turn down @${r.user.username}?`,
      line: approve
        ? `As ${r.kind === "business" ? "a business" : "a notable person"}: the badge shows at once.`
        : "Your reason is shown to them. They can ask again in a month.",
      confirm: approve ? "Verify" : "Turn down",
      run: async (reason) => {
        await api(`/admin/verification/${r.id}`, { body: { approve, reason } });
        load();
      },
    });
  return (
    <div>
      <div className="flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={pill(status === s ? "action" : "ghost", "sm")}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
          >
            {s === "pending" ? "Waiting" : s === "approved" ? "Verified" : "Turned down"}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-fg-soft">{error}</p>}
      <ul className="mt-4 space-y-3">
        {data?.items.map((r) => (
          <li key={r.id} className="rounded-2xl bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-fg">{r.realName}</span>
              <Badge tone="blue">{r.kind === "business" ? "Business" : "Notable person"}</Badge>
              <Badge>{r.category}</Badge>
              <span className="text-sm text-fg-soft">
                @{r.user.username} · {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </div>
            <ul className="mt-3 space-y-1">
              {r.links.map((l) => (
                <li key={l}>
                  <a
                    className={cx(textLink, "break-all")}
                    href={l}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
            {r.note && <p className="mt-2 text-fg-soft">"{r.note}"</p>}
            {r.reason && <p className="mt-2 text-fg-soft">Answer: {r.reason}</p>}
            {r.status === "pending" && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className={pill("ghost", "sm")}
                  onClick={() => decide(r, false)}
                >
                  Turn down
                </button>
                <button
                  type="button"
                  className={pill("action", "sm")}
                  onClick={() => decide(r, true)}
                >
                  Verify
                </button>
              </div>
            )}
          </li>
        ))}
        {data && data.items.length === 0 && (
          <li className="rounded-2xl bg-surface p-6 text-fg-soft">Nothing here.</li>
        )}
      </ul>
    </div>
  );
}

function Names({ onDone }: { onDone: (m: string) => void }) {
  const [q, setQ] = useState("");
  const { data, error, load } = useLoad<{ items: ReservedHandle[]; builtInCount: number }>(
    `/admin/reserved${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
  );
  const [handle, setHandle] = useState("");
  const [label, setLabel] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/admin/reserved", { body: { handle, label } });
      setHandle("");
      setLabel("");
      setProblem(null);
      onDone(`Kept back: ${handle}`);
      load();
    } catch (err) {
      setProblem(message(err));
    }
  }
  async function remove(h: string) {
    try {
      await api(`/admin/reserved/${encodeURIComponent(h)}`, { method: "DELETE" });
      onDone(`Released: ${h}`);
      load();
    } catch (err) {
      setProblem(message(err));
    }
  }
  return (
    <div>
      <p className="max-w-[60ch] text-fg-soft">
        Nobody can sign up as these names or near copies of them ("the_real_ninja",
        "ninja.official"). Staff give one to the right verified account by renaming it.{" "}
        {data ? `${data.builtInCount} famous names are built in.` : ""}
      </p>
      <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Name to keep, like ninja"
          aria-label="Name to keep back"
          className="h-11 rounded-xl bg-surface px-4 text-fg"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Who it's for, like Ninja"
          aria-label="Who it's for"
          className="h-11 rounded-xl bg-surface px-4 text-fg"
        />
        <button type="submit" className={pill("action", "md")}>
          Keep it back
        </button>
      </form>
      {problem && <p className="mt-2 font-bold text-[#ff8a95]">{problem}</p>}
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search kept-back names"
        aria-label="Search kept-back names"
        className="mt-6 h-11 w-full max-w-sm rounded-xl bg-surface px-4 text-fg"
      />
      {error && <p className="mt-4 text-fg-soft">{error}</p>}
      <ul className="mt-4 divide-y divide-[var(--r-border)] rounded-2xl bg-surface">
        {data?.items.map((h) => (
          <li key={`${h.builtIn}-${h.handle}`} className="flex items-center gap-3 p-4">
            <span className="font-bold text-fg">{h.handle}</span>
            <span className="text-fg-soft">{h.label}</span>
            {h.builtIn && <Badge>Built in</Badge>}
            {h.claimedBy && <Badge tone="blue">Given to @{h.claimedBy.username}</Badge>}
            {!h.builtIn && (
              <button
                type="button"
                className={cx(pill("quiet", "sm"), "ml-auto")}
                onClick={() => remove(h.handle)}
              >
                Release
              </button>
            )}
          </li>
        ))}
        {data && data.items.length === 0 && (
          <li className="p-6 text-fg-soft">
            {q ? "None match." : "Search to see the built-in names, or add one."}
          </li>
        )}
      </ul>
    </div>
  );
}

function Record() {
  const { data, error } = useLoad<{ items: StaffAction[] }>("/admin/log");
  if (error) return <p className="text-fg-soft">{error}</p>;
  if (!data) return <p className="text-fg-soft">Loading…</p>;
  return (
    <ul className="divide-y divide-[var(--r-border)] rounded-2xl bg-surface">
      {data.items.map((a) => (
        <li key={a.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-fg">@{a.actor.username}</span>
            <Badge>{a.action}</Badge>
            <span className="text-fg-soft">
              {a.targetType} {a.targetId}
            </span>
            <span className="ml-auto text-sm text-fg-soft">
              {new Date(a.createdAt).toLocaleString()}
            </span>
          </div>
          {a.reason && <p className="mt-1 text-fg-soft">"{a.reason}"</p>}
          {Object.keys(a.detail).length > 0 && (
            <pre className="mt-2 overflow-x-auto rounded-xl bg-surface-raised p-3 text-xs text-fg-soft">
              {JSON.stringify(a.detail, null, 2)}
            </pre>
          )}
        </li>
      ))}
      {data.items.length === 0 && <li className="p-6 text-fg-soft">No staff actions yet.</li>}
    </ul>
  );
}
