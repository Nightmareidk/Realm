import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, type TextInput, View } from "react-native";
import { FormScreen } from "@/screen";
import { ApiError } from "@/server";
import { useSession } from "@/session";
import { fonts, roles } from "@/theme";
import { Field, Notice, Pill, TextLink, Title } from "@/ui";

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useSession();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const loginRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    const found: typeof errors = {};
    if (!login.trim()) found.login = "Enter your email or username.";
    if (!password) found.password = "Enter your password.";
    setErrors(found);
    setNotice(null);
    if (found.login) return loginRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    setPending(true);
    try {
      await signIn(login.trim(), password);
      router.replace("/home");
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
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
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
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
        <TextLink label="Forgot your password?" onPress={() => router.push("/forgot")} />
      </View>
      <View style={s.foot}>
        <Pill label="Sign in" pendingLabel="Signing in" pending={pending} onPress={submit} />
        <View style={s.across}>
          <Text style={s.acrossText}>New here?</Text>
          <TextLink label="Create your profile" onPress={() => router.replace("/sign-up")} />
        </View>
      </View>
    </FormScreen>
  );
}

const s = StyleSheet.create({
  head: { marginTop: 28 },
  form: { marginTop: 32, gap: 22 },
  foot: { marginTop: "auto", paddingTop: 32, gap: 8 },
  across: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  acrossText: { fontFamily: fonts.body, fontSize: 16, color: roles.textSoft },
});
