import {
  BODY_FONTS,
  checkTheme,
  DISPLAY_FONTS,
  EFFECT_SHAPES,
  fixTheme,
  PATTERN_SHAPES,
  type PaletteSuggestion,
  type ResolvedTheme,
  resolveTheme,
  type ThemeArt,
  type ThemeColors,
  type ThemeDetail,
  ThemeFile,
  type ThemeStyle,
  type ThemeTag,
} from "@realm/contracts";
import { LOOKS, lookTheme, PRESETS } from "@realm/design-tokens";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { alert } from "@/alert";
import { Icon } from "@/icon";
import { ApiError, api, upload } from "@/server";
import { shrinkPhoto } from "@/shrink";
import { AppScreen, Loading, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { ThemePreview } from "@/themes/preview";
import { themeChoice, useApplyTheme } from "@/themes/use";
import { Pill } from "@/ui";

/** A theme as a file again, from the one on screen (so you start from what you see). */
function toFile(r: ResolvedTheme, name: string): ThemeFile {
  return ThemeFile.parse({
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
}

const FONT_NAMES: Record<string, string> = {
  funnel: "Funnel",
  atkinson: "Atkinson",
  system: "Phone's own",
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

const PALETTE = [
  "#000000",
  "#0b0b0e",
  "#141419",
  "#1f1f27",
  "#2e2e38",
  "#ffffff",
  "#f5f4f2",
  "#c8c6cf",
  "#ff3b5c",
  "#ff6a3d",
  "#ffb547",
  "#ffd400",
  "#3ee6b0",
  "#1fbf8f",
  "#5fd8ef",
  "#2b47ff",
  "#8b6bff",
  "#cdb4ff",
  "#ff5f9a",
  "#ffc2d6",
  "#fff0f5",
  "#3a1020",
  "#0f766e",
  "#14213d",
];

const COLOR_ROLES: [keyof Omit<ThemeColors, "lights">, string][] = [
  ["ground", "Background"],
  ["surface", "Panels"],
  ["raised", "Menus and bubbles"],
  ["line", "Lines"],
  ["text", "Main text"],
  ["textSoft", "Second text"],
  ["accent", "Your colour"],
  ["onAccent", "Text on your colour"],
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
];

const HEX = /^#[0-9a-f]{6}$/i;
type DisplayFont = (typeof DISPLAY_FONTS)[number];
type BodyFont = (typeof BODY_FONTS)[number];

/**
 * "Make your own": a theme maker on the phone. Start from what you're using (or a theme of yours),
 * change the look, every colour, the shapes, and add art: a wallpaper, a pattern, stickers in the
 * spots kept for them, and falling effects. The preview and the readability check update as you
 * go; Realm can fix anything hard to read. Save it, use it, and share it in the store.
 */
export default function Studio() {
  const { t, resolved } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const apply = useApplyTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [file, setFile] = useState<ThemeFile | null>(id ? null : toFile(resolved, "My theme"));
  const [tags, setTags] = useState<ThemeTag[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<ThemeDetail | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [ideas, setIdeas] = useState<PaletteSuggestion[]>([]);

  // Editing one of your themes: start from its newest version.
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [{ file: f }, d] = await Promise.all([
          api<{ file: ThemeFile }>(`/themes/${id}/file`),
          api<ThemeDetail>(`/themes/${id}`),
        ]);
        setFile(f);
        setTags(d.tags);
        setSaved(d);
      } catch (err) {
        alert("Couldn't open it", err instanceof ApiError ? err.message : "Try again.");
        router.back();
      }
    })();
  }, [id, router]);

  const live = useMemo(() => (file ? resolveTheme(file) : null), [file]);
  const problems = useMemo(() => (live ? checkTheme(live) : []), [live]);

  if (!file || !live) {
    return (
      <AppScreen>
        <TopBar title="Make a theme" />
        <Loading />
      </AppScreen>
    );
  }

  const edit = (patch: Partial<ThemeFile>) => {
    setFile((f) => (f ? { ...f, ...patch } : f));
    setNotes([]);
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

  const fix = () => {
    const fixed = fixTheme(live);
    edit({ colors: fixed.colors, style: { ...file.style, glow: fixed.style.glow } });
  };

  /** Pick a picture, shrink it, upload it, and put it where it goes. */
  async function pickPicture(put: (ref: string) => void) {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    setBusy("picture");
    try {
      const small = await shrinkPhoto(res.assets[0]);
      const mediaId = await upload({
        uri: small.uri,
        kind: "image",
        mimeType: small.mimeType,
      });
      put(`media:${mediaId}`);
    } catch (err) {
      alert("Picture not added", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  /** Colour sets from your picture (the server reads its colours). */
  async function suggest(ref: string) {
    setBusy("ideas");
    try {
      const { suggestions } = await api<{ suggestions: PaletteSuggestion[] }>("/themes/palette", {
        body: { mediaId: ref.slice(6) },
      });
      setIdeas(suggestions);
    } catch (err) {
      alert("No colours yet", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!file) return;
    setBusy("save");
    try {
      const body = {
        file,
        tags,
        priceCents: saved?.priceCents ?? 0,
        ownArt: saved?.ownArt ?? false,
      };
      const res = await api<{ theme: ThemeDetail; problems: string[] }>(
        saved ? `/themes/${saved.id}/versions` : "/themes",
        { body },
      );
      setSaved(res.theme);
      setFile(res.theme.file);
      setNotes(res.problems);
    } catch (err) {
      alert("Not saved", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!saved) return;
    setBusy("share");
    try {
      setSaved(await api<ThemeDetail>(`/themes/${saved.id}/publish`, { method: "POST" }));
      alert("It's in the store", "People can find it in More themes now.");
    } catch (err) {
      alert("Not shared", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  const art = file.art ?? {};
  const wall = art.wallpaper;
  const pattern = art.pattern;
  const effect = art.effect;
  return (
    <AppScreen>
      <TopBar title={saved ? "Edit theme" : "Make a theme"} />
      <View style={s.stage}>
        <ThemePreview theme={live} width={118} />
        <View style={s.stageText}>
          <TextInput
            value={file.name}
            onChangeText={(name) => edit({ name })}
            maxLength={40}
            style={s.nameInput}
            accessibilityLabel="Theme name"
            placeholder="Name your theme"
            placeholderTextColor={t.colors.textSoft}
          />
          {problems.length ? (
            <View style={s.warn}>
              <Text style={s.warnText}>
                {problems.length === 1 ? "1 thing is" : `${problems.length} things are`} hard to
                read.
              </Text>
              <Pressable onPress={fix} accessibilityRole="button" style={s.fixBtn}>
                <Text style={s.fixText}>Fix it for me</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={s.ok}>Everything reads well.</Text>
          )}
          <Pill
            size="md"
            label={saved ? "Save changes" : "Save theme"}
            onPress={save}
            pending={busy === "save"}
            pendingLabel="Saving"
          />
        </View>
      </View>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {notes.map((n) => (
          <Text key={n} style={s.note}>
            {n}
          </Text>
        ))}
        {saved ? (
          <View style={s.after}>
            <Pill
              size="md"
              kind="ghost"
              label="Use it now"
              onPress={async () => apply(await themeChoice(saved.id))}
            />
            {saved.status === "draft" ? (
              <Pill
                size="md"
                kind="ghost"
                label="Share in the store (free)"
                onPress={share}
                pending={busy === "share"}
                pendingLabel="Sharing"
              />
            ) : (
              <Text style={s.note}>
                {saved.status === "published" ? "In the store." : "Hidden after reports."}
              </Text>
            )}
            <Text style={s.small}>To sell a theme, open it on the website.</Text>
          </View>
        ) : null}

        <Section title="Start from">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.row}
          >
            {[
              ...LOOKS.map((l) => ({ key: l.id, name: l.name, file: lookTheme(l.id, "mint") })),
              ...PRESETS.map((p) => ({
                key: p.id,
                name: p.file.name,
                file: ThemeFile.parse(p.file),
              })),
            ].map((o) => (
              <Pressable
                key={o.key}
                onPress={() => {
                  const keepArt = file.art?.wallpaper
                    ? { ...o.file.art, wallpaper: file.art.wallpaper }
                    : o.file.art;
                  setFile(
                    ThemeFile.parse({
                      ...o.file,
                      name: file.name,
                      ...(keepArt ? { art: keepArt } : {}),
                    }),
                  );
                }}
                accessibilityRole="button"
                accessibilityLabel={`Start from ${o.name}`}
                style={s.start}
              >
                <ThemePreview theme={resolveTheme(o.file)} width={84} />
                <Text style={s.startName} numberOfLines={1}>
                  {o.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Label>Base look (then change any part below)</Label>
          <Options
            value={file.look}
            items={LOOKS.map((l) => [l.id, l.name])}
            onChange={(look) => edit({ look })}
          />
        </Section>

        <Section title="Colours">
          {COLOR_ROLES.map(([k, label]) => (
            <ColorRow
              key={k}
              label={label}
              value={live.colors[k]}
              onChange={(v) => setColor(k, v)}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <ColorRow
              key={`light${i}`}
              label={`Light ${i + 1}`}
              value={file.colors.lights[i] ?? "#000000"}
              onChange={(v) => setLight(i, v)}
            />
          ))}
        </Section>

        <Section title="Shapes and style">
          <Label>Corners</Label>
          <Options
            value={live.style.corners}
            items={[
              ["square", "Square"],
              ["soft", "Soft"],
              ["round", "Round"],
            ]}
            onChange={(v) => setStyle("corners", v)}
          />
          <Label>Glow behind things</Label>
          <Options
            value={String(live.style.glow)}
            items={[
              ["0", "Off"],
              ["0.25", "Low"],
              ["0.5", "Some"],
              ["0.75", "Lots"],
              ["1", "Full"],
            ]}
            onChange={(v) => setStyle("glow", Number(v))}
          />
          <Label>Stories</Label>
          <Options
            value={live.style.stories}
            items={[
              ["rings", "Rings"],
              ["bands", "Bands"],
              ["thin", "Thin"],
            ]}
            onChange={(v) => setStyle("stories", v)}
          />
          <Label>Posts</Label>
          <Options
            value={live.style.posts}
            items={[
              ["glow", "Glow"],
              ["ticket", "Ticket"],
              ["thread", "Thread"],
            ]}
            onChange={(v) => setStyle("posts", v)}
          />
          <Label>Tab bar</Label>
          <Options
            value={live.style.tabBar}
            items={[
              ["floating", "Floating"],
              ["bar", "Bar"],
            ]}
            onChange={(v) => setStyle("tabBar", v)}
          />
          <Label>Chat bubbles</Label>
          <Options
            value={live.style.bubbles}
            items={[
              ["round", "Round"],
              ["soft", "Soft"],
              ["square", "Square"],
            ]}
            onChange={(v) => setStyle("bubbles", v)}
          />
          <Label>Icons</Label>
          <Options
            value={live.style.icons}
            items={[
              ["regular", "Thin"],
              ["bold", "Bold"],
              ["fill", "Filled"],
              ["duotone", "Two-tone"],
            ]}
            onChange={(v) => setStyle("icons", v)}
          />
          <Label>Pictures of people</Label>
          <Options
            value={live.style.avatars}
            items={[
              ["circle", "Circles"],
              ["rounded", "Rounded squares"],
            ]}
            onChange={(v) => setStyle("avatars", v)}
          />
          <Label>Film grain</Label>
          <Options
            value={live.style.grain ? "on" : "off"}
            items={[
              ["off", "Off"],
              ["on", "On"],
            ]}
            onChange={(v) => setStyle("grain", v === "on")}
          />
          <Label>Text size</Label>
          <Options
            value={live.type.size}
            items={[
              ["normal", "Normal"],
              ["large", "Large"],
              ["larger", "Larger"],
            ]}
            onChange={(size) => edit({ type: { ...file.type, size } })}
          />
        </Section>

        <Section title="Wallpaper">
          {wall ? (
            <>
              <Label>Dim it so text stays readable</Label>
              <Options
                value={String(wall.dim)}
                items={[
                  ["0.35", "A little"],
                  ["0.55", "Some"],
                  ["0.7", "More"],
                  ["0.85", "Lots"],
                ]}
                onChange={(v) => setArt({ wallpaper: { ...wall, dim: Number(v) } })}
              />
              <Label>Blur</Label>
              <Options
                value={wall.blur}
                items={[
                  ["none", "None"],
                  ["soft", "Soft"],
                  ["strong", "Strong"],
                ]}
                onChange={(blur) => setArt({ wallpaper: { ...wall, blur } })}
              />
              <Label>Keep this part in view</Label>
              <Options
                value={wall.focus ?? "center"}
                items={[
                  ["center", "Middle"],
                  ["top", "Top"],
                  ["bottom", "Bottom"],
                  ["left", "Left"],
                  ["right", "Right"],
                ]}
                onChange={(focus) => setArt({ wallpaper: { ...wall, focus } })}
              />
              <Label>Brightness</Label>
              <Options
                value={String(wall.brightness ?? 1)}
                items={[
                  ["0.6", "Darker"],
                  ["0.8", "A bit darker"],
                  ["1", "As it is"],
                  ["1.1", "Brighter"],
                ]}
                onChange={(v) => setArt({ wallpaper: { ...wall, brightness: Number(v) } })}
              />
              <ColorRow
                label="Layer colour"
                value={wall.overlay ?? live.colors.ground}
                onChange={(overlay) => setArt({ wallpaper: { ...wall, overlay } })}
              />
              <ColorRow
                label="Layer fades to"
                value={wall.overlay2 ?? wall.overlay ?? live.colors.ground}
                onChange={(overlay2) => setArt({ wallpaper: { ...wall, overlay2 } })}
              />
              <Pill
                size="md"
                kind="ghost"
                label="Suggest colours from it"
                pending={busy === "ideas"}
                pendingLabel="Looking"
                onPress={() => suggest(wall.image)}
              />
              {ideas.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.row}
                >
                  {ideas.map((idea) => (
                    <Pressable
                      key={idea.name}
                      onPress={() =>
                        edit({
                          colors: idea.colors,
                          panels: { ...file.panels, ...idea.panels },
                          buttons: { ...file.buttons, ...idea.buttons },
                          art: {
                            ...file.art,
                            wallpaper: { ...wall, overlay: idea.overlay, overlay2: idea.overlay2 },
                          },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={idea.name}
                      style={s.idea}
                    >
                      <View style={s.ideaStrip}>
                        {[
                          idea.colors.ground,
                          idea.colors.surface,
                          idea.colors.accent,
                          idea.colors.accent2 ?? idea.colors.accent,
                          idea.colors.text,
                        ].map((c, i) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed strip
                          <View key={i} style={{ flex: 1, backgroundColor: c }} />
                        ))}
                      </View>
                      <Text style={s.startName}>{idea.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              <Pill
                size="md"
                kind="quiet"
                label="Remove wallpaper"
                onPress={() => setArt({ wallpaper: undefined })}
              />
            </>
          ) : (
            <Pill
              size="md"
              kind="ghost"
              label="Pick a wallpaper"
              pending={busy === "picture"}
              pendingLabel="Uploading"
              onPress={() =>
                pickPicture((image) => setArt({ wallpaper: { image, dim: 0.55, blur: "soft" } }))
              }
            />
          )}
        </Section>

        <Section title="Panels">
          <Label>How solid (see-through lets your picture show)</Label>
          <Options
            value={String(live.panels.opacity)}
            items={[
              ["0.45", "See-through"],
              ["0.6", "Glass"],
              ["0.8", "Mostly solid"],
              ["1", "Solid"],
            ]}
            onChange={(v) => edit({ panels: { ...file.panels, opacity: Number(v) } })}
          />
          <Label>Section titles</Label>
          <Options
            value={live.panels.headers}
            items={[
              ["plain", "Plain words"],
              ["bar", "On a coloured strip"],
            ]}
            onChange={(headers) => edit({ panels: { ...file.panels, headers } })}
          />
          <Label>Edges</Label>
          <Options
            value={live.panels.border}
            items={[
              ["none", "None"],
              ["line", "Thin line"],
              ["accent", "Your colour"],
            ]}
            onChange={(border) => edit({ panels: { ...file.panels, border } })}
          />
        </Section>

        <Section title="Buttons">
          <Options
            value={live.buttons.shape}
            items={[
              ["pill", "Pill"],
              ["rounded", "Rounded"],
              ["square", "Square"],
            ]}
            onChange={(shape) => edit({ buttons: { ...file.buttons, shape } })}
          />
          <Options
            value={live.buttons.fill}
            items={[
              ["solid", "Solid"],
              ["gradient", "Gradient"],
              ["outline", "Outline"],
            ]}
            onChange={(fill) => edit({ buttons: { ...file.buttons, fill } })}
          />
          <Options
            value={live.buttons.glow ? "on" : "off"}
            items={[
              ["off", "No glow"],
              ["on", "Glow"],
            ]}
            onChange={(v) => edit({ buttons: { ...file.buttons, glow: v === "on" } })}
          />
          <ColorRow
            label="Second colour (gradient end)"
            value={live.colors.accent2}
            onChange={(v) => setColor("accent2", v)}
          />
        </Section>

        <Section title="Fonts">
          <Label>Titles and names</Label>
          <Options
            value={live.type.display}
            items={DISPLAY_FONTS.map((f) => [f, FONT_NAMES[f] ?? f] as [DisplayFont, string])}
            onChange={(display) => edit({ type: { ...file.type, display } })}
          />
          <Label>Reading text</Label>
          <Options
            value={live.type.body}
            items={BODY_FONTS.map((f) => [f, FONT_NAMES[f] ?? f] as [BodyFont, string])}
            onChange={(body) => edit({ type: { ...file.type, body } })}
          />
          <Text style={[s.fontSample, { fontFamily: t.fonts.display }]}>Friday squad</Text>
        </Section>

        <Section title="Pattern">
          <Chips
            value={art.pattern?.shape ?? "none"}
            items={["none", ...PATTERN_SHAPES]}
            onChange={(shape) =>
              setArt({
                pattern:
                  shape === "none"
                    ? undefined
                    : {
                        shape: shape as (typeof PATTERN_SHAPES)[number],
                        color: art.pattern?.color ?? file.colors.accent,
                        opacity: art.pattern?.opacity ?? 0.08,
                        size: art.pattern?.size ?? 1,
                      },
              })
            }
          />
          {pattern ? (
            <>
              <ColorRow
                label="Pattern colour"
                value={pattern.color}
                onChange={(color) => setArt({ pattern: { ...pattern, color } })}
              />
              <Label>How strong</Label>
              <Options
                value={String(pattern.opacity)}
                items={[
                  ["0.05", "Faint"],
                  ["0.08", "Light"],
                  ["0.14", "Clear"],
                  ["0.22", "Strong"],
                ]}
                onChange={(v) => setArt({ pattern: { ...pattern, opacity: Number(v) } })}
              />
            </>
          ) : null}
        </Section>

        <Section title="Stickers">
          <Text style={s.small}>
            Stickers sit in spots kept for them, never over buttons or messages.
          </Text>
          {(
            [
              ["header", "Top of Home"],
              ["empty", "Empty screens"],
              ["profile", "Your profile banner"],
            ] as const
          ).map(([slot, label]) => (
            <View key={slot} style={s.stickerRow}>
              <Text style={s.label}>{label}</Text>
              {art.stickers?.[slot] ? (
                <Pressable
                  onPress={() => setArt({ stickers: { ...art.stickers, [slot]: undefined } })}
                  accessibilityRole="button"
                  style={s.smallBtn}
                >
                  <Text style={s.smallBtnText}>Remove</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() =>
                    pickPicture((ref) => setArt({ stickers: { ...art.stickers, [slot]: ref } }))
                  }
                  accessibilityRole="button"
                  style={s.smallBtn}
                >
                  <Text style={s.smallBtnText}>Add</Text>
                </Pressable>
              )}
            </View>
          ))}
        </Section>

        <Section title="Falling effect">
          <Chips
            value={art.effect?.shape ?? "none"}
            items={["none", ...EFFECT_SHAPES]}
            onChange={(shape) =>
              setArt({
                effect:
                  shape === "none"
                    ? undefined
                    : {
                        shape: shape as (typeof EFFECT_SHAPES)[number],
                        color: art.effect?.color ?? "#ffffff",
                        amount: art.effect?.amount ?? "few",
                      },
              })
            }
          />
          {effect ? (
            <>
              <ColorRow
                label="Effect colour"
                value={effect.color}
                onChange={(color) => setArt({ effect: { ...effect, color } })}
              />
              <Options
                value={effect.amount}
                items={[
                  ["few", "A few"],
                  ["some", "Some"],
                  ["lots", "Lots"],
                ]}
                onChange={(amount) => setArt({ effect: { ...effect, amount } })}
              />
              <Text style={s.small}>Effects stop when someone turns motion off.</Text>
            </>
          ) : null}
        </Section>

        <Section title="For the store">
          <TextInput
            value={file.description ?? ""}
            onChangeText={(description) => edit({ description: description || undefined })}
            placeholder="Describe your theme (optional)"
            placeholderTextColor={t.colors.textSoft}
            maxLength={200}
            multiline
            style={s.input}
          />
          <Label>Tags (up to 5)</Label>
          <View style={s.wrap}>
            {TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() =>
                    setTags((ts) => (on ? ts.filter((x) => x !== tag) : [...ts, tag].slice(0, 5)))
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[s.chip, on && s.chipOn]}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
      </ScrollView>
    </AppScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const s = useStyles(make);
  return (
    <View style={s.section}>
      <Text style={s.heading} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: string }) {
  const s = useStyles(make);
  return <Text style={s.label}>{children}</Text>;
}

function Options<V extends string>({
  value,
  items,
  onChange,
}: {
  value: string;
  items: [V, string][];
  onChange: (v: V) => void;
}) {
  const s = useStyles(make);
  return (
    <View style={s.wrap} accessibilityRole="radiogroup">
      {items.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[s.chip, on && s.chipOn]}
          >
            <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chips({
  value,
  items,
  onChange,
}: {
  value: string;
  items: readonly string[];
  onChange: (v: string) => void;
}) {
  const s = useStyles(make);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {items.map((v) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[s.chip, on && s.chipOn]}
          >
            <Text style={[s.chipText, s.cap, on && s.chipTextOn]}>{v === "none" ? "None" : v}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** One colour: its swatch, its code (type your own), and quick picks. */
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  useEffect(() => setText(value), [value]);
  return (
    <View style={s.colorRow}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}. ${open ? "Hide" : "Show"} colours`}
        style={s.colorHead}
      >
        <View style={[s.swatch, { backgroundColor: value }]} />
        <Text style={s.colorLabel}>{label}</Text>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (HEX.test(v)) onChange(v);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          style={[s.hex, !HEX.test(text) && { borderColor: t.colors.dangerLine }]}
          accessibilityLabel={`${label} colour code`}
        />
        <Icon name={open ? "CaretDown" : "CaretRight"} size={16} color={t.colors.textSoft} />
      </Pressable>
      {open ? (
        <View style={s.palette}>
          {PALETTE.map((c) => (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              accessibilityRole="button"
              accessibilityLabel={c}
              style={[s.dot, { backgroundColor: c }, c === value && s.dotOn]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    stage: {
      flexDirection: "row",
      gap: 14,
      padding: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.bg,
    },
    stageText: { flex: 1, gap: 10, justifyContent: "center" },
    nameInput: {
      fontFamily: t.fonts.displayBold,
      fontSize: 20 * t.textScale,
      color: t.colors.text,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.borderStrong,
      paddingVertical: 6,
    },
    warn: { gap: 4 },
    warnText: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.danger },
    fixBtn: { minHeight: 32, justifyContent: "center" },
    fixText: {
      fontFamily: t.fonts.bold,
      fontSize: 14 * t.textScale,
      color: t.colors.text,
      textDecorationLine: "underline",
    },
    ok: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.success },
    body: { paddingBottom: 64 },
    note: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      lineHeight: 20 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 20,
      marginTop: 10,
    },
    after: { gap: 10, paddingHorizontal: 20, paddingTop: 14 },
    section: {
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      gap: 10,
    },
    heading: { fontFamily: t.fonts.displayBold, fontSize: 19 * t.textScale, color: t.colors.text },
    label: {
      fontFamily: t.fonts.bold,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 4,
    },
    small: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      lineHeight: 19 * t.textScale,
      color: t.colors.textSoft,
    },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    row: { gap: 8 },
    chip: {
      minHeight: 38,
      paddingHorizontal: 14,
      borderRadius: 19,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    chipOn: { backgroundColor: t.colors.text, borderColor: t.colors.text },
    chipText: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.textSoft },
    cap: { textTransform: "capitalize" },
    chipTextOn: { color: t.colors.bg },
    colorRow: { gap: 8 },
    colorHead: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
    swatch: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
    },
    colorLabel: {
      flex: 1,
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
    },
    hex: {
      width: 92,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: 10,
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.text,
    },
    palette: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 42 },
    dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: t.colors.border },
    dotOn: { borderWidth: 3, borderColor: t.colors.text },
    start: { width: 96, gap: 6 },
    startName: { fontFamily: t.fonts.bold, fontSize: 12 * t.textScale, color: t.colors.text },
    idea: { gap: 6, width: 120 },
    ideaStrip: { height: 34, borderRadius: 8, overflow: "hidden", flexDirection: "row" },
    fontSample: { fontSize: 26 * t.textScale, color: t.colors.text, marginTop: 6 },
    stickerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
    },
    smallBtn: {
      minHeight: 38,
      paddingHorizontal: 16,
      borderRadius: 19,
      backgroundColor: t.colors.surfaceRaised,
      justifyContent: "center",
    },
    smallBtnText: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.text },
    input: {
      minHeight: 72,
      borderRadius: t.radius.input,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      padding: 12,
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      textAlignVertical: "top",
    },
  });
