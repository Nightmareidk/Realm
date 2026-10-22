"use client";

import {
  APP_ICONS,
  BODY_FONTS,
  checkTheme,
  DISPLAY_FONTS,
  EFFECT_SHAPES,
  fixTheme,
  PATTERN_SHAPES,
  type PaletteSuggestion,
  type ResolvedColors,
  type ResolvedTheme,
  resolveTheme,
  type ThemeArt,
  type ThemeDetail,
  ThemeFile,
  type ThemeTag,
} from "@realm/contracts";
import { LOOKS, lookTheme, PRESETS } from "@realm/design-tokens";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { pill, textLink } from "@/components/pill";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { PackageError, saveThemePackage, uploadImage } from "./package";
import { ThemePreview } from "./preview";
import { ThemeStage } from "./stage";
import { useThemes } from "./theme-context";

/** A theme back to a file, every choice written out (so remixing keeps what you see). */
const toFile = (r: ResolvedTheme, name: string): ThemeFile =>
  ThemeFile.parse({
    format: "realm-theme",
    version: 1,
    name,
    ...(r.description ? { description: r.description } : {}),
    look: r.look,
    colors: r.colors,
    style: r.style,
    panels: r.panels,
    buttons: r.buttons,
    type: r.type,
    ...(Object.keys(r.art).length ? { art: r.art } : {}),
  });

const say = (err: unknown, fallback: string) =>
  err instanceof ApiError || err instanceof PackageError ? err.message : fallback;

const FONT_NAMES: Record<string, string> = {
  funnel: "Funnel",
  atkinson: "Atkinson",
  system: "Your device's",
  bangers: "Bangers",
  fredoka: "Fredoka",
  pacifico: "Pacifico",
  "press-start": "Press Start",
  bebas: "Bebas",
  righteous: "Righteous",
  orbitron: "Orbitron",
  "permanent-marker": "Marker",
  comfortaa: "Comfortaa",
  lexend: "Lexend",
  nunito: "Nunito",
};
const fontVar = (id: string) =>
  id === "system"
    ? "system-ui"
    : id === "press-start"
      ? "var(--font-press-start)"
      : `var(--font-${id})`;

const ALL_COLORS: [keyof Omit<ResolvedColors, "lights">, string, string][] = [
  ["accent", "Your colour", "The main button, your bubbles, what's new"],
  ["accent2", "Second colour", "Where gradient buttons end"],
  ["onAccent", "Text on your colour", "Words and icons on buttons"],
  ["ground", "Background", "Behind everything"],
  ["surface", "Panels", "The menu, the page, cards"],
  ["raised", "Menus and bubbles", "Menus, selected rows, others' bubbles"],
  ["line", "Lines", "Thin dividing lines"],
  ["text", "Main text", "Names, messages, titles"],
  ["textSoft", "Second text", "Times, hints, second lines"],
  ["heading", "Section titles", '"Your Spaces", member groups'],
  ["link", "Links", "Links in messages and posts"],
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

// ── Small controls ───────────────────────────────────────────────────────────────

function Group({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line py-7 first:border-t-0 first:pt-2">
      <div>
        <h2 className="font-display text-[1.25rem] font-bold text-fg">{title}</h2>
        {lead && <p className="mt-1 max-w-[56ch] text-[0.95rem] text-fg-soft">{lead}</p>}
      </div>
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
      <div className="flex flex-wrap gap-2">
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
      </div>
    </fieldset>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  left,
  right,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  left: string;
  right: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[0.92rem] font-bold text-fg-soft">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--r-accent)]"
      />
      <span className="flex justify-between text-[0.8rem] text-fg-soft" aria-hidden="true">
        <span>{left}</span>
        <span>{right}</span>
      </span>
    </label>
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

// ── The maker ────────────────────────────────────────────────────────────────────

/**
 * The theme maker on the website. Start from one of Realm's looks, a ready-made theme, or your own
 * picture (Realm suggests colours from it, the way phones theme from a wallpaper). The simple
 * view covers what most themes change; "Every option" opens the rest. The preview is a small real
 * Realm in the theme, and the readability check can fix anything hard to read.
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
  const [everything, setEverything] = useState(false);
  const [ideas, setIdeas] = useState<PaletteSuggestion[]>([]);

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
  const setColor = (k: keyof ResolvedColors, v: string) =>
    edit({ colors: { ...file.colors, [k]: v.toLowerCase() } });
  const setArt = (patch: Partial<ThemeArt>) => {
    const art = { ...file.art, ...patch } as Record<string, unknown>;
    for (const k of Object.keys(art)) if (art[k] === undefined) delete art[k];
    edit({ art: art as ThemeArt });
  };
  const act = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setNotes([]);
    try {
      await fn();
    } catch (err) {
      setNotes([say(err, "That didn't work. Try again.")]);
    } finally {
      setBusy(null);
    }
  };
  /** Start again from a look or a ready-made theme, keeping your picture and name. */
  const startFrom = (base: ThemeFile) => {
    const keepArt = file.art?.wallpaper ? { ...base.art, wallpaper: file.art.wallpaper } : base.art;
    setFile(ThemeFile.parse({ ...base, name: file.name, ...(keepArt ? { art: keepArt } : {}) }));
  };
  const applyIdea = (s: PaletteSuggestion) => {
    const wall = file.art?.wallpaper;
    edit({
      colors: s.colors,
      panels: { ...file.panels, ...s.panels },
      buttons: { ...file.buttons, ...s.buttons },
      ...(wall
        ? { art: { ...file.art, wallpaper: { ...wall, overlay: s.overlay, overlay2: s.overlay2 } } }
        : {}),
    });
  };
  const choosePicture = () =>
    act("picture", async () => {
      const image = await pickPicture();
      if (!image) return;
      const wallpaper = { image, dim: 0.55, blur: "none" as const, focus: "center" as const };
      setArt({ wallpaper });
      // Suggest colours from it straight away.
      const { suggestions } = await api<{ suggestions: PaletteSuggestion[] }>("/themes/palette", {
        method: "POST",
        body: { mediaId: image.slice(6) },
      });
      setIdeas(suggestions);
    });
  const ideasFromPicture = () =>
    act("ideas", async () => {
      const ref = file.art?.wallpaper?.image;
      if (!ref) return;
      const { suggestions } = await api<{ suggestions: PaletteSuggestion[] }>("/themes/palette", {
        method: "POST",
        body: { mediaId: ref.slice(6) },
      });
      setIdeas(suggestions);
    });

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

  const art = file.art ?? {};
  const wall = art.wallpaper;
  const pattern = art.pattern;
  const effect = art.effect;

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_30rem]">
      <div className="min-w-0">
        {/* Where to start */}
        <section className="grid gap-4 pb-7">
          <h2 className="font-display text-[1.25rem] font-bold text-fg">Start from</h2>
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            <button
              type="button"
              onClick={choosePicture}
              className="grid w-[9.5rem] flex-none snap-start place-items-center gap-2 rounded-[1rem] p-3 text-center shadow-[inset_0_0_0_2px_var(--r-border)] hover:bg-surface-raised"
            >
              <span className="font-bold text-fg">
                {busy === "picture" ? "Uploading…" : "Your picture"}
              </span>
              <span className="text-[0.82rem] text-fg-soft">
                An anime character, a game, a photo. Realm picks colours from it.
              </span>
            </button>
            {[
              ...LOOKS.map((l) => ({
                key: l.id,
                name: l.name,
                line: l.blurb,
                file: lookTheme(l.id, "mint"),
              })),
              ...PRESETS.map((p) => ({
                key: p.id,
                name: p.file.name,
                line: p.blurb,
                file: ThemeFile.parse(p.file),
              })),
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => startFrom(s.file)}
                className="grid w-[9.5rem] flex-none snap-start gap-2 rounded-[1rem] bg-surface-raised p-2 text-left hover:ring-2 hover:ring-line-strong"
              >
                <ThemePreview theme={resolveTheme(s.file)} width={136} wide />
                <span className="px-1 font-bold text-fg">{s.name}</span>
                <span className="px-1 pb-1 text-[0.8rem] leading-snug text-fg-soft">{s.line}</span>
              </button>
            ))}
          </div>
          {ideas.length > 0 && (
            <div className="grid gap-3 rounded-[1.25rem] bg-surface-raised p-4">
              <b className="text-fg">Colours from your picture</b>
              <div className="flex flex-wrap gap-3">
                {ideas.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => applyIdea(s)}
                    className="grid gap-2 rounded-[0.9rem] p-2 text-left hover:ring-2 hover:ring-line-strong"
                  >
                    <span className="flex h-10 w-36 overflow-hidden rounded-lg">
                      {[
                        s.colors.ground,
                        s.colors.surface,
                        s.colors.accent,
                        s.colors.accent2 ?? s.colors.accent,
                        s.colors.text,
                      ].map((c, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed strip of swatches
                        <span key={i} className="flex-1" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="text-[0.85rem] font-bold text-fg">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="mb-2 flex gap-2" role="tablist" aria-label="How many options">
          {[
            [false, "Simple"],
            [true, "Every option"],
          ].map(([on, label]) => (
            <button
              key={label as string}
              type="button"
              role="tab"
              aria-selected={everything === on}
              onClick={() => setEverything(on as boolean)}
              className={cx(
                "h-10 rounded-full px-4 font-bold",
                everything === on ? "bg-fg text-base" : "text-fg-soft hover:text-fg",
              )}
            >
              {label as string}
            </button>
          ))}
        </div>

        <Group title="Name">
          <input
            value={file.name}
            onChange={(e) => edit({ name: e.target.value })}
            maxLength={40}
            aria-label="Theme name"
            className="h-12 rounded-[0.9rem] px-4 text-[1.1rem] font-bold text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)]"
          />
        </Group>

        <Group
          title="Picture"
          lead="One picture behind the whole app, with a layer over it so text stays readable."
        >
          {wall ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap gap-2">
                <button type="button" className={pill("ghost", "sm")} onClick={choosePicture}>
                  Change picture
                </button>
                <button
                  type="button"
                  className={pill("ghost", "sm")}
                  onClick={ideasFromPicture}
                  aria-disabled={busy === "ideas"}
                >
                  {busy === "ideas" ? "Looking…" : "Suggest colours from it"}
                </button>
                <button
                  type="button"
                  className={pill("quiet", "sm")}
                  onClick={() => setArt({ wallpaper: undefined })}
                >
                  Remove
                </button>
              </div>
              <Choice
                label="Keep this part in view"
                value={wall.focus ?? "center"}
                items={
                  [
                    ["center", "Middle"],
                    ["top", "Top"],
                    ["bottom", "Bottom"],
                    ["left", "Left"],
                    ["right", "Right"],
                  ] as const
                }
                onChange={(focus) => setArt({ wallpaper: { ...wall, focus } })}
              />
              <div className="grid gap-5 md:grid-cols-2">
                <Slider
                  label="Layer over it"
                  value={wall.dim}
                  min={0.2}
                  max={0.95}
                  step={0.05}
                  left="See the picture"
                  right="Calm and dark"
                  onChange={(dim) => setArt({ wallpaper: { ...wall, dim } })}
                />
                <Slider
                  label="Brightness"
                  value={wall.brightness ?? 1}
                  min={0.3}
                  max={1.2}
                  step={0.05}
                  left="Darker"
                  right="Brighter"
                  onChange={(brightness) => setArt({ wallpaper: { ...wall, brightness } })}
                />
                <Slider
                  label="Colour strength"
                  value={wall.saturation ?? 1}
                  min={0}
                  max={1.6}
                  step={0.1}
                  left="Grey"
                  right="Vivid"
                  onChange={(saturation) => setArt({ wallpaper: { ...wall, saturation } })}
                />
                <Choice
                  label="Blur"
                  value={wall.blur}
                  items={
                    [
                      ["none", "Sharp"],
                      ["soft", "Soft"],
                      ["strong", "Strong"],
                    ] as const
                  }
                  onChange={(blur) => setArt({ wallpaper: { ...wall, blur } })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <ColorField
                  label="Layer colour"
                  hint="Usually near black, or tinted"
                  value={wall.overlay ?? live.colors.ground}
                  onChange={(overlay) => setArt({ wallpaper: { ...wall, overlay } })}
                />
                <ColorField
                  label="Fades to"
                  hint="A second colour makes a gradient"
                  value={wall.overlay2 ?? wall.overlay ?? live.colors.ground}
                  onChange={(overlay2) => setArt({ wallpaper: { ...wall, overlay2 } })}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={pill("ghost", "md", "justify-self-start")}
              onClick={choosePicture}
              aria-disabled={busy === "picture"}
            >
              {busy === "picture" ? "Uploading…" : "Choose a picture"}
            </button>
          )}
        </Group>

        <Group title="Colours">
          <div className="grid gap-4 md:grid-cols-2">
            {(everything
              ? ALL_COLORS
              : ALL_COLORS.filter(([k]) =>
                  ["accent", "accent2", "ground", "text", "heading"].includes(k),
                )
            ).map(([k, label, hint]) => (
              <ColorField
                key={k}
                label={label}
                hint={hint}
                value={live.colors[k]}
                onChange={(v) => setColor(k, v)}
              />
            ))}
            {everything &&
              [0, 1, 2].map((i) => (
                <ColorField
                  key={`l${i}`}
                  label={`Light ${i + 1}`}
                  hint="A soft glow behind the page"
                  value={file.colors.lights[i] ?? "#000000"}
                  onChange={(v) => {
                    const lights = [...file.colors.lights] as ResolvedColors["lights"];
                    lights[i] = v.toLowerCase();
                    edit({ colors: { ...file.colors, lights } });
                  }}
                />
              ))}
          </div>
        </Group>

        <Group
          title="Panels"
          lead="See-through panels let your picture show behind the menu, chats and posts."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Slider
              label="How solid"
              value={live.panels.opacity}
              min={0.35}
              max={1}
              step={0.05}
              left="See-through"
              right="Solid"
              onChange={(opacity) => edit({ panels: { ...file.panels, opacity } })}
            />
            <Choice
              label="Frosted glass"
              value={live.panels.blur}
              items={
                [
                  ["none", "Off"],
                  ["soft", "Soft"],
                  ["strong", "Strong"],
                ] as const
              }
              onChange={(blur) => edit({ panels: { ...file.panels, blur } })}
            />
            <Choice
              label="Section titles"
              value={live.panels.headers}
              items={
                [
                  ["plain", "Plain words"],
                  ["bar", "On a coloured strip"],
                ] as const
              }
              onChange={(headers) => edit({ panels: { ...file.panels, headers } })}
            />
            <Choice
              label="Edges"
              value={live.panels.border}
              items={
                [
                  ["none", "None"],
                  ["line", "Thin line"],
                  ["accent", "Your colour"],
                ] as const
              }
              onChange={(border) => edit({ panels: { ...file.panels, border } })}
            />
            {everything && (
              <Choice
                label="Shadow"
                value={live.panels.shadow}
                items={
                  [
                    ["none", "None"],
                    ["soft", "Soft"],
                    ["glow", "Glow"],
                  ] as const
                }
                onChange={(shadow) => edit({ panels: { ...file.panels, shadow } })}
              />
            )}
          </div>
        </Group>

        <Group title="Buttons">
          <div className="grid gap-5 md:grid-cols-2">
            <Choice
              label="Shape"
              value={live.buttons.shape}
              items={
                [
                  ["pill", "Pill"],
                  ["rounded", "Rounded"],
                  ["square", "Square"],
                ] as const
              }
              onChange={(shape) => edit({ buttons: { ...file.buttons, shape } })}
            />
            <Choice
              label="Fill"
              value={live.buttons.fill}
              items={
                [
                  ["solid", "Solid"],
                  ["gradient", "Gradient"],
                  ["outline", "Outline"],
                ] as const
              }
              onChange={(fill) => edit({ buttons: { ...file.buttons, fill } })}
            />
            <Choice
              label="Glow"
              value={live.buttons.glow ? "on" : "off"}
              items={
                [
                  ["off", "Off"],
                  ["on", "On"],
                ] as const
              }
              onChange={(v) => edit({ buttons: { ...file.buttons, glow: v === "on" } })}
            />
          </div>
        </Group>

        <Group
          title="Fonts"
          lead="Title fonts set names and headings. Reading text keeps a font made for reading."
        >
          <fieldset>
            <legend className="mb-2 text-[0.92rem] font-bold text-fg-soft">Titles</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DISPLAY_FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={live.type.display === f}
                  onClick={() => edit({ type: { ...file.type, display: f } })}
                  className={cx(
                    "grid gap-1 rounded-[0.9rem] p-3 text-left",
                    live.type.display === f
                      ? "ring-2 ring-fg"
                      : "shadow-[inset_0_0_0_1px_var(--r-border)] hover:bg-surface-raised",
                  )}
                >
                  <span
                    className="truncate text-[1.25rem] text-fg"
                    style={{ fontFamily: fontVar(f) }}
                  >
                    Friday squad
                  </span>
                  <span className="text-[0.8rem] text-fg-soft">{FONT_NAMES[f]}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <Choice
            label="Reading text"
            value={live.type.body}
            items={BODY_FONTS.map((f) => [f, FONT_NAMES[f] ?? f] as const)}
            onChange={(body) => edit({ type: { ...file.type, body } })}
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
        </Group>

        <Group title="Effects">
          <Choice
            label="Falling or floating"
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
          <Choice
            label="Pattern"
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
                          color: pattern?.color ?? live.colors.accent,
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
                            color: pattern?.color ?? live.colors.accent,
                            opacity: pattern?.opacity ?? 0.08,
                            size: pattern?.size ?? 1,
                          },
                  })
            }
          />
          {pattern && (
            <div className="grid gap-5 md:grid-cols-2">
              {pattern.shape !== "image" && (
                <ColorField
                  label="Pattern colour"
                  value={pattern.color}
                  onChange={(color) => setArt({ pattern: { ...pattern, color } })}
                />
              )}
              <Slider
                label="Pattern strength"
                value={pattern.opacity}
                min={0.02}
                max={0.25}
                step={0.01}
                left="Faint"
                right="Strong"
                onChange={(opacity) => setArt({ pattern: { ...pattern, opacity } })}
              />
            </div>
          )}
        </Group>

        {everything && (
          <>
            <Group
              title="Layout and shapes"
              lead="Mix Realm's looks: take the stories from one and the posts from another."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Choice
                  label="Base look"
                  value={file.look}
                  items={LOOKS.map((l) => [l.id, l.name] as const)}
                  onChange={(look) => edit({ look })}
                />
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
                  onChange={(corners) => edit({ style: { ...file.style, corners } })}
                />
                <Slider
                  label="Glow behind things"
                  value={live.style.glow}
                  min={0}
                  max={1}
                  step={0.05}
                  left="Off"
                  right="Full"
                  onChange={(glow) => edit({ style: { ...file.style, glow } })}
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
                  onChange={(stories) => edit({ style: { ...file.style, stories } })}
                />
                <Choice
                  label="Posts"
                  value={live.style.posts}
                  items={
                    [
                      ["glow", "Glowing cards"],
                      ["ticket", "Ticket stubs"],
                      ["thread", "Threads"],
                    ] as const
                  }
                  onChange={(posts) => edit({ style: { ...file.style, posts } })}
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
                  onChange={(tabBar) => edit({ style: { ...file.style, tabBar } })}
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
                  onChange={(bubbles) => edit({ style: { ...file.style, bubbles } })}
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
                  onChange={(icons) => edit({ style: { ...file.style, icons } })}
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
                  onChange={(avatars) => edit({ style: { ...file.style, avatars } })}
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
                  onChange={(v) => edit({ style: { ...file.style, chatColours: v === "on" } })}
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
                  onChange={(v) => edit({ style: { ...file.style, grain: v === "on" } })}
                />
                <Choice
                  label="App icon (phones)"
                  value={file.appIcon ?? "default"}
                  items={APP_ICONS.map((i) => [i, i] as const)}
                  onChange={(appIcon) => edit({ appIcon })}
                />
              </div>
            </Group>
            <Group
              title="Stickers"
              lead="Stickers sit in spots kept for them, never over buttons or messages."
            >
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
          </>
        )}

        <Group title="For the store">
          <textarea
            value={file.description ?? ""}
            onChange={(e) => edit({ description: e.target.value || undefined })}
            maxLength={200}
            rows={2}
            placeholder="Describe it (optional)"
            className="rounded-[0.9rem] p-3 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] placeholder:text-fg-soft"
          />
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
                      "h-9 rounded-full px-3.5 text-[0.9rem] font-bold first-letter:uppercase",
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
        </Group>
      </div>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <div className="grid gap-4 rounded-[1.5rem] bg-surface-raised p-4">
          <ThemeStage theme={live} />
          {problems.length ? (
            <div role="status" className="grid gap-2">
              <b className="text-danger">
                {problems.length === 1 ? "1 thing is" : `${problems.length} things are`} hard to
                read.
              </b>
              <ul className="grid gap-1 text-[0.9rem] text-fg-soft">
                {problems.slice(0, 3).map((p) => (
                  <li key={p.message}>{p.message}</li>
                ))}
              </ul>
              <button
                type="button"
                className={cx(textLink, "justify-self-start")}
                onClick={() => {
                  const fixed = fixTheme(live);
                  edit({
                    colors: fixed.colors,
                    style: { ...file.style, glow: fixed.style.glow },
                    panels: { ...file.panels, opacity: fixed.panels.opacity },
                  });
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={pill("action", "md", "col-span-2")}
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
              {previewing ? "Stop trying" : "Try it everywhere"}
            </button>
            {saved ? (
              <button
                type="button"
                className={pill("ghost", "md")}
                onClick={() => act("use", () => choose({ kind: "theme", themeId: saved.id }, file))}
              >
                Use as my theme
              </button>
            ) : (
              <span />
            )}
          </div>
          {saved && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.92rem]">
              <button
                type="button"
                className={textLink}
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
                Download package
              </button>
              <Link href={`/themes/${saved.id}`} className={textLink}>
                Share, price and reviews
              </Link>
            </div>
          )}
          <ul role="status" className="grid gap-1 text-[0.9rem] text-fg-soft empty:hidden">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <Link href="/themes/guide" className={cx(textLink, "justify-self-start text-[0.9rem]")}>
            How to make a theme
          </Link>
        </div>
      </aside>
    </div>
  );
}
