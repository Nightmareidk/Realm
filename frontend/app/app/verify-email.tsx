import type { SelfUser } from "@realm/contracts";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { AppScreen, TopBar } from "@/social/screen";
import { fonts, type NativeTheme, useStyles, useTheme } from "@/theme";
import { Field, Pill, TextLink } from "@/ui";

/**
 * Confirm your email with the 6-digit code from the email (its link works too). It shows the
 * address is yours, and lifts the spam limit on links that unconfirmed accounts have.
 */
export default function VerifyEmail() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, setUser } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  const input = useRef<TextInput>(null);

  if (!me) return null;

  async function confirm() {
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter the 6 digits from the email.");
      return input.current?.focus();
    }
    setError(undefined);
    setPending(true);
    try {
      setUser(await api<SelfUser>("/auth/email/verify", { body: { code: digits } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      input.current?.focus();
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    try {
      await api("/auth/email/resend", { method: "POST" });
      setResent(`Sent a new code to ${me?.email}. It can take a minute; check spam too.`);
    } catch (err) {
      setResent(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  return (
    <AppScreen>
      <TopBar title="Email" />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {me.emailVerified ? (
            <>
              <View style={s.mark}>
                <Icon name="ShieldCheck" size={30} color={t.colors.success} />
              </View>
              <Text style={s.title} accessibilityRole="header">
                Your email is confirmed.
              </Text>
              <Text style={s.lead}>
                {me.email}. Password reset links and account notices go there.
              </Text>
              <View style={s.foot}>
                <Pill label="Done" onPress={() => router.back()} />
              </View>
            </>
          ) : (
            <>
              <Text style={s.title} accessibilityRole="header">
                Confirm your email
              </Text>
              <Text style={s.lead}>
                We sent a 6-digit code to {me.email}. Confirming shows the address is really yours,
                and lifts the limit new accounts have on sharing links.
              </Text>
              <View style={s.form}>
                <Field
                  ref={input}
                  label="Code"
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                  error={error}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  returnKeyType="go"
                  onSubmitEditing={confirm}
                  style={s.code}
                />
                {resent ? (
                  <Text style={s.resent} accessibilityLiveRegion="polite">
                    {resent}
                  </Text>
                ) : null}
                <TextLink label="Send a new code" onPress={resend} />
              </View>
              <View style={s.foot}>
                <Pill label="Confirm" pendingLabel="Checking" pending={pending} onPress={confirm} />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    body: { padding: 20 },
    title: { fontFamily: fonts.displayBold, fontSize: 24, color: t.colors.text },
    lead: {
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 24,
      color: t.colors.textSoft,
      marginTop: 6,
    },
    form: { marginTop: 24, gap: 10 },
    code: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: 8 },
    resent: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: t.colors.textSoft },
    foot: { marginTop: 28 },
    mark: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
      marginBottom: 14,
    },
  });
