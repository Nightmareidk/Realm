import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, type TextInput, View } from "react-native";
import { FormScreen } from "@/screen";
import { ApiError, api } from "@/server";
import { Field, Lead, Notice, Pill, TextLink, Title } from "@/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Forgot your password: send a reset link to the account's email. It always says the same thing,
 * whether or not the email has an account, so nobody can use it to check who's on Realm.
 */
export default function Forgot() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const input = useRef<TextInput>(null);

  async function submit() {
    if (!EMAIL.test(email.trim())) {
      setError("Enter the email address on your account.");
      return input.current?.focus();
    }
    setError(undefined);
    setNotice(null);
    setPending(true);
    try {
      await api("/auth/password/forgot", { body: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <FormScreen>
        <View style={s.head}>
          <Title>Check your email.</Title>
          <Lead style={s.lead}>
            If {email.trim()} has a Realm account, a link to choose a new password is on its way. It
            works once, for an hour. Choosing a new password signs you out everywhere.
          </Lead>
        </View>
        <View style={s.foot}>
          <Pill label="Back to sign in" onPress={() => router.replace("/sign-in")} />
          <TextLink label="Use a different email" onPress={() => setSent(false)} />
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <View style={s.head}>
        <Title>Forgot your password?</Title>
        <Lead style={s.lead}>
          Enter your account's email and we'll send you a link to reset it.
        </Lead>
      </View>
      <View style={s.form}>
        {notice ? <Notice>{notice}</Notice> : null}
        <Field
          ref={input}
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={error}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>
      <View style={s.foot}>
        <Pill label="Send the link" pendingLabel="Sending" pending={pending} onPress={submit} />
      </View>
    </FormScreen>
  );
}

const s = StyleSheet.create({
  head: { marginTop: 28 },
  lead: { marginTop: 12 },
  form: { marginTop: 32, gap: 22 },
  foot: { marginTop: "auto", paddingTop: 32, gap: 8, alignItems: "stretch" },
});
