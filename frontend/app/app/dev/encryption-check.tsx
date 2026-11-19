import { runSelfCheck, type SelfCheckStep } from "@realm/e2ee";
import { Redirect } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { runStorageCheck } from "@/e2ee/storage-check";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles } from "@/theme";
import { Pill } from "@/ui";

/**
 * Developer builds only: runs the encryption library through a whole small group on this phone,
 * then checks the phone's sealed storage (docs/E2EE.md, phases 1 and 2). Nothing is sent
 * anywhere, and what it saves it removes again.
 */
export default function EncryptionCheck() {
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const [steps, setSteps] = useState<SelfCheckStep[] | null>(null);
  const [running, setRunning] = useState(false);
  const [crash, setCrash] = useState<string | null>(null);

  if (!__DEV__) return <Redirect href="/settings" />;

  async function run() {
    setRunning(true);
    setCrash(null);
    setSteps(null);
    try {
      const clock = () => performance.now();
      const chat = await runSelfCheck(clock, 5);
      setSteps(chat);
      setSteps([...chat, ...(await runStorageCheck(clock))]);
    } catch (err) {
      setCrash(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const passed = steps?.every((x) => x.ok);
  const total = steps?.reduce((sum, x) => sum + x.ms, 0) ?? 0;

  return (
    <AppScreen>
      <TopBar title="Encryption check" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}
      >
        <Text style={s.lead}>
          Makes keys for 5 pretend devices, starts a group, sends a message, removes someone and
          checks they're locked out. Then seals a record with this phone's keystore and checks a
          changed file is refused. All on this phone; nothing is sent, and nothing is left behind.
        </Text>
        <Pill
          label={steps ? "Run again" : "Run the check"}
          onPress={run}
          pending={running}
          pendingLabel="Checking"
        />

        {crash ? <Text style={s.bad}>It stopped: {crash}</Text> : null}

        {steps ? (
          <View style={s.card}>
            <Text style={passed ? s.verdict : [s.verdict, s.badText]}>
              {passed ? `All ${steps.length} steps passed` : "Something failed"} ·{" "}
              {Math.round(total)} ms
            </Text>
            {steps.map((x) => (
              <View key={x.name} style={s.row}>
                <Text style={x.ok ? s.ok : s.badText}>{x.ok ? "✓" : "✕"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{x.name}</Text>
                  {x.detail ? (
                    <Text style={s.detail} selectable>
                      {x.detail}
                    </Text>
                  ) : null}
                </View>
                <Text style={s.ms}>{x.ms.toFixed(0)} ms</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
    },
    card: {
      backgroundColor: t.colors.surfaceRaised,
      borderColor: t.colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    verdict: { fontFamily: t.fonts.bold, fontSize: 17 * t.textScale, color: t.colors.text },
    row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    ok: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.accent },
    badText: { fontFamily: t.fonts.bold, color: t.colors.danger },
    bad: { fontFamily: t.fonts.body, fontSize: 15 * t.textScale, color: t.colors.danger },
    name: { fontFamily: t.fonts.body, fontSize: 15 * t.textScale, color: t.colors.text },
    detail: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      lineHeight: 18 * t.textScale,
      color: t.colors.textMuted,
      marginTop: 2,
    },
    ms: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textMuted,
      fontVariant: ["tabular-nums"],
    },
  });
