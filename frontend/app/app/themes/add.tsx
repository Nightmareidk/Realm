import { resolveTheme, type ThemeCheck, type ThemeDetail, ThemeFile } from "@realm/contracts";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, api } from "@/server";
import { AppScreen, TopBar } from "@/social/screen";
import { fonts, type NativeTheme, useStyles, useTheme } from "@/theme";
import { ThemePreview } from "@/themes/preview";
import { themeChoice, useApplyTheme } from "@/themes/use";
import { Pill } from "@/ui";

/** The first thing wrong with a pasted file, said plainly with where it is. */
function readFile(raw: string): { file: ThemeFile } | { error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "That isn't a theme file. A theme file starts with { and ends with }." };
  }
  if (json && typeof json === "object" && "$schema" in json) {
    const { $schema: _, ...rest } = json as Record<string, unknown>;
    json = rest;
  }
  const parsed = ThemeFile.safeParse(json);
  if (parsed.success) return { file: parsed.data };
  const issue = parsed.error.issues[0];
  const where = issue?.path.length ? ` (at ${issue.path.join(" › ")})` : "";
  return { error: `${issue?.message ?? "Something in the file isn't right"}${where}.` };
}

/**
 * "Add your own theme": paste a theme file (theme.json) someone shared, check it, save it to your
 * themes and use it. Realm checks every file the same way the store does, and fixes colours that
 * would be hard to read. Pictures travel in theme packages, which the website opens.
 */
export default function AddTheme() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const apply = useApplyTheme();
  const [raw, setRaw] = useState("");
  const [checked, setChecked] = useState<ThemeCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "save" | null>(null);

  async function check(text = raw) {
    setChecked(null);
    const read = readFile(text);
    if ("error" in read) return setError(read.error);
    setError(null);
    setBusy("check");
    try {
      const res = await api<ThemeCheck>("/themes/check", {
        body: { file: read.file },
      });
      if (!res.ok) setError(res.problems[0] ?? "Realm couldn't use this theme.");
      else setChecked(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't check it. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function paste() {
    const text = await Clipboard.getStringAsync().catch(() => "");
    if (!text) return setError("There's nothing copied yet. Copy a theme file first.");
    setRaw(text.slice(0, 20_000));
    await check(text.slice(0, 20_000));
  }

  async function save() {
    if (!checked?.file) return;
    setBusy("save");
    try {
      const { theme } = await api<{ theme: ThemeDetail }>("/themes", {
        body: { file: checked.file },
      });
      await apply(await themeChoice(theme.id));
      router.replace(`/themes/${theme.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save it. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppScreen>
      <TopBar title="Add your own theme" />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.lead}>
          Paste a theme file someone shared with you. Realm checks it, keeps it readable, and saves
          it to your themes.
        </Text>
        <Pill kind="ghost" label="Paste from what you copied" onPress={paste} />
        <TextInput
          value={raw}
          onChangeText={(v) => {
            setRaw(v);
            setChecked(null);
            setError(null);
          }}
          placeholder={'{ "format": "realm-theme", … }'}
          placeholderTextColor={t.colors.textSoft}
          style={s.input}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20_000}
          accessibilityLabel="Theme file"
        />
        {error ? (
          <Text style={s.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {checked?.file ? (
          <View style={s.result}>
            <ThemePreview theme={resolveTheme(checked.file)} width={120} />
            <View style={s.resultText}>
              <Text style={s.name}>{checked.file.name}</Text>
              {checked.problems.length ? (
                checked.problems.map((p) => (
                  <Text key={p} style={s.note}>
                    {p}
                  </Text>
                ))
              ) : (
                <Text style={s.note}>Everything reads well.</Text>
              )}
            </View>
          </View>
        ) : null}
        {checked?.file ? (
          <Pill
            label="Save and use it"
            onPress={save}
            pending={busy === "save"}
            pendingLabel="Saving"
          />
        ) : (
          <Pill
            kind="ghost"
            label="Check the theme"
            onPress={() => check()}
            pending={busy === "check"}
            pendingLabel="Checking"
          />
        )}
        <Text style={s.small}>
          Themes are only colours, shapes and pictures: they can't run code, read your messages or
          change what buttons do. Opening theme files and packages straight from your phone comes
          with the next app update; on the website you can open them now.
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { padding: 20, gap: 14, paddingBottom: 56 },
    lead: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: t.colors.textSoft },
    input: {
      minHeight: 180,
      borderRadius: t.radius.input,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      padding: 14,
      fontFamily: fonts.body,
      fontSize: 13,
      color: t.colors.text,
      textAlignVertical: "top",
    },
    error: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: t.colors.danger },
    result: {
      flexDirection: "row",
      gap: 14,
      padding: 14,
      borderRadius: t.radius.box,
      backgroundColor: t.colors.surface,
    },
    resultText: { flex: 1, gap: 6 },
    name: { fontFamily: fonts.displayBold, fontSize: 19, color: t.colors.text },
    note: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: t.colors.textSoft },
    small: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 19,
      color: t.colors.textSoft,
      marginTop: 8,
    },
  });
