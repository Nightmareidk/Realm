import { Limits, Username } from "@realm/contracts";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, type TextInput, View } from "react-native";
import { FormScreen } from "@/screen";
import { ApiError, api, waitFor, webOrigin } from "@/server";
import { useSession } from "@/session";
import { fonts, roles, themes, useTheme } from "@/theme";
import { Field, Lead, Notice, Pill, TextLink, Title } from "@/ui";

type Step = "birthday" | "account" | "held";

/**
 * Sign-up, after the introduction: the birthday first (before anything personal), then the
 * account, started in the colour the person stopped on in the introduction. The same steps and
 * words as the web's sign-up, without its colour step.
 */
export default function SignUp() {
  const [step, setStep] = useState<Step>("birthday");
  const [birthDate, setBirthDate] = useState("");
  return (
    <FormScreen back={step !== "held"}>
      {step === "birthday" && (
        <Birthday
          onDone={(date) => {
            setBirthDate(date);
            setStep("account");
          }}
          onHeld={() => setStep("held")}
        />
      )}
      {step === "account" && (
        <Account
          birthDate={birthDate}
          onBack={() => setStep("birthday")}
          onHeld={() => setStep("held")}
        />
      )}
      {step === "held" && <Held />}
    </FormScreen>
  );
}

/* ── The birthday ─────────────────────────────────────────────────────────── */

function Birthday({ onDone, onHeld }: { onDone: (date: string) => void; onHeld: () => void }) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const refs = {
    day: useRef<TextInput>(null),
    month: useRef<TextInput>(null),
    year: useRef<TextInput>(null),
  };

  function check(): { date?: string; error?: string; focus?: keyof typeof refs } {
    if (!day) return { error: "Date of birth must include a day", focus: "day" };
    if (!month) return { error: "Date of birth must include a month", focus: "month" };
    if (!year) return { error: "Date of birth must include a year", focus: "year" };
    if (year.length !== 4) return { error: "Year must include 4 numbers", focus: "year" };
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    const at = new Date(Date.UTC(y, m - 1, d));
    if (at.getUTCFullYear() !== y || at.getUTCMonth() !== m - 1 || at.getUTCDate() !== d) {
      return { error: "Date of birth must be a real date", focus: "day" };
    }
    if (at.getTime() > Date.now()) {
      return { error: "Date of birth must be in the past", focus: "year" };
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    return { date: `${y}-${pad(m)}-${pad(d)}` };
  }

  async function submit() {
    const v = check();
    setNotice(null);
    if (!v.date) {
      setError(v.error ?? null);
      if (v.focus) refs[v.focus].current?.focus();
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api("/auth/age-check", { body: { birthDate: v.date } });
      onDone(v.date);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.code === "UNDER_AGE") return onHeld();
      if (err instanceof ApiError && err.code === "BIRTHDATE_INVALID") {
        setError("Enter your real date of birth");
        return;
      }
      setNotice(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  const digits = (set: (v: string) => void) => (v: string) => set(v.replace(/\D/g, ""));
  return (
    <>
      <View style={s.head}>
        <Title>When's your birthday?</Title>
        <Lead style={s.lead}>We use it to keep Realm right for your age.</Lead>
        <Text style={s.step}>Step 1 of 2 · then your account</Text>
      </View>
      <View style={s.form}>
        {notice ? <Notice>{notice}</Notice> : null}
        <View style={s.row}>
          <View style={s.part}>
            <Field
              ref={refs.day}
              label="Day"
              value={day}
              onChangeText={digits(setDay)}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="DD"
              autoComplete="birthdate-day"
              returnKeyType="next"
              onSubmitEditing={() => refs.month.current?.focus()}
            />
          </View>
          <View style={s.part}>
            <Field
              ref={refs.month}
              label="Month"
              value={month}
              onChangeText={digits(setMonth)}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="MM"
              autoComplete="birthdate-month"
              returnKeyType="next"
              onSubmitEditing={() => refs.year.current?.focus()}
            />
          </View>
          <View style={[s.part, s.partWide]}>
            <Field
              ref={refs.year}
              label="Year"
              value={year}
              onChangeText={digits(setYear)}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="YYYY"
              autoComplete="birthdate-year"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>
        </View>
        {error ? <Notice>{error}</Notice> : null}
      </View>
      <View style={s.foot}>
        <Pill label="Next" pendingLabel="Checking" pending={pending} onPress={submit} />
      </View>
    </>
  );
}

/* ── The account ──────────────────────────────────────────────────────────── */

type Form = { displayName: string; username: string; email: string; password: string };
type Errors = Partial<Record<keyof Form, string>>;
const ORDER: (keyof Form)[] = ["displayName", "username", "email", "password"];

function Account({
  birthDate,
  onBack,
  onHeld,
}: {
  birthDate: string;
  onBack: () => void;
  onHeld: () => void;
}) {
  const router = useRouter();
  const { register } = useSession();
  const { id: accent } = useTheme();
  const [f, setF] = useState<Form>({ displayName: "", username: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [taken, setTaken] = useState<string | null>(null);
  const refs = {
    displayName: useRef<TextInput>(null),
    username: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    password: useRef<TextInput>(null),
  };
  const set = (k: keyof Form) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // Say a username is taken while they type, not after they press Create.
  useEffect(() => {
    const name = f.username.trim().toLowerCase();
    if (!Username.safeParse(name).success) return setTaken(null);
    const t = setTimeout(async () => {
      const r = await api<{ available: boolean }>(
        `/auth/username-available?username=${encodeURIComponent(name)}`,
      ).catch(() => null);
      setTaken(r && !r.available ? name : null);
    }, 400);
    return () => clearTimeout(t);
  }, [f.username]);

  function check(): Errors {
    const e: Errors = {};
    if (!f.displayName.trim()) e.displayName = "Enter the name your friends will see.";
    const u = Username.safeParse(f.username);
    if (!f.username.trim()) e.username = "Pick a username.";
    else if (!u.success) e.username = `${u.error.issues[0]?.message ?? "Pick another username"}.`;
    else if (taken === u.data) e.username = `@${u.data} is taken. Try another.`;
    if (!f.email.trim()) e.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
      e.email = "Enter an email address like name@example.com.";
    }
    if (f.password.length < Limits.password.min) {
      e.password = `Use at least ${Limits.password.min} characters.`;
    }
    return e;
  }

  async function submit() {
    const found = check();
    setErrors(found);
    setNotice(null);
    const first = ORDER.find((k) => found[k]);
    if (first) return refs[first].current?.focus();
    setPending(true);
    try {
      await register({
        displayName: f.displayName.trim(),
        username: f.username.trim().toLowerCase(),
        email: f.email.trim(),
        password: f.password,
        birthDate,
        accent,
      });
      router.replace("/home");
    } catch (err) {
      setPending(false);
      if (!(err instanceof ApiError)) return setNotice("Something went wrong. Try again.");
      if (err.code === "UNDER_AGE") return onHeld();
      const fe: Errors = { ...(err.fields as Errors) };
      if (err.code === "EMAIL_TAKEN") {
        fe.email = "An account already uses this email.";
        setNotice("An account already uses this email. Sign in instead?");
      }
      if (err.code === "USERNAME_TAKEN") fe.username = `@${f.username} is taken. Try another.`;
      if (err.code === "USERNAME_RESERVED") {
        fe.username = "That username isn't available. Try another.";
      }
      if (err.code === "PASSWORD_TOO_COMMON" || err.code === "PASSWORD_BREACHED") {
        fe.password = err.message;
      }
      if (err.code === "RATE_LIMITED") {
        setNotice(`Too many sign-ups from here. ${waitFor(err.retryAfter)} and try again.`);
      }
      setErrors(fe);
      if (Object.keys(fe).length === 0 && err.code !== "RATE_LIMITED") setNotice(err.message);
      const firstErr = ORDER.find((k) => fe[k]);
      if (firstErr) refs[firstErr].current?.focus();
    }
  }

  const web = webOrigin();
  return (
    <>
      <View style={s.head}>
        <Title>Make your account.</Title>
        <Lead style={s.lead}>
          In {themes[accent].name}, the colour you picked. You can change it any time.
        </Lead>
      </View>
      <View style={s.form}>
        {notice ? <Notice>{notice}</Notice> : null}
        <Field
          ref={refs.displayName}
          label="Display name"
          hint="What your friends see. You can change it any time."
          value={f.displayName}
          onChangeText={set("displayName")}
          error={errors.displayName}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => refs.username.current?.focus()}
        />
        <Field
          ref={refs.username}
          label="Username"
          hint="Your @handle: letters, numbers, underscores and single dots."
          value={f.username}
          onChangeText={set("username")}
          error={
            errors.username ??
            (taken && taken === f.username.trim().toLowerCase()
              ? `@${taken} is taken. Try another.`
              : undefined)
          }
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => refs.email.current?.focus()}
        />
        <Field
          ref={refs.email}
          label="Email"
          hint="To sign in and reset your password. Never shown to anyone."
          value={f.email}
          onChangeText={set("email")}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => refs.password.current?.focus()}
        />
        <Field
          ref={refs.password}
          label="Password"
          hint={`At least ${Limits.password.min} characters. A few unrelated words make a strong one.`}
          value={f.password}
          onChangeText={set("password")}
          error={errors.password}
          secret
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {web ? (
          <View style={s.terms}>
            <Text style={s.termsText}>By creating an account you agree to the</Text>
            <TextLink label="Terms" onPress={() => Linking.openURL(`${web}/terms`)} />
            <Text style={s.termsText}>and the</Text>
            <TextLink label="Privacy policy" onPress={() => Linking.openURL(`${web}/privacy`)} />
          </View>
        ) : null}
      </View>
      <View style={s.foot}>
        <Pill
          label="Create account"
          pendingLabel="Creating your account"
          pending={pending}
          onPress={submit}
        />
        <Text style={[s.step, s.center]}>Step 2 of 2</Text>
        <View style={s.across}>
          <TextLink label="Change your birthday" onPress={onBack} />
        </View>
      </View>
    </>
  );
}

/* ── Under the minimum age ────────────────────────────────────────────────── */

function Held() {
  const router = useRouter();
  const web = webOrigin();
  return (
    <>
      <View style={[s.head, s.heldHead]}>
        <Title>We can't make an account for you yet.</Title>
        <Lead style={s.lead}>
          Realm is for people {Limits.minimumAgeYears} and older. If you entered your birthday by
          mistake, get in touch.
        </Lead>
      </View>
      <View style={s.foot}>
        {web ? (
          <Pill kind="ghost" label="Get in touch" onPress={() => Linking.openURL(`${web}/help`)} />
        ) : null}
        <View style={s.across}>
          <TextLink label="Back to the start" onPress={() => router.replace("/")} />
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  head: { marginTop: 28 },
  heldHead: { marginTop: 64 },
  lead: { marginTop: 12 },
  step: { fontFamily: fonts.bold, fontSize: 15, color: roles.textSoft, marginTop: 14 },
  center: { textAlign: "center", marginTop: 4 },
  form: { marginTop: 30, gap: 22 },
  row: { flexDirection: "row", gap: 12 },
  part: { flex: 1 },
  partWide: { flex: 1.4 },
  foot: { marginTop: "auto", paddingTop: 32, gap: 8 },
  across: { flexDirection: "row", justifyContent: "center" },
  terms: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 5 },
  termsText: { fontFamily: fonts.body, fontSize: 15, color: roles.textSoft },
});
