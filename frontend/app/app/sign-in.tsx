import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, type TextInput, View } from "react-native";
import { alert } from "@/alert";
import { FormScreen } from "@/screen";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { type NativeTheme, useStyles } from "@/theme";
import { Field, Notice, Pill, TextLink, Title } from "@/ui";

/** Seconds before another one-time code can be asked for. */
const RESEND_WAIT = 30;

type Errors = { login?: string; password?: string; code?: string; emailCode?: string };

export default function SignIn() {
  const s = useStyles(make);
  const router = useRouter();
  const { signIn, signInWithCode } = useSession();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  // Sign in with a 4-digit code sent by email, instead of the password.
  const [byCode, setByCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [wait, setWait] = useState(0);
  const [sending, setSending] = useState(false);
  const emailCodeRef = useRef<TextInput>(null);
  // Two-step sign-in: asked for once the password is right.
  const [askCode, setAskCode] = useState(false);
  const [code, setCode] = useState("");
  const codeRef = useRef<TextInput>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const loginRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  function switchMode() {
    setByCode((b) => !b);
    setErrors({});
    setNotice(null);
  }

  async function sendCode() {
    if (!login.trim()) {
      setErrors({ login: "Enter your email or username." });
      return loginRef.current?.focus();
    }
    if (sending || wait > 0) return;
    setSending(true);
    setErrors({});
    setNotice(null);
    try {
      await api("/auth/login/code/send", { body: { login: login.trim() } });
      setCodeSent(true);
      setEmailCode("");
      setWait(RESEND_WAIT);
      setTimeout(() => emailCodeRef.current?.focus(), 50);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Couldn't send the code. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (byCode && !codeSent) return sendCode();
    const found: Errors = {};
    if (!login.trim()) found.login = "Enter your email or username.";
    if (!byCode && !password) found.password = "Enter your password.";
    if (byCode && !/^\d{4}$/.test(emailCode)) found.emailCode = "Enter the 4-digit code.";
    if (askCode && !code.trim()) found.code = "Enter the code from your app.";
    setErrors(found);
    setNotice(null);
    if (found.login) return loginRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    if (found.emailCode) return emailCodeRef.current?.focus();
    if (found.code) return codeRef.current?.focus();
    setPending(true);
    const second = askCode ? code.trim() : undefined;
    try {
      const back = byCode
        ? await signInWithCode(login.trim(), emailCode, second)
        : await signIn(login.trim(), password, second);
      if (back) {
        alert(
          "Welcome back",
          back === "deletion_cancelled"
            ? "Your account won't be deleted, and everything is as you left it."
            : "Your profile is visible again.",
        );
      }
      router.replace("/home");
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.code === "MFA_REQUIRED") {
        setAskCode(true);
        setTimeout(() => codeRef.current?.focus(), 50);
      } else if (err instanceof ApiError && err.code === "INVALID_CODE" && byCode && !askCode) {
        setErrors({ emailCode: "That code isn't right or has expired. Send a new one." });
        emailCodeRef.current?.focus();
      } else if (err instanceof ApiError && err.code === "INVALID_CODE") {
        setErrors({ code: "That code isn't right. Try the newest one, or a backup code." });
        codeRef.current?.focus();
      } else if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
        setNotice("That email or username and password don't match. Check them and try again.");
      } else {
        setNotice(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      }
    }
  }

  return (
    <FormScreen>
      <View style={s.head}>
        <Title>Welcome back.</Title>
      </View>
      <View style={s.form}>
        {notice ? <Notice>{notice}</Notice> : null}
        <Field
          ref={loginRef}
          label="Email or username"
          value={login}
          onChangeText={setLogin}
          error={errors.login}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType={byCode ? "send" : "next"}
          onSubmitEditing={() => (byCode ? void sendCode() : passwordRef.current?.focus())}
        />
        {byCode ? (
          codeSent ? (
            <>
              <Field
                ref={emailCodeRef}
                label="4-digit code from your email"
                hint="It works once, for 10 minutes. Check spam if it's not there."
                value={emailCode}
                onChangeText={(v) => setEmailCode(v.replace(/\D/g, "").slice(0, 4))}
                error={errors.emailCode}
                keyboardType="number-pad"
                maxLength={4}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                returnKeyType="go"
                onSubmitEditing={submit}
              />
              <TextLink
                label={wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
                onPress={sendCode}
              />
            </>
          ) : (
            <Text style={s.hint}>
              We'll email you a 4-digit code that signs you in once. No password needed.
            </Text>
          )
        ) : (
          <Field
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secret
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        )}
        {askCode ? (
          <Field
            ref={codeRef}
            label="Code from your authenticator app"
            hint="Lost your phone? Use one of your backup codes."
            value={code}
            onChangeText={setCode}
            error={errors.code}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        ) : null}
        <TextLink
          label={byCode ? "Use your password instead" : "Sign in with a one-time code instead"}
          onPress={switchMode}
        />
        {byCode ? null : (
          <TextLink label="Forgot your password?" onPress={() => router.push("/forgot")} />
        )}
      </View>
      <View style={s.foot}>
        <Pill
          label={byCode && !codeSent ? "Email me a code" : "Sign in"}
          pendingLabel={byCode && !codeSent ? "Sending" : "Signing in"}
          pending={pending || sending}
          onPress={submit}
        />
        <View style={s.across}>
          <Text style={s.acrossText}>New here?</Text>
          <TextLink label="Create your profile" onPress={() => router.replace("/sign-up")} />
        </View>
      </View>
    </FormScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    head: { marginTop: 28 },
    form: { marginTop: 32, gap: 22 },
    foot: { marginTop: "auto", paddingTop: 32, gap: 8 },
    hint: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
    },
    across: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    acrossText: { fontFamily: t.fonts.body, fontSize: 16 * t.textScale, color: t.colors.textSoft },
  });
