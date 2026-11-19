import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { e2ee, useE2eeStatus } from "@/e2ee";
import { Icon } from "@/icon";
import { AppScreen, Loading, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Notice, Pill } from "@/ui";

/**
 * The security code for an end-to-end encrypted chat (docs/E2EE.md §6.4): 60 digits made from
 * both people's account keys. If the two phones show the same digits, nobody is in between. It's
 * also where you accept someone's new code after they set Realm up again.
 */
export default function SafetyCode() {
  const { t } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const status = useE2eeStatus();
  const them = name || "them";
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [changed, setChanged] = useState(false);
  const [copied, setCopied] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    const client = status === "ready" ? e2ee.client : null;
    if (!client || !userId) {
      setCode(null);
      return;
    }
    setChanged(await client.keyChanged(userId));
    setCode(await client.safetyNumber(userId));
  }, [status, userId]);
  useEffect(() => {
    load().catch(() => setCode(null));
  }, [load]);
  useEffect(
    () =>
      e2ee.onKeyChange((id) => {
        if (id === userId) load().catch(() => {});
      }),
    [userId, load],
  );

  async function accept() {
    if (!e2ee.client || !userId) return;
    setAccepting(true);
    try {
      await e2ee.client.acceptKeyChange(userId);
      await load();
    } finally {
      setAccepting(false);
    }
  }

  const groups = code?.split(" ") ?? [];

  return (
    <AppScreen>
      <TopBar title="Security code" />
      {code === undefined ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 28 }]}>
          {changed ? (
            <View style={s.changed}>
              <Notice>
                {them}'s security code changed. That happens when someone sets Realm up again on a
                new phone. Check the new code with them, in person or on a call, before you accept
                it.
              </Notice>
              <Pill
                kind="ghost"
                size="md"
                label="I've checked. Accept the new code"
                onPress={accept}
                pending={accepting}
                pendingLabel="Accepting"
              />
            </View>
          ) : null}

          {code ? (
            <>
              <Text style={s.lead}>
                Ask {them} to open this screen too. If you both see the same numbers, only your two
                devices can read this chat. Nobody in between can, and Realm can't either.
              </Text>
              <View
                style={s.code}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`Security code: ${groups.join(", ")}`}
              >
                {groups.map((g, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: twelve fixed groups, never reordered
                  <Text key={i} style={s.group}>
                    {g}
                  </Text>
                ))}
              </View>
              <Pill
                kind="ghost"
                size="md"
                label={copied ? "Copied" : "Copy the code"}
                onPress={async () => {
                  await Clipboard.setStringAsync(code);
                  setCopied(true);
                }}
              />
            </>
          ) : (
            <Text style={s.lead}>
              The security code shows here once this device and {them}'s have both set up encrypted
              chats.
            </Text>
          )}

          <View style={s.fact}>
            <Icon name="Lock" size={18} color={t.colors.textSoft} />
            <Text style={s.factText}>
              Messages here are locked on your device and only unlocked on theirs. Realm's servers
              pass them along without being able to read them.
            </Text>
          </View>
          <View style={s.fact}>
            <Icon name="WarningCircle" size={18} color={t.colors.textSoft} />
            <Text style={s.factText}>
              This is a test build. The encryption hasn't been checked by independent experts yet.
            </Text>
          </View>
        </ScrollView>
      )}
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { padding: 20, gap: 20 },
    changed: { gap: 12 },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      lineHeight: 24 * t.textScale,
      color: t.colors.text,
    },
    // Three groups to a row with clear gaps between them: easy to read aloud and compare.
    code: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 14,
      paddingVertical: 20,
      paddingHorizontal: 18,
      borderRadius: 18,
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    group: {
      width: "33.33%",
      textAlign: "center",
      fontFamily: t.fonts.bold,
      fontSize: 20 * t.textScale,
      letterSpacing: 1,
      fontVariant: ["tabular-nums"],
      color: t.colors.text,
    },
    fact: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    factText: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.textSoft,
    },
  });
