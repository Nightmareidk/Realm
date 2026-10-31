import type { BackupCodes, TwoStepSetup, TwoStepStatus } from "@realm/contracts";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { AppScreen, Loading, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Field, Notice, Pill } from "@/ui";

const say = (err: unknown) =>
  err instanceof ApiError ? err.message : "Something went wrong. Try again.";

/**
 * Two-step sign-in: after the password, a 6-digit code from an authenticator app. On a phone the
 * app is usually on the same phone, so the key opens it directly (or is copied to paste in).
 */
export default function TwoStep() {
  const { t } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const { refreshUser } = useSession();
  const status = useApi<TwoStepStatus>("/users/@me/two-step");
  const [setup, setSetup] = useState<TwoStepSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "off" | "new-codes">("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function begin() {
    setNotice(null);
    try {
      setSetup(await api<TwoStepSetup>("/users/@me/two-step/setup", { method: "POST" }));
    } catch (err) {
      setNotice(say(err));
    }
  }

  async function enable() {
    if (!setup || pending) return;
    setPending(true);
    setNotice(null);
    try {
      const r = await api<BackupCodes>("/users/@me/two-step", {
        body: { secret: setup.secret, code: code.trim() },
      });
      setCodes(r.codes);
      setSetup(null);
      setCode("");
      status.reload();
      void refreshUser();
    } catch (err) {
      setNotice(say(err));
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const body = { password, code: code.trim() || undefined };
      if (mode === "off") await api("/users/@me/two-step/disable", { body });
      else setCodes((await api<BackupCodes>("/users/@me/two-step/backup-codes", { body })).codes);
      setMode("idle");
      setPassword("");
      setCode("");
      status.reload();
      void refreshUser();
    } catch (err) {
      setNotice(say(err));
    } finally {
      setPending(false);
    }
  }

  let body: React.ReactNode;
  if (codes) {
    body = (
      <>
        <Notice>
          Keep these somewhere safe, like a password manager. Each one gets you in once if you lose
          your phone. You won't see them again.
        </Notice>
        <View style={s.codes}>
          {codes.map((c) => (
            <Text key={c} style={s.code} selectable>
              {c}
            </Text>
          ))}
        </View>
        <View style={s.row}>
          <Pill
            size="md"
            kind="ghost"
            label="Share or save"
            onPress={() =>
              void Share.share({ message: `Realm backup codes\n\n${codes.join("\n")}` })
            }
          />
          <Pill size="md" label="I've saved them" onPress={() => setCodes(null)} />
        </View>
      </>
    );
  } else if (!status.data) {
    body = <Loading />;
  } else if (setup) {
    body = (
      <>
        <Text style={s.lead}>
          1. Add Realm to an authenticator app (Google Authenticator, Authy, 1Password…).{"\n"}
          2. Enter the 6-digit code it shows.
        </Text>
        <View style={s.row}>
          <Pill
            size="md"
            label="Open my authenticator app"
            onPress={() => void Linking.openURL(setup.uri)}
          />
        </View>
        <Text style={s.small}>Or type this key into the app:</Text>
        <Text style={s.key} selectable>
          {setup.secret.match(/.{1,4}/g)?.join(" ")}
        </Text>
        <Pill
          size="md"
          kind="ghost"
          label="Copy the key"
          onPress={() => void Clipboard.setStringAsync(setup.secret)}
        />
        <View style={s.form}>
          {notice ? <Notice>{notice}</Notice> : null}
          <Field
            label="6-digit code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="go"
            onSubmitEditing={enable}
          />
          <Pill label="Turn on" pending={pending} pendingLabel="Checking" onPress={enable} />
        </View>
      </>
    );
  } else if (!status.data.enabled) {
    body = (
      <>
        {notice ? <Notice>{notice}</Notice> : null}
        <View style={s.mark}>
          <Icon name="ShieldCheck" size={30} color={t.colors.text} />
        </View>
        <Text style={s.lead}>
          Even if someone learns your password, they can't sign in without your phone.
        </Text>
        <View style={s.foot}>
          <Pill label="Set up two-step sign-in" onPress={begin} />
        </View>
      </>
    );
  } else {
    const left = status.data.backupCodesLeft;
    body = (
      <>
        <View style={s.on}>
          <Icon name="CheckCircleFill" size={24} color={t.colors.success} />
          <Text style={s.onText}>
            On. {left} backup {left === 1 ? "code" : "codes"} left.
          </Text>
        </View>
        {mode === "idle" ? (
          <View style={s.form}>
            <Pill kind="ghost" label="New backup codes" onPress={() => setMode("new-codes")} />
            <Pill kind="ghost" label="Turn off" onPress={() => setMode("off")} />
          </View>
        ) : (
          <View style={s.form}>
            {notice ? <Notice>{notice}</Notice> : null}
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secret
              autoCapitalize="none"
              autoComplete="current-password"
            />
            <Field
              label="Code from your app, or a backup code"
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="one-time-code"
            />
            <Pill
              label={mode === "off" ? "Turn off two-step sign-in" : "Make new codes"}
              kind={mode === "off" ? "ghost" : "action"}
              pending={pending}
              pendingLabel="Checking"
              onPress={confirm}
            />
            <Pill kind="quiet" label="Cancel" onPress={() => setMode("idle")} />
          </View>
        )}
      </>
    );
  }

  return (
    <AppScreen>
      <TopBar title="Two-step sign-in" />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    body: { padding: 20, gap: 14 },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      lineHeight: 24 * t.textScale,
      color: t.colors.textSoft,
    },
    small: { fontFamily: t.fonts.body, fontSize: 14 * t.textScale, color: t.colors.textSoft },
    key: {
      fontFamily: t.fonts.bold,
      fontSize: 17 * t.textScale,
      letterSpacing: 1,
      color: t.colors.text,
    },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    form: { marginTop: 12, gap: 16 },
    foot: { marginTop: 20 },
    mark: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    codes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    code: {
      width: "48%",
      textAlign: "center",
      paddingVertical: 10,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceRaised,
      fontFamily: t.fonts.bold,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
    on: { flexDirection: "row", alignItems: "center", gap: 10 },
    onText: { fontFamily: t.fonts.bold, fontSize: 16 * t.textScale, color: t.colors.text },
  });
