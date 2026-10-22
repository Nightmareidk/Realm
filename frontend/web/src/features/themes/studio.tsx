"use client";

import {
  checkTheme,
  EFFECT_SHAPES,
  fixTheme,
  PATTERN_SHAPES,
  type ResolvedTheme,
  resolveTheme,
  type ThemeArt,
  type ThemeColors,
  type ThemeDetail,
  ThemeFile,
  type ThemeStyle,
  type ThemeTag,
} from "@realm/contracts";
import { LOOKS } from "@realm/design-tokens";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { pill, textLink } from "@/components/pill";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { PackageError, saveThemePackage, uploadImage } from "./package";
import { ThemePreview } from "./preview";
import { useThemes } from "./theme-context";

const toFile = (r: ResolvedTheme, name: string): ThemeFile =>
  ThemeFile.parse({
    format: "realm-theme",
    version: 1,
    name,
    ...(r.description ? { description: r.description } : {}),
    look: r.look,
    colors: r.colors,
    style: r.style,
    type: r.type,
    ...(Object.keys(r.art).length ? { art: r.art } : {}),
  });

const COLOR_ROLES: [keyof Omit<ThemeColors, "lights">, string, string][] = [
  ["ground", "Background", "Behind everything"],
  ["surface", "Panels", "Cards, the side menu, the tab bar"],
  ["raised", "Menus and bubbles", "Menus, selected rows, other people's chat bubbles"],
  ["line", "Lines", "Thin dividing lines"],
  ["text", "Main text", "Names, messages, titles"],
  ["textSoft", "Second text", "Times, hints, second lines"],
  ["accent", "Your colour", "The main button, your chat bubbles, what's new"],
  ["onAccent", "Text on your colour", "Words and icons on your colour"],
];

const TAGS: ThemeTag[] = [
  "dark",
  "light",
  "colourful",
  "cute",
  "gaming",
  "anime",
  "minimal",
  "calm",
  "bold",
  "retro",
  "nature",
  "music",
  "seasonal",
  "high-contrast",
];

const say = (err: unknown, fallback: string) =>
  err instanceof ApiError || err instanceof PackageError ? err.message : fallback;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line py-7 first:border-t-0 first:pt-0">
      <h2 className="font-display text-[1.25rem] font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Choice<V extends string>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: readonly (readonly [V, string])[];
  onChange: (v: V) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[0.92rem] font-bold text-fg-soft">{label}</legend>
      <fieldset className="flex flex-wrap gap-2">
        {items.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            onClick={() => onChange(v)}
            className={cx(
              "h-9 rounded-full px-3.5 text-[0.9rem] font-bold first-letter:uppercase",
              v === value
                ? "bg-fg text-base"
                : "text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)] hover:text-fg",
            )}
          >
            {text}
          </button>
        ))}
      </fieldset>
    </fieldset>
  );
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const ok = /^#[0-9a-f]{6}$/i.test(text);
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label}: pick a colour`}
        className="size-10 flex-none cursor-pointer rounded-full border border-line-strong bg-transparent"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-fg">{label}</span>
        {hint && <span className="block text-[0.85rem] text-fg-soft">{hint}</span>}
      </span>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase());
        }}
        maxLength={7}
        aria-label={`${label}: colour code`}
        aria-invalid={!ok}
        className={cx(
          "h-10 w-28 rounded-[0.7rem] px-3 font-mono text-[0.9rem] text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)]",
          !ok && "shadow-[inset_0_0_0_2px_var(--r-danger-line)]",
        )}
      />
    </div>
  );
}

/** Pick a picture, check it's one, upload it, hand back its Realm reference. */
async function pickPicture(): Promise<string | null> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
  if (!file) return null;
  if (file.size > 4 * 1024 * 1024) throw new PackageError("Pictures in themes can be up to 4 MB.");
  return uploadImage(new Uint8Array(await file.arrayBuffer()), file.type);
}

/**
 * The theme maker on the website: every option of the theme format, with a phone and a desktop
 * preview that follow each change, a readability check that can fix itself, and Save, Try it on,
 * Download and Share. Start from what you're wearing, or open one of your themes with ?id=.
 */
export function StudioView() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { shown, preview, previewing, choose } = useThemes();
  const [file, setFile] = useState<ThemeFile | null>(id ? null : toFile(shown, "My theme"));
  const [saved, setSaved] = useState<ThemeDetail | null>(null);
  const [tags, setTags] = useState<ThemeTag[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api<{ file: ThemeFile }>(`/themes/${id}/file`), api<ThemeDetail>(`/themes/${id}`)])
      .then(([f, d]) => {
        setFile(f.file);
        setSaved(d);
        setTags(d.tags);
      })
      .catch((err) => setNotes([say(err, "That theme couldn't be opened.")]));
  }, [id]);

  const live = useMemo(() => (file ? resolveTheme(file) : null), [file]);
  const problems = useMemo(() => (live ? checkTheme(live) : []), [live]);
  if (!file || !live) return <p className="text-fg-soft">{notes[0] ?? "Opening…"}</p>;

  const edit = (patch: Partial<ThemeFile>) => {
    setFile((f) => (f ? { ...f, ...patch } : f));
    if (previewing) preview(null);
  };
  const setColor = (k: keyof ThemeColors, v: string) =>
    edit({ colors: { ...file.colors, [k]: v.toLowerCase() } });
  const setLight = (i: number, v: string) => {
    const lights = [...file.colors.lights] as ThemeColors["lights"];
    lights[i] = v.toLowerCase();
    edit({ colors: { ...file.colors, lights } });
  };
  const setStyle = <K extends keyof ThemeStyle>(k: K, v: ThemeStyle[K]) =>
    edit({ style: { ...file.style, [k]: v } });
  const setArt = (patch: Partial<ThemeArt>) => {
    const art = { ...file.art, ...patch } as Record<string, unknown>;
    for (const k of Object.keys(art)) if (art[k] === undefined) delete art[k];
    edit({ art: art as ThemeArt });
  };
  const act = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      setNotes([say(err, "That didn't work. Try again.")]);
    } finally {
      setBusy(null);
    }
  };
  const art = file.art ?? {};
  const wall = art.wallpaper;
  const pattern = art.pattern;
  const effect = art.effect;

  const save = () =>
    act("save", async () => {
      const body = {
        file,
        tags,
        priceCents: saved?.priceCents ?? 0,
        ownArt: saved?.ownArt ?? false,
      };
      const res = await api<{ theme: ThemeDetail; problems: string[] }>(
        saved ? `/themes/${saved.id}/versions` : "/themes",
        { method: "POST", body },
      );
      setSaved(res.theme);
      setFile(res.theme.file);
      setNotes(res.problems.length ? res.problems : ["Saved."]);
      if (!saved) router.replace(`/themes/studio?id=${res.theme.id}`);
    });

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="min-w-0">
        <Group title="Name">
          <input
            value={file.name}
            onChange={(e) => edit({ name: e.target.value })}
            maxLength={40}
            aria-label="Theme name"
            className="h-12 rounded-[0.9rem] px-4 text-[1.1rem] font-bold text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)]"
          />
          <textarea
            value={file.description ?? ""}
            onChange={(e) => edit({ description: e.target.value || undefined })}
            maxLength={200}
            rows={2}
            placeholder="Describe it for the store (optional)"
            className="rounded-[0.9rem] p-3 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] placeholder:text-fg-soft"
          />
        </Group>
        <Group title="Look">
          <Choice
            label="How screens are laid out"
            value={file.look}
            items={LOOKS.map((l) => [l.id, l.name] as const)}
            onChange={(look) => edit({ look })}
          />
        </Group>
        <Group title="Colours">
          <div className="grid gap-4 md:grid-cols-2">
            {COLOR_ROLES.map(([k, label, hint]) => (
              <ColorField
                key={k}
                label={label}
                hint={hint}
                value={file.colors[k]}
                onChange={(v) => setColor(k, v)}
              />
            ))}
            {[0, 1, 2].map((i) => (
              <ColorField
                key={`l${i}`}
                label={`Light ${i + 1}`}
                hint="A soft glow behind the page"
                value={file.colors.lights[i] ?? "#000000"}
                onChange={(v) => setLight(i, v)}
              />
            ))}
          </div>
        </Group>
        <Group title="Shapes and style">
          <div className="grid gap-5 md:grid-cols-2">
            <Choice
              label="Corners"
              value={live.style.corners}
              items={
                [
                  ["square", "Square"],
                  ["soft", "Soft"],
                  ["round", "Round"],
                ] as const
              }
              onChange={(v) => setStyle("corners", v)}
            />
            <Choice
              label="Glow"
              value={String(live.style.glow)}
              items={
                [
                  ["0", "Off"],
                  ["0.25", "Low"],
                  ["0.5", "Some"],
                  ["0.75", "Lots"],
                  ["1", "Full"],
                ] as const
              }
              onChange={(v) => setStyle("glow", Number(v))}
            />
            <Choice
              label="Stories"
              value={live.style.stories}
              items={
                [
                  ["rings", "Rings"],
                  ["bands", "Bands"],
                  ["thin", "Thin"],
                ] as const
              }
              onChange={(v) => setStyle("stories", v)}
            />
            <Choice
              label="Posts"
              value={live.style.posts}
              items={
                [
                  ["glow", "Glow"],
                  ["ticket", "Ticket"],
                  ["thread", "Thread"],
                ] as const
              }
              onChange={(v) => setStyle("posts", v)}
            />
            <Choice
              label="Tab bar on phones"
              value={live.style.tabBar}
              items={
                [
                  ["floating", "Floating"],
                  ["bar", "Bar"],
                ] as const
              }
              onChange={(v) => setStyle("tabBar", v)}
            />
            <Choice
              label="Chat bubbles"
              value={live.style.bubbles}
              items={
                [
                  ["round", "Round"],
                  ["soft", "Soft"],
                  ["square", "Square"],
                ] as const
              }
              onChange={(v) => setStyle("bubbles", v)}
            />
            <Choice
              label="Icons"
              value={live.style.icons}
              items={
                [
                  ["regular", "Thin"],
                  ["bold", "Bold"],
                  ["fill", "Filled"],
                  ["duotone", "Two-tone"],
                ] as const
              }
              onChange={(v) => setStyle("icons", v)}
            />
            <Choice
              label="Pictures of people"
              value={live.style.avatars}
              items={
                [
                  ["circle", "Circles"],
                  ["rounded", "Rounded squares"],
                ] as const
              }
              onChange={(v) => setStyle("avatars", v)}
            />
            <Choice
              label="Film grain"
              value={live.style.grain ? "on" : "off"}
              items={
                [
                  ["off", "Off"],
                  ["on", "On"],
                ] as const
              }
              onChange={(v) => setStyle("grain", v === "on")}
            />
            <Choice
              label="Each chat its own colour"
              value={live.style.chatColours ? "on" : "off"}
              items={
                [
                  ["off", "Off"],
                  ["on", "On"],
                ] as const
              }
              onChange={(v) => setStyle("chatColours", v === "on")}
            />
            <Choice
              label="Text size"
              value={live.type.size}
              items={
                [
                  ["normal", "Normal"],
                  ["large", "Large"],
                  ["larger", "Larger"],
                ] as const
              }
              onChange={(size) => edit({ type: { ...file.type, size } })}
            />
          </div>
        </Group>
        <Group title="Wallpaper">
          {wall ? (
            <div className="grid gap-4">
              <Choice
                label="Dim it so text stays readable"
                value={String(wall.dim)}
                items={
                  [
                    ["0.35", "A little"],
                    ["0.55", "Some"],
                    ["0.7", "More"],
                    ["0.85", "Lots"],
                  ] as const
                }
                onChange={(v) => setArt({ wallpaper: { ...wall, dim: Number(v) } })}
              />
              <Choice
                label="Blur"
                value={wall.blur}
                items={
                  [
                    ["none", "None"],
                    ["soft", "Soft"],
                    ["strong", "Strong"],
                  ] as const
                }
                onChange={(blur) => setArt({ wallpaper: { ...wall, blur } })}
              />
              <button
                type="button"
                className={pill("quiet", "sm", "justify-self-start")}
                onClick={() => setArt({ wallpaper: undefined })}
              >
                Remove wallpaper
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={pill("ghost", "md", "justify-self-start")}
              aria-disabled={busy === "pic"}
              onClick={() =>
                act("pic", async () => {
                  const image = await pickPicture();
                  if (image) setArt({ wallpaper: { image, dim: 0.55, blur: "soft" } });
                })
              }
            >
              {busy === "pic" ? "Uploading…" : "Choose a wallpaper"}
            </button>
          )}
        </Group>
        <Group title="Pattern">
          <Choice
            label="Shape"
            value={pattern?.shape ?? "none"}
            items={
              [
                ["none", "None"],
                ...PATTERN_SHAPES.map((p) => [p, p] as const),
                ["image", "Your picture"],
              ] as const
            }
            onChange={(shape) =>
              shape === "image"
                ? act("pic", async () => {
                    const image = await pickPicture();
                    if (image)
                      setArt({
                        pattern: {
                          shape: "image",
                          image,
                          color: pattern?.color ?? file.colors.accent,
                          opacity: pattern?.opacity ?? 0.08,
                          size: 1,
                        },
                      });
                  })
                : setArt({
                    pattern:
                      shape === "none"
                        ? undefined
                        : {
                            shape: shape as (typeof PATTERN_SHAPES)[number],
                            color: pattern?.color ?? file.colors.accent,
                            opacity: pattern?.opacity ?? 0.08,
                            size: pattern?.size ?? 1,
                          },
                  })
            }
          />
          {pattern && (
            <div className="grid gap-4 md:grid-cols-2">
              {pattern.shape !== "image" && (
                <ColorField
                  label="Pattern colour"
                  value={pattern.color}
                  onChange={(color) => setArt({ pattern: { ...pattern, color } })}
                />
              )}
              <Choice
                label="How strong"
                value={String(pattern.opacity)}
                items={
                  [
                    ["0.05", "Faint"],
                    ["0.08", "Light"],
                    ["0.14", "Clear"],
                    ["0.22", "Strong"],
                  ] as const
                }
                onChange={(v) => setArt({ pattern: { ...pattern, opacity: Number(v) } })}
              />
              <Choice
                label="Size"
                value={String(pattern.size)}
                items={
                  [
                    ["0.6", "Small"],
                    ["1", "Medium"],
                    ["1.6", "Big"],
                  ] as const
                }
                onChange={(v) => setArt({ pattern: { ...pattern, size: Number(v) } })}
              />
            </div>
          )}
        </Group>
        <Group title="Stickers">
          <p className="text-fg-soft">
            Stickers sit in spots kept for them, never over buttons or messages.
          </p>
          {(
            [
              ["header", "Beside the title on Home"],
              ["empty", "On empty screens"],
              ["profile", "On your profile banner"],
            ] as const
          ).map(([slot, label]) => (
            <div key={slot} className="flex items-center justify-between gap-3">
              <span className="font-bold text-fg">{label}</span>
              {art.stickers?.[slot] ? (
                <button
                  type="button"
                  className={pill("quiet", "sm")}
                  onClick={() => setArt({ stickers: { ...art.stickers, [slot]: undefined } })}
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  className={pill("ghost", "sm")}
                  onClick={() =>
                    act("pic", async () => {
                      const ref = await pickPicture();
                      if (ref) setArt({ stickers: { ...art.stickers, [slot]: ref } });
                    })
                  }
                >
                  Add a sticker
                </button>
              )}
            </div>
          ))}
        </Group>
        <Group title="Falling effect">
          <Choice
            label="What falls (or floats)"
            value={effect?.shape ?? "none"}
            items={[["none", "None"], ...EFFECT_SHAPES.map((e) => [e, e] as const)] as const}
            onChange={(shape) =>
              setArt({
                effect:
                  shape === "none"
                    ? undefined
                    : {
                        shape: shape as (typeof EFFECT_SHAPES)[number],
                        color: effect?.color ?? "#ffffff",
                        amount: effect?.amount ?? "few",
                      },
              })
            }
          />
          {effect && (
            <div className="grid gap-4 md:grid-cols-2">
              <ColorField
                label="Effect colour"
                value={effect.color}
                onChange={(color) => setArt({ effect: { ...effect, color } })}
              />
              <Choice
                label="How many"
                value={effect.amount}
                items={
                  [
                    ["few", "A few"],
                    ["some", "Some"],
                    ["lots", "Lots"],
                  ] as const
                }
                onChange={(amount) => setArt({ effect: { ...effect, amount } })}
              />
            </div>
          )}
          <p className="text-[0.9rem] text-fg-soft">
            Effects stop for anyone who turns motion off.
          </p>
        </Group>
        <Group title="For the store">
          <fieldset>
            <legend className="mb-2 text-[0.92rem] font-bold text-fg-soft">Tags (up to 5)</legend>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setTags((ts) => (on ? ts.filter((x) => x !== tag) : [...ts, tag].slice(0, 5)))
                    }
                    className={cx(
                      "h-9 rounded-full px-3.5 text-[0.9rem] font-bold capitalize",
                      on
                        ? "bg-fg text-base"
                        : "text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)]",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <p className="text-[0.9rem] text-fg-soft">
            Using a character or logo you don't own (like a superhero or a cartoon cat) is fine for
            your own theme, but it can't be sold, and its owner can ask for a shared one to be taken
            down.
          </p>
        </Group>
      </div>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <div className="grid gap-5 rounded-[1.5rem] bg-surface-raised p-5">
          <div className="flex flex-wrap items-end justify-center gap-4">
            <ThemePreview theme={live} width={130} />
            <ThemePreview theme={live} width={200} wide />
          </div>
          {problems.length ? (
            <div role="status" className="grid gap-2">
              <b className="text-danger">
                {problems.length === 1 ? "1 thing is" : `${problems.length} things are`} hard to
                read.
              </b>
              <ul className="grid gap-1 text-[0.9rem] text-fg-soft">
                {problems.slice(0, 4).map((p) => (
                  <li key={p.message}>{p.message}</li>
                ))}
              </ul>
              <button
                type="button"
                className={cx(textLink, "justify-self-start")}
                onClick={() => {
                  const fixed = fixTheme(live);
                  edit({ colors: fixed.colors, style: { ...file.style, glow: fixed.style.glow } });
                }}
              >
                Fix it for me
              </button>
            </div>
          ) : (
            <p role="status" className="font-bold text-success">
              Everything reads well.
            </p>
          )}
          <button
            type="button"
            className={pill("action", "md")}
            onClick={save}
            aria-disabled={busy === "save"}
          >
            {busy === "save" ? "Saving…" : saved ? "Save changes" : "Save theme"}
          </button>
          <button
            type="button"
            className={pill("ghost", "md")}
            onClick={() => preview(previewing ? null : live)}
          >
            {previewing ? "Stop trying it on" : "Try it on everywhere"}
          </button>
          {saved && (
            <>
              <button
                type="button"
                className={pill("ghost", "md")}
                onClick={() => act("use", () => choose({ kind: "theme", themeId: saved.id }, file))}
              >
                Use it as my theme
              </button>
              <button
                type="button"
                className={pill("ghost", "md")}
                onClick={() =>
                  act("dl", async () => {
                    const f = await api<{
                      file: ThemeFile;
                      images: { ref: string; url: string }[];
                    }>(`/themes/${saved.id}/file`);
                    await saveThemePackage(f.file, f.images);
                  })
                }
              >
                Download the package
              </button>
              <Link href={`/themes/${saved.id}`} className={pill("quiet", "md")}>
                Its page: share, price and reviews
              </Link>
            </>
          )}
          <ul role="status" className="grid gap-1 text-[0.9rem] text-fg-soft empty:hidden">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <Link href="/themes/guide" className={cx(textLink, "justify-self-start text-[0.92rem]")}>
            How to make a theme
          </Link>
        </div>
      </aside>
    </div>
  );
}
