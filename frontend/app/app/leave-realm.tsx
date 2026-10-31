import { DELETION_GRACE_DAYS } from "@realm/contracts";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Field, Notice, Pill } from "@/ui";

/**
 * Take a break (hidden until you sign in again) or delete your account (hidden now, gone after
 * 30 days unless you sign in). Google Play requires deleting to be possible inside the app.
 */
export default function LeaveRealm() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useSession();
  const twoStep = session.status === "signedIn" && session.user.twoStep;
  const [mode, setMode] = useState<"break" | "delete" | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sure, setSure] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (pending || !mode) return;
    if (mode === "delete" && sure.trim().toLowerCase() !== "delete") {
      setNotice('Type "delete" to confirm.');
      return;
    }
    setPending(true);
    setNotice(null);
    try {
      const body = { password, code: code.trim() || undefined };
      await api(mode === "break" ? "/users/@me/deactivate" : "/users/@me/delete", { body });
      // The server already signed every device out; this forgets the token here too.
      await signOut().catch(() => {});
      router.replace("/");
    } catch (err) {
      setPending(false);
      setNotice(
        err instanceof ApiError && err.code === "MFA_REQUIRED"
          ? "Enter the code from your authenticator app too."
          : err instanceof ApiError
            ? err.message
            : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <AppScreen>
      <TopBar title="Take a break or leave" />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {!mode ? (
            <>
              <View style={s.card}>
                <Text style={s.title}>Take a break</Text>
                <Text style={s.line}>
                  Your profile, posts and Stories are hidden until you sign in again. Nothing is
                  deleted.
                </Text>
                <Pill
                  size="md"
                  kind="ghost"
                  label="Take a break"
                  onPress={() => setMode("break")}
                />
              </View>
              <View style={s.card}>
                <Text style={s.title}>Delete your account</Text>
                <Text style={s.line}>
                  Hidden straight away, deleted for good after {DELETION_GRACE_DAYS} days. Sign in
                  before then and everything comes back.
                </Text>
                <Pill
                  size="md"
                  kind="ghost"
                  label="Delete account"
                  onPress={() => setMode("delete")}
                />
              </View>
            </>
          ) : (
            <View style={s.form}>
              <Text style={s.title}>
                {mode === "break"
                  ? "Take a break"
                  : `Delete your account in ${DELETION_GRACE_DAYS} days`}
              </Text>
              {notice ? <Notice>{notice}</Notice> : null}
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secret
                autoCapitalize="none"
                autoComplete="current-password"
              />
              {twoStep ? (
                <Field
                  label="Code from your authenticator app"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                />
              ) : null}
              {mode === "delete" ? (
                <Field
                  label='Type "delete" to confirm'
                  value={sure}
                  onChangeText={setSure}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : null}
              <Pill
                kind="ghost"
                label={mode === "break" ? "Hide my account" : "Delete my account"}
                pending={pending}
                pendingLabel="One moment"
                onPress={submit}
              />
              <Pill kind="quiet" label="Cancel" onPress={() => setMode(null)} />
              {mode === "delete" ? (
                <Text style={[s.line, { color: t.colors.textSoft }]}>
                  Want a copy first? Settings › Download your information.
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    body: { padding: 20, gap: 14 },
    card: {
      gap: 10,
      padding: 16,
      borderRadius: 18,
      backgroundColor: t.colors.surfaceRaised,
    },
    title: { fontFamily: t.fonts.displayBold, fontSize: 19 * t.textScale, color: t.colors.text },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
    },
    form: { gap: 16 },
  });
