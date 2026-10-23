import type { SpaceDetail } from "@realm/contracts";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, api } from "@/server";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

/** Join a Space with the invite a friend sent: the link or just its code. */
export default function JoinSpace() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    // "https://tomyrealm.com/invite/abc123" or just "abc123".
    const clean = code.trim().split(/[/?#]/).filter(Boolean).pop() ?? "";
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(clean)) {
      setError("That doesn't look like an invite. Paste the link or its code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const space = await api<SpaceDetail>(`/invites/${encodeURIComponent(clean)}`, { body: {} });
      router.replace({ pathname: "/space/[id]", params: { id: space.slug } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That invite didn't work.");
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <TopBar title="Join a Space" />
      <View style={s.body}>
        <Text style={s.title}>Got an invite?</Text>
        <Text style={s.line}>Paste the link a friend sent you, or just its code.</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="tomyrealm.com/invite/…"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={join}
          style={s.input}
          accessibilityLabel="Invite link or code"
        />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pill label="Join" pending={busy} pendingLabel="Joining" onPress={join} />
      </View>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { padding: 24, gap: 14 },
    title: {
      fontFamily: t.fonts.display,
      fontSize: 26 * t.textScale,
      color: t.colors.heading,
      marginTop: 20,
    },
    line: { fontFamily: t.fonts.body, fontSize: 15.5 * t.textScale, color: t.colors.textSoft },
    input: {
      minHeight: 52,
      borderRadius: t.radius.input,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      paddingHorizontal: 14,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
    error: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.danger },
  });
