import { Limits } from "@realm/contracts";
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
import { AppScreen, TopBar } from "@/social/screen";
import { fonts, type NativeTheme, useStyles, useTheme } from "@/theme";
import { Field, Notice, Pill } from "@/ui";

/** Change your password. Every other device is signed out, so a lost phone loses its way in. */
export default function ChangePassword() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const currentRef = useRef<TextInput>(null);
  const nextRef = useRef<TextInput>(null);

  async function submit() {
    const found: typeof errors = {};
    if (!current) found.current = "Enter the password you use now.";
    if (next.length < Limits.password.min) {
      found.next = `Use at least ${Limits.password.min} characters.`;
    } else if (next === current) {
      found.next = "That's the password you have now. Pick a new one.";
    }
    setErrors(found);
    setNotice(null);
    if (found.current) return currentRef.current?.focus();
    if (found.next) return nextRef.current?.focus();
    setPending(true);
    try {
      await api("/auth/password/change", {
        body: { currentPassword: current, newPassword: next },
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
        setErrors({ current: "That isn't your current password." });
        currentRef.current?.focus();
      } else if (err instanceof ApiError && err.fields.newPassword) {
        setErrors({ next: err.fields.newPassword });
      } else if (
        err instanceof ApiError &&
        (err.code === "PASSWORD_TOO_COMMON" || err.code === "PASSWORD_BREACHED")
      ) {
        setErrors({ next: err.message });
      } else {
        setNotice(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AppScreen>
      <TopBar title="Password" />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {done ? (
            <>
              <View style={s.mark}>
                <Icon name="ShieldCheck" size={30} color={t.colors.success} />
              </View>
              <Text style={s.title} accessibilityRole="header">
                Password changed.
              </Text>
              <Text style={s.lead}>
                Every other phone and browser was signed out. This one stays signed in.
              </Text>
              <View style={s.foot}>
                <Pill label="Done" onPress={() => router.back()} />
              </View>
            </>
          ) : (
            <>
              <Text style={s.lead}>
                Changing it signs out every other phone and browser where you're signed in.
              </Text>
              <View style={s.form}>
                {notice ? <Notice>{notice}</Notice> : null}
                <Field
                  ref={currentRef}
                  label="Current password"
                  value={current}
                  onChangeText={setCurrent}
                  error={errors.current}
                  secret
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="next"
                  onSubmitEditing={() => nextRef.current?.focus()}
                />
                <Field
                  ref={nextRef}
                  label="New password"
                  hint={`At least ${Limits.password.min} characters. A few unrelated words make a strong one.`}
                  value={next}
                  onChangeText={setNext}
                  error={errors.next}
                  secret
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
              </View>
              <View style={s.foot}>
                <Pill
                  label="Change password"
                  pendingLabel="Changing"
                  pending={pending}
                  onPress={submit}
                />
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
    form: { marginTop: 24, gap: 22 },
    foot: { marginTop: 32 },
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
