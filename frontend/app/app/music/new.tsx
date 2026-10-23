import type { Playlist } from "@realm/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, api } from "@/server";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

/** A new playlist: a name, and (from a song's menu) that song in it already. */
export default function NewPlaylist() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) {
      setError("Give it a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const list = await api<Playlist>("/music/playlists", { body: { name: name.trim() } });
      if (add && /^\d{1,20}$/.test(add)) {
        await api(`/music/playlists/${list.id}/items/${add}`, { method: "PUT" });
      }
      router.replace({ pathname: "/music/playlist/[id]", params: { id: list.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <TopBar title="New playlist" />
      <View style={s.body}>
        <Text style={s.label}>Give your playlist a name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Late night drive"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          maxLength={60}
          autoFocus
          onSubmitEditing={create}
          style={s.input}
          accessibilityLabel="Playlist name"
        />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pill label="Create" pending={busy} pendingLabel="Creating" onPress={create} />
        <Text style={s.small}>It's private until you choose to share it.</Text>
      </View>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { padding: 24, gap: 14 },
    label: {
      fontFamily: t.fonts.displayBold,
      fontSize: 22 * t.textScale,
      color: t.colors.heading,
      textAlign: "center",
      marginTop: 30,
    },
    input: {
      fontFamily: t.fonts.display,
      fontSize: 26 * t.textScale,
      color: t.colors.text,
      textAlign: "center",
      borderBottomWidth: 2,
      borderBottomColor: t.colors.borderStrong,
      paddingVertical: 10,
      marginBottom: 10,
    },
    error: {
      fontFamily: t.fonts.bold,
      fontSize: 14 * t.textScale,
      color: t.colors.danger,
      textAlign: "center",
    },
    small: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
      textAlign: "center",
    },
  });
