"use client";

import {
  ArrowCounterClockwise,
  DownloadSimple,
  Flag,
  PaintBrushBroad,
  Question,
  Star,
  Storefront,
  UploadSimple,
} from "@phosphor-icons/react";
import {
  type ResolvedTheme,
  resolveTheme,
  type ThemeDetail,
  type ThemeFile,
  type ThemeLook,
  type ThemePage,
  type ThemePayments,
  type ThemeSummary,
  type ThemeTag,
} from "@realm/contracts";
import { LOOKS, lookTheme, THEME_ORDER, type ThemeId, themes } from "@realm/design-tokens";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pill, textLink } from "@/components/pill";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { openThemeFile, PackageError, saveThemePackage } from "./package";
import { ThemePreview } from "./preview";
import { useThemes } from "./theme-context";

export const price = (cents: number) => (cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`);
const say = (err: unknown, fallback: string) =>
  err instanceof ApiError || err instanceof PackageError ? err.message : fallback;

/** A small fetch-and-hold for one API path. */
function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (err) {
      setError(say(err, "That didn't load. Try again."));
    }
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, setData, error, reload: load };
}

function Section({ title, children, lead }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-7 pb-8 first:border-t-0 first:pt-0">
      <h2 className="font-display text-[1.3rem] font-bold text-fg">{title}</h2>
      {lead && <p className="mt-1 max-w-[60ch] text-fg-soft">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ── Settings › Themes ──────────────────────────────────────────────────────────

/**
 * Settings › Themes: Realm's three looks (Now Playing is the default), your colour, your themes,
 * and the doors to the store, the maker, adding a file, and the guide.
 */
export function ThemesHome() {
  const { mine, choose, previewing, preview } = useThemes();
  const library = useLoad<{ items: ThemeSummary[] }>("/themes/library");
  const [problem, setProblem] = useState<string | null>(null);
  const active = mine?.active;
  const accent: ThemeId = active?.kind === "look" ? active.accent : "mint";
  const looks = useMemo(
    () => LOOKS.map((l) => ({ ...l, theme: resolveTheme(lookTheme(l.id, accent)) })),
    [accent],
  );
  const run = async (fn: () => Promise<void>) => {
    try {
      setProblem(null);
      await fn();
    } catch (err) {
      setProblem(say(err, "The theme didn't change. Try again."));
    }
  };
  const pickLibrary = (item: ThemeSummary) =>
    run(async () => {
      const { file } = await api<{ file: ThemeFile }>(`/themes/${item.id}/file`);
      await choose({ kind: "theme", themeId: item.id }, file);
    });

  return (
    <div>
      {previewing && (
        <p className="mb-6 flex items-center gap-3 rounded-2xl bg-surface-raised px-4 py-3 font-bold text-fg">
          You're trying a theme on.
          <button type="button" className={cx(textLink, "ml-auto")} onClick={() => preview(null)}>
            Stop trying
          </button>
        </p>
      )}
      <p role="status" className="mb-4 font-bold text-danger empty:hidden">
        {problem}
      </p>
      <Section
        title="Realm's looks"
        lead="Buttons, messages and safety labels always work the same."
      >
        <fieldset aria-label="Realm's looks" className="grid gap-4 sm:grid-cols-3">
          {looks.map((l) => {
            const on = active?.kind === "look" && active.look === l.id;
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={on}
                onClick={() => run(() => choose({ kind: "look", look: l.id, accent }))}
                className={cx(
                  "grid gap-3 rounded-[1.25rem] bg-surface-raised p-3 text-left ring-2 transition-shadow",
                  on ? "ring-fg" : "ring-transparent hover:ring-line-strong",
                )}
              >
                <ThemePreview theme={l.theme} width={196} wide />
                <span>
                  <span className="block font-bold text-fg">
                    {l.name}
                    {l.id === "now-playing" && (
                      <span className="ml-2 text-[0.85rem] text-fg-soft">Default</span>
                    )}
                  </span>
                  <span className="mt-1 block text-[0.92rem] leading-snug text-fg-soft">
                    {l.blurb}
                  </span>
                </span>
              </button>
            );
          })}
        </fieldset>
      </Section>

      {active?.kind === "look" && (
        <Section
          title="Your colour"
          lead="The colour of what you press and the light behind every screen."
        >
          <fieldset aria-label="Your colour" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {THEME_ORDER.map((id) => {
              const [l1, l2, l3] = themes[id].lights;
              const on = id === accent;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => run(() => choose({ kind: "look", look: active.look, accent: id }))}
                  className={cx("rounded-2xl p-1 ring-2", on ? "ring-fg" : "ring-transparent")}
                >
                  <span
                    className="flex h-16 items-end rounded-xl p-2 font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${l1}, ${l2}, ${l3})` }}
                  >
                    {themes[id].name}
                  </span>
                </button>
              );
            })}
          </fieldset>
        </Section>
      )}

      <Section title="Your themes" lead="Themes you made, got or bought.">
        {library.data?.items.length ? (
          <ul className="grid gap-2">
            {library.data.items.map((item) => {
              const on = active?.kind === "theme" && active.themeId === item.id;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl px-2 py-2 hover:bg-surface-raised"
                >
                  <ThemePreview theme={resolveTheme(item.file)} width={44} />
                  <Link href={`/themes/${item.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-fg">{item.name}</span>
                    <span className="block text-[0.92rem] text-fg-soft">
                      {item.mine ? "Made by you" : `by @${item.creator.username}`}
                    </span>
                  </Link>
                  {on ? (
                    <span className="px-3 font-bold text-fg-soft">Using</span>
                  ) : (
                    <button
                      type="button"
                      className={pill("ghost", "sm")}
                      onClick={() => pickLibrary(item)}
                    >
                      Use
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-fg-soft">
            {library.error ?? (library.data ? "Nothing here yet." : "Loading…")}
          </p>
        )}
      </Section>

      <Section title="More">
        <div className="grid gap-2 sm:grid-cols-2">
          <Door
            href="/themes/store"
            icon={<Storefront size={22} />}
            title="More themes"
            line="Themes people made, free and paid"
          />
          <Door
            href="/themes/studio"
            icon={<PaintBrushBroad size={22} />}
            title="Make your own"
            line="Colours, wallpaper, stickers, effects and more"
          />
          <Door
            href="/themes/add"
            icon={<UploadSimple size={22} />}
            title="Add your own theme"
            line="Open a .realmtheme package or a theme.json"
          />
          <Door
            href="/themes/guide"
            icon={<Question size={22} />}
            title="How to make a theme"
            line="The guide, with every option explained"
          />
          {active?.kind === "theme" && (
            <button
              type="button"
              onClick={() =>
                run(() => choose({ kind: "look", look: "now-playing", accent: "mint" }))
              }
              className="flex items-center gap-4 rounded-2xl px-3 py-3 text-left hover:bg-surface-raised"
            >
              <span className="grid size-11 place-items-center rounded-full bg-surface-raised text-fg">
                <ArrowCounterClockwise size={22} />
              </span>
              <span>
                <span className="block font-bold text-fg">Back to Realm's default</span>
                <span className="block text-[0.92rem] text-fg-soft">Now Playing in Mint</span>
              </span>
            </button>
          )}
        </div>
      </Section>
    </div>
  );
}

function Door({
  href,
  icon,
  title,
  line,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  line: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl px-3 py-3 hover:bg-surface-raised"
    >
      <span className="grid size-11 flex-none place-items-center rounded-full bg-surface-raised text-fg">
        {icon}
      </span>
      <span>
        <span className="block font-bold text-fg">{title}</span>
        <span className="block text-[0.92rem] text-fg-soft">{line}</span>
      </span>
    </Link>
  );
}

// ── The store ────────────────────────────────────────────────────────────────────

const TAGS: [ThemeTag, string][] = [
  ["dark", "Dark"],
  ["light", "Light"],
  ["colourful", "Colourful"],
  ["cute", "Cute"],
  ["gaming", "Gaming"],
  ["anime", "Anime"],
  ["minimal", "Minimal"],
  ["calm", "Calm"],
  ["bold", "Bold"],
  ["retro", "Retro"],
  ["nature", "Nature"],
  ["music", "Music"],
  ["seasonal", "Seasonal"],
  ["high-contrast", "High contrast"],
];

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "h-9 rounded-full px-3.5 text-[0.9rem] font-bold transition-colors",
        on
          ? "bg-fg text-base"
          : "text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)] hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/** "More themes": search, sort, filters, and a grid of cards drawn from each theme. */
export function StoreView() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"popular" | "new" | "top">("popular");
  const [priceFilter, setPrice] = useState<"all" | "free" | "paid">("all");
  const [look, setLook] = useState<ThemeLook | null>(null);
  const [tag, setTag] = useState<ThemeTag | null>(null);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ThemeSummary[]>([]);
  const [more, setMore] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | string>("loading");
  const asked = useRef(0);

  const load = useCallback(
    async (p: number) => {
      const ticket = ++asked.current;
      setState("loading");
      const params = new URLSearchParams({ sort, price: priceFilter, page: String(p) });
      if (q.trim()) params.set("q", q.trim());
      if (look) params.set("look", look);
      if (tag) params.set("tag", tag);
      try {
        const res = await api<ThemePage>(`/themes?${params}`);
        if (ticket !== asked.current) return;
        setItems((prev) => (p === 0 ? res.items : [...prev, ...res.items]));
        setMore(res.more);
        setPage(p);
        setState("ready");
      } catch (err) {
        if (ticket === asked.current) setState(say(err, "The store didn't load. Try again."));
      }
    },
    [q, sort, priceFilter, look, tag],
  );
  useEffect(() => {
    const wait = setTimeout(() => load(0), q ? 300 : 0);
    return () => clearTimeout(wait);
  }, [load, q]);

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="grid content-start gap-5" aria-label="Filters">
        <label className="block">
          <span className="sr-only">Search themes</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={60}
            placeholder="Search themes"
            className="h-11 w-full rounded-full bg-surface-raised px-4 text-fg placeholder:text-fg-soft"
          />
        </label>
        {[
          [
            "Sort",
            [
              ["popular", "Popular"],
              ["new", "New"],
              ["top", "Top rated"],
            ],
            sort,
            (v: string) => setSort(v as typeof sort),
          ],
          [
            "Price",
            [
              ["all", "All"],
              ["free", "Free"],
              ["paid", "Paid"],
            ],
            priceFilter,
            (v: string) => setPrice(v as typeof priceFilter),
          ],
          [
            "Look",
            [["", "All looks"], ...LOOKS.map((l) => [l.id, l.name])],
            look ?? "",
            (v: string) => setLook((v || null) as ThemeLook | null),
          ],
        ].map(([label, opts, value, set]) => (
          <fieldset key={label as string}>
            <legend className="mb-2 text-[0.9rem] font-bold text-fg-soft">{label as string}</legend>
            <div className="flex flex-wrap gap-2">
              {(opts as string[][]).map(([v, text]) => (
                <Chip
                  key={v}
                  on={value === v}
                  onClick={() => (set as (v: string) => void)(v as string)}
                >
                  {text}
                </Chip>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend className="mb-2 text-[0.9rem] font-bold text-fg-soft">Tags</legend>
          <div className="flex flex-wrap gap-2">
            {TAGS.map(([v, text]) => (
              <Chip key={v} on={tag === v} onClick={() => setTag(tag === v ? null : v)}>
                {text}
              </Chip>
            ))}
          </div>
        </fieldset>
      </aside>
      <div>
        {items.length ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/themes/${item.id}`}
                  className="grid gap-2 rounded-[1.25rem] bg-surface-raised p-3 hover:ring-2 hover:ring-line-strong"
                >
                  <ThemePreview theme={resolveTheme(item.file)} width={240} wide />
                  <span className="truncate font-bold text-fg">{item.name}</span>
                  <span className="flex items-center justify-between text-[0.9rem] text-fg-soft">
                    <span className="truncate">@{item.creator.username}</span>
                    <span className="flex items-center gap-2">
                      {item.rating ? (
                        <span className="flex items-center gap-1">
                          <Star size={14} weight="fill" aria-hidden="true" />
                          {item.rating.toFixed(1)}
                        </span>
                      ) : null}
                      <span className="font-bold text-fg">
                        {item.owned ? "Yours" : price(item.priceCents)}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-[1.25rem] px-6 py-14 text-center">
            <p className="font-display text-[1.4rem] font-bold text-fg">
              {state === "loading"
                ? "Loading themes…"
                : state === "ready"
                  ? "No themes here yet"
                  : state}
            </p>
            {state === "ready" && (
              <p className="mt-2 text-fg-soft">
                Be the first:{" "}
                <Link className={textLink} href="/themes/studio">
                  make a theme
                </Link>{" "}
                and share it.
              </p>
            )}
          </div>
        )}
        {more && (
          <div className="mt-8 text-center">
            <button type="button" className={pill("ghost", "md")} onClick={() => load(page + 1)}>
              Show more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── One theme ────────────────────────────────────────────────────────────────────

const REPORTS: [string, string][] = [
  ["not-their-art", "Uses art that isn't theirs"],
  ["offensive", "Hateful or offensive"],
  ["sexual", "Sexual content"],
  ["broken", "Hard to read or broken"],
  ["spam", "Spam"],
  ["scam", "A scam"],
  ["other", "Something else"],
];

/** One theme: previews, its maker, rating, and everything you can do with it. */
export function ThemeView({ id }: { id: string }) {
  const router = useRouter();
  const { mine, choose, preview, previewing } = useThemes();
  const theme = useLoad<ThemeDetail>(`/themes/${id}`);
  const payments = useLoad<ThemePayments>("/themes/payments");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");
  const [reporting, setReporting] = useState(false);

  if (!theme.data) return <p className="text-fg-soft">{theme.error ?? "Loading…"}</p>;
  const d = theme.data;
  const resolved = resolveTheme(d.file);
  const using = mine?.active.kind === "theme" && mine.active.themeId === d.id;
  const act = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      setNote(say(err, "That didn't work. Try again."));
    } finally {
      setBusy(null);
    }
  };
  const use = () =>
    act("use", async () => {
      const { file } = await api<{ file: ThemeFile }>(`/themes/${d.id}/file`);
      await choose({ kind: "theme", themeId: d.id }, file);
    });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <div className="flex flex-wrap items-end gap-5">
          <ThemePreview theme={resolved} width={200} />
          <ThemePreview theme={resolved} width={340} wide />
        </div>
        {d.description && (
          <p className="mt-8 max-w-[60ch] text-[1.05rem] text-fg-soft">{d.description}</p>
        )}
        {d.versions.length > 1 && (
          <Section title="What's new">
            <ul className="grid gap-2 text-fg-soft">
              {d.versions.slice(0, 5).map((v) => (
                <li key={v.number}>
                  <b className="text-fg">Version {v.number}.</b> {v.changelog ?? "Small changes."}
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title="Reviews">
          {d.owned && !d.mine && (
            <form
              className="mb-6 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                act("review", async () => {
                  theme.setData(
                    await api<ThemeDetail>(`/themes/${d.id}/review`, {
                      method: "PUT",
                      body: {
                        stars: stars || d.myReview?.stars || 5,
                        ...(review.trim() ? { text: review.trim() } : {}),
                      },
                    }),
                  );
                  setReview("");
                });
              }}
            >
              <fieldset aria-label="Your stars" className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={stars === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setStars(n)}
                    className="text-fg"
                  >
                    <Star
                      size={26}
                      weight={n <= (stars || d.myReview?.stars || 0) ? "fill" : "regular"}
                    />
                  </button>
                ))}
              </fieldset>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={d.myReview?.text ?? "What do you like about it? (optional)"}
                className="rounded-[0.9rem] p-3 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] placeholder:text-fg-soft"
              />
              <button
                type="submit"
                className={pill("ghost", "md", "justify-self-start")}
                aria-disabled={busy === "review"}
              >
                {d.myReview ? "Update review" : "Send review"}
              </button>
            </form>
          )}
          {d.reviews.length ? (
            <ul className="grid gap-4">
              {d.reviews.map((r) => (
                <li key={r.author.id} className="border-b border-line pb-4">
                  <b className="text-fg">@{r.author.username}</b>{" "}
                  <span className="text-fg-soft">
                    <span aria-hidden="true">{"★".repeat(r.stars)}</span>
                    <span className="sr-only">{r.stars} of 5 stars</span>
                  </span>
                  {r.text && <p className="mt-1 text-fg-soft">{r.text}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-soft">No reviews yet.</p>
          )}
        </Section>
      </div>

      <aside className="grid content-start gap-4">
        <h1 className="font-display text-[2rem] leading-tight font-bold text-fg">{d.name}</h1>
        <p className="text-fg-soft">
          by{" "}
          <Link href={`/u/${d.creator.username}`} className={textLink}>
            @{d.creator.username}
          </Link>
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.95rem] text-fg-soft">
          {d.rating ? (
            <span>
              ★ {d.rating.toFixed(1)} ({d.ratingCount})
            </span>
          ) : null}
          <span>{d.installs === 1 ? "1 person uses it" : `${d.installs} people use it`}</span>
          <span>Version {d.version}</span>
        </p>
        <p role="status" className="font-bold text-danger empty:hidden">
          {note}
        </p>
        {d.mine ? (
          <>
            <p className="text-fg-soft">
              {d.status === "published"
                ? "In the store."
                : d.status === "hidden"
                  ? "Hidden after reports. People who have it keep it."
                  : "Only you can see it."}
            </p>
            <button
              type="button"
              className={pill("action", "md")}
              onClick={use}
              aria-disabled={busy === "use"}
            >
              {using ? "Using it now" : "Use it"}
            </button>
            <Link href={`/themes/studio?id=${d.id}`} className={pill("ghost", "md")}>
              Edit
            </Link>
            {(d.status === "draft" || d.status === "published") && (
              <button
                type="button"
                className={pill("ghost", "md")}
                onClick={() =>
                  act("publish", async () =>
                    theme.setData(
                      await api<ThemeDetail>(
                        `/themes/${d.id}/${d.status === "published" ? "unpublish" : "publish"}`,
                        { method: "POST" },
                      ),
                    ),
                  )
                }
              >
                {d.status === "published" ? "Take it out of the store" : "Share in the store"}
              </button>
            )}
            <PriceEditor theme={d} payments={payments.data} onSaved={theme.setData} />
          </>
        ) : d.owned ? (
          <>
            <button
              type="button"
              className={pill("action", "md")}
              onClick={use}
              aria-disabled={busy === "use"}
            >
              {using ? "Using it now" : "Use this theme"}
            </button>
            <button
              type="button"
              className={pill("quiet", "md")}
              onClick={() =>
                act("drop", async () => {
                  await api(`/themes/${d.id}/library`, { method: "DELETE" });
                  theme.reload();
                })
              }
            >
              Remove from my themes
            </button>
          </>
        ) : d.priceCents === 0 ? (
          <button
            type="button"
            className={pill("action", "md")}
            aria-disabled={busy === "get"}
            onClick={() =>
              act("get", async () => {
                theme.setData(await api<ThemeDetail>(`/themes/${d.id}/get`, { method: "POST" }));
                const { file } = await api<{ file: ThemeFile }>(`/themes/${d.id}/file`);
                await choose({ kind: "theme", themeId: d.id }, file);
              })
            }
          >
            Get it, free
          </button>
        ) : payments.data?.enabled ? (
          <button
            type="button"
            className={pill("action", "md")}
            onClick={() =>
              act("buy", async () => {
                const { checkoutUrl } = await api<{ checkoutUrl: string }>(`/themes/${d.id}/buy`, {
                  method: "POST",
                });
                if (/^https:\/\//.test(checkoutUrl)) window.location.assign(checkoutUrl);
              })
            }
          >
            Buy for {price(d.priceCents)}
          </button>
        ) : (
          <p className="text-fg-soft">
            {price(d.priceCents)}. Buying themes isn't switched on yet. Free themes work now.
          </p>
        )}
        {!using && (
          <button
            type="button"
            className={pill("ghost", "md")}
            onClick={() => preview(previewing ? null : resolved)}
          >
            {previewing ? "Stop trying it on" : "Try it on"}
          </button>
        )}
        {(d.owned || d.mine || d.priceCents === 0) && (
          <button
            type="button"
            className={cx(textLink, "flex items-center gap-2 justify-self-start")}
            onClick={() =>
              act("file", async () => {
                const f = await api<{ file: ThemeFile; images: { ref: string; url: string }[] }>(
                  `/themes/${d.id}/file`,
                );
                await saveThemePackage(f.file, f.images);
              })
            }
          >
            <DownloadSimple size={18} aria-hidden="true" /> Save the theme package
          </button>
        )}
        {!d.mine &&
          (reporting ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 font-bold text-fg">What's wrong with it?</legend>
              {REPORTS.map(([reason, label]) => (
                <button
                  key={reason}
                  type="button"
                  className="rounded-xl px-3 py-2 text-left text-fg hover:bg-surface-raised"
                  onClick={() =>
                    act("report", async () => {
                      await api(`/themes/${d.id}/report`, { method: "POST", body: { reason } });
                      setReporting(false);
                      setNote("Thanks. We'll take it from here.");
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </fieldset>
          ) : (
            <button
              type="button"
              className="flex items-center gap-2 justify-self-start font-bold text-danger"
              onClick={() => setReporting(true)}
            >
              <Flag size={18} aria-hidden="true" /> Report this theme
            </button>
          ))}
        <button
          type="button"
          className={cx(textLink, "justify-self-start")}
          onClick={() => router.push("/themes/store")}
        >
          Back to the store
        </button>
      </aside>
    </div>
  );
}

/** For a theme's maker: its price and the promise that its art is theirs to sell. */
function PriceEditor({
  theme,
  payments,
  onSaved,
}: {
  theme: ThemeDetail;
  payments: ThemePayments | null;
  onSaved: (d: ThemeDetail) => void;
}) {
  const [cents, setCents] = useState(theme.priceCents);
  const [ownArt, setOwnArt] = useState(theme.ownArt);
  const [msg, setMsg] = useState<string | null>(null);
  const tiers = payments?.priceTiersCents ?? [0];
  return (
    <form
      className="mt-2 grid gap-3 rounded-2xl bg-surface-raised p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          onSaved(
            await api<ThemeDetail>(`/themes/${theme.id}`, {
              method: "PATCH",
              body: { priceCents: cents, ownArt },
            }),
          );
          setMsg("Saved.");
        } catch (err) {
          setMsg(say(err, "Not saved. Try again."));
        }
      }}
    >
      <b className="text-fg">Price</b>
      <select
        value={cents}
        onChange={(e) => setCents(Number(e.target.value))}
        className="h-11 rounded-[0.9rem] bg-surface px-3 text-fg"
        aria-label="Price"
      >
        {tiers.map((c) => (
          <option key={c} value={c}>
            {price(c)}
          </option>
        ))}
      </select>
      <label className="flex items-start gap-2 text-[0.92rem] text-fg-soft">
        <input
          type="checkbox"
          checked={ownArt}
          onChange={(e) => setOwnArt(e.target.checked)}
          className="mt-1"
        />
        The pictures are mine, or I'm allowed to sell them. (No characters or logos you don't own.)
      </label>
      <p className="text-[0.85rem] text-fg-soft">
        Realm keeps {payments?.cutPercent ?? 12}% of each sale after the payment company's fee; you
        get the rest.
        {!payments?.enabled && " Selling switches on once payments are set up."}
      </p>
      <button type="submit" className={pill("ghost", "sm", "justify-self-start")}>
        Save price
      </button>
      <p role="status" className="text-[0.9rem] text-fg-soft empty:hidden">
        {msg}
      </p>
    </form>
  );
}

// ── Adding a theme file ──────────────────────────────────────────────────────────

/** "Add your own theme": open a `.realmtheme` package or a `theme.json`, check it, keep it. */
export function AddView() {
  const router = useRouter();
  const { choose } = useThemes();
  const [file, setFile] = useState<ThemeFile | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = async (f: File) => {
    setBusy(true);
    setError(null);
    setFile(null);
    try {
      const { theme, notes: n } = await openThemeFile(f);
      const check = await api<{ ok: boolean; file: ThemeFile | null; problems: string[] }>(
        "/themes/check",
        {
          method: "POST",
          body: { file: theme },
        },
      );
      if (!check.ok || !check.file)
        throw new PackageError(check.problems[0] ?? "Realm couldn't use this theme.");
      setFile(check.file);
      setNotes([...n, ...check.problems]);
    } catch (err) {
      setError(say(err, "That theme couldn't be opened."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid max-w-[44rem] gap-6">
      <p className="text-fg-soft">
        Open a theme someone shared: a <b className="text-fg">.realmtheme</b> package (with its
        pictures) or a <b className="text-fg">theme.json</b>. Themes are only colours, shapes and
        pictures: they can't run code, read your messages or change what buttons do.
      </p>
      <label
        className="grid cursor-pointer place-items-center gap-2 rounded-[1.25rem] px-6 py-12 text-center shadow-[inset_0_0_0_2px_var(--r-border)] hover:bg-surface-raised"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) open(f);
        }}
      >
        <UploadSimple size={32} aria-hidden="true" className="text-fg" />
        <span className="font-bold text-fg">
          {busy ? "Opening…" : "Choose a theme file, or drop it here"}
        </span>
        <span className="text-[0.9rem] text-fg-soft">.realmtheme or .json, up to 12 MB</span>
        <input
          type="file"
          accept=".realmtheme,.json,application/zip,application/json"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) open(f);
          }}
        />
      </label>
      <p role="alert" className="font-bold text-danger empty:hidden">
        {error}
      </p>
      {file && (
        <div className="flex flex-wrap items-start gap-5 rounded-[1.25rem] bg-surface-raised p-5">
          <ThemePreview theme={resolveTheme(file)} width={130} />
          <div className="grid min-w-0 flex-1 gap-2">
            <b className="font-display text-[1.3rem] text-fg">{file.name}</b>
            {(notes.length ? notes : ["Everything reads well."]).map((n) => (
              <p key={n} className="text-[0.95rem] text-fg-soft">
                {n}
              </p>
            ))}
            <button
              type="button"
              className={pill("action", "md", "mt-2 justify-self-start")}
              onClick={async () => {
                try {
                  const { theme } = await api<{ theme: ThemeDetail }>("/themes", {
                    method: "POST",
                    body: { file },
                  });
                  await choose({ kind: "theme", themeId: theme.id }, theme.file);
                  router.push(`/themes/${theme.id}`);
                } catch (err) {
                  setError(say(err, "Couldn't save it. Try again."));
                }
              }}
            >
              Save and use it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function useResolved(file: ThemeFile | null): ResolvedTheme | null {
  return useMemo(() => (file ? resolveTheme(file) : null), [file]);
}
