import type { SpaceDetail } from "@realm/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, api } from "@/server";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, THEME_ORDER, themes, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

/** Ideas to start from, so a new Space isn't a blank page. */
const KINDS = [
  { id: "friends", label: "Friends", line: "Just your crew" },
  { id: "gaming", label: "Gaming", line: "Squads and sessions" },
  { id: "study", label: "Study", line: "A class or a course" },
  { id: "club", label: "Club", line: "Fans, a team, a hobby" },
] as const;

/**
 * Start a Space: a name, what it's for and its colour. It starts with a lobby and a voice room,
 * and you as its owner; invite people from inside.
 */
export default function NewSpace() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const { join } = useLocalSearchParams<{ join?: string }>();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("friends");
  const [colour, setColour] = useState<(typeof THEME_ORDER)[number]>("mint");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (name.trim().length < 2) {
      setError("Give your Space a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const space = await api<SpaceDetail>("/communities", {
        body: {
          name: name.trim(),
          accent: colour,
          // What it's for becomes its first description (changeable later).
          description: KINDS.find((k) => k.id === kind)?.line,
        },
      });
      router.replace({ pathname: "/space/[id]", params: { id: space.slug } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <TopBar title={join ? "Join a Space" : "Start a Space"} />
      <View style={s.body}>
        <View style={[s.preview, { backgroundColor: themes[colour].accent }]}>
          <Text style={s.previewText}>{(name.trim() || "My Space").slice(0, 2).toUpperCase()}</Text>
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name your Space"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          maxLength={60}
          style={s.input}
          accessibilityLabel="Space name"
        />
        <Text style={s.label}>What's it for?</Text>
        <View style={s.kinds}>
          {KINDS.map((k) => (
            <Pressable
              key={k.id}
              onPress={() => setKind(k.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: kind === k.id }}
              style={[s.kind, kind === k.id && { borderColor: accent }]}
            >
              <Text style={s.kindTitle}>{k.label}</Text>
              <Text style={s.kindLine}>{k.line}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>Its colour</Text>
        <View style={s.colours}>
          {THEME_ORDER.map((id) => (
            <Pressable
              key={id}
              onPress={() => setColour(id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: colour === id }}
              accessibilityLabel={themes[id].name}
              style={[
                s.colour,
                { backgroundColor: themes[id].accent },
                colour === id && s.colourOn,
              ]}
            />
          ))}
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pill label="Start it" pending={busy} pendingLabel="Starting" onPress={create} />
        <Text style={s.small}>
          It starts private: only people you invite can join. You can make it public later.
        </Text>
      </View>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { padding: 20, gap: 12 },
    preview: {
      alignSelf: "center",
      width: 84,
      height: 84,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    previewText: { fontFamily: t.fonts.display, fontSize: 28 * t.textScale, color: "#0b0b0e" },
    input: {
      fontFamily: t.fonts.display,
      fontSize: 24 * t.textScale,
      color: t.colors.text,
      textAlign: "center",
      borderBottomWidth: 2,
      borderBottomColor: t.colors.borderStrong,
      paddingVertical: 10,
    },
    label: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      marginTop: 10,
    },
    kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kind: {
      width: "48.5%",
      padding: 12,
      borderRadius: t.radius.card,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    kindTitle: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    kindLine: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    colours: { flexDirection: "row", gap: 12 },
    colour: { width: 40, height: 40, borderRadius: 20 },
    colourOn: { borderWidth: 3, borderColor: t.colors.text },
    error: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.danger },
    small: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
      textAlign: "center",
    },
  });
