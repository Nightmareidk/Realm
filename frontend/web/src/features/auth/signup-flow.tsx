"use client";

import { Check } from "@phosphor-icons/react";
import {
  type AuthResult,
  DisplayName,
  Email,
  Limits,
  Password,
  Username,
  type UsernameAvailability,
} from "@realm/contracts";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  FieldError,
  FormNotice,
  focusFirstError,
  labelClass,
  PasswordField,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/form";
import { pill, textLink } from "@/components/pill";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { THEME_ORDER, THEMES, type ThemeId } from "../home/themes";
import { applyAccent, currentAccent } from "./accent";
import { waitFor } from "./wait";

/*
 * Sign-up in three steps (docs/research/2026-10-phase1-auth-accounts.md §6.3):
 *   1. Pick your colour: the whole page re-lights in it, and it becomes the account's theme.
 *   2. Your birthday, before anything personal (FTC COPPA FAQ D.4). The server checks it and an
 *      under-age answer holds this browser for a day, with no way to simply try another date.
 *   3. Your account.
 * On wide screens a preview of your profile stays beside every step, in your colour and, once
 * you type them, with your name and @handle.
 *
 * From a friend's invite (/i/{code}) it's two steps instead: birthday, then account, with the
 * Space you're joining beside them, and you land inside it (the s3 "Invite-led" preview).
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Step = "colour" | "birthday" | "account" | "held";

/** A handle made from a display name: lowercase letters, numbers, underscores, single dots. */
function suggestUsername(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, Limits.username.max);
}

const title =
  "font-display font-extrabold leading-[0.95] tracking-[-0.045em] text-balance text-fg outline-none";

/** The step's title takes focus when the step changes, so screen readers hear where they are. */
function StepTitle({ children, big = false }: { children: ReactNode; big?: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1
      ref={ref}
      tabIndex={-1}
      className={cx(
        title,
        big ? "text-[2.9rem] sm:text-[3.6rem] xl:text-[4.6rem]" : "text-[2.6rem] sm:text-[3.2rem]",
      )}
    >
      {children}
    </h1>
  );
}

/** Joining through an invite: what to say, the Space's card, and how to join once signed up. */
export interface InviteJoin {
  heading: string;
  card: ReactNode;
  /** Joins the Space and says where to go next. */
  join: () => Promise<string>;
}

export function SignupFlow({ next, invite }: { next: string; invite?: InviteJoin }) {
  const [step, setStep] = useState<Step>(invite ? "birthday" : "colour");
  const [accent, setAccent] = useState<ThemeId>("mint");
  const [birthDate, setBirthDate] = useState("");
  const [preview, setPreview] = useState({ name: "", username: "" });

  useEffect(() => setAccent(currentAccent()), []);

  const pick = (id: ThemeId) => {
    setAccent(id);
    applyAccent(id);
  };

  return (
    <div className="mx-auto grid w-full max-w-[90rem] grid-cols-[minmax(0,1fr)] gap-12 px-4 pt-6 pb-16 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16 lg:pt-10 xl:px-28">
      <div className="max-w-[38rem]">
        {step === "colour" && (
          <ColourStep accent={accent} onPick={pick} onNext={() => setStep("birthday")} />
        )}
        {step === "birthday" && (
          <BirthdayStep
            title={invite?.heading}
            stepLabel={
              invite ? "Step 1 of 2 · then your account" : "Step 2 of 3 · then your account"
            }
            onBack={invite ? undefined : () => setStep("colour")}
            onHeld={() => setStep("held")}
            onNext={(date) => {
              setBirthDate(date);
              setStep("account");
            }}
          />
        )}
        {step === "account" && (
          <AccountStep
            next={next}
            stepLabel={invite ? "Step 2 of 2" : "Step 3 of 3"}
            onRegistered={invite?.join}
            accent={accent}
            birthDate={birthDate}
            onBack={() => setStep("birthday")}
            onHeld={() => setStep("held")}
            onPreview={setPreview}
          />
        )}
        {step === "held" && <HeldStep />}
      </div>
      {invite
        ? step !== "held" && <div className="lg:order-first">{invite.card}</div>
        : step !== "held" && (
            <ProfilePreview accent={accent} name={preview.name} username={preview.username} />
          )}
    </div>
  );
}

/* ── Step 1: Pick your colour ─────────────────────────────────────────────── */

function ColourStep({
  accent,
  onPick,
  onNext,
}: {
  accent: ThemeId;
  onPick: (id: ThemeId) => void;
  onNext: () => void;
}) {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      <StepTitle big>Pick your colour.</StepTitle>
      <p className="mt-5 max-w-[32ch] text-[1.15rem] leading-relaxed text-fg-soft">
        It's how Realm looks for you, and how your profile looks to friends. Change it any time.
      </p>
      <fieldset className="mt-8">
        <legend className="sr-only">Your colour</legend>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {THEME_ORDER.map((id) => {
            const t = THEMES[id];
            const on = id === accent;
            return (
              <label
                key={id}
                className={cx(
                  "relative flex h-24 cursor-pointer flex-col items-start justify-end rounded-[1.25rem] p-3 font-bold transition-[box-shadow,transform] duration-200 ease-out active:scale-[0.98] sm:h-32",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-focus",
                  on
                    ? "shadow-[0_0_0_3px_var(--r-bg),0_0_0_5px_var(--r-text)]"
                    : "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]",
                )}
                style={{
                  background: `radial-gradient(100% 120% at 0% 100%, ${t.light[0]}, transparent 70%), radial-gradient(90% 110% at 100% 0%, ${t.light[1]}, transparent 70%), ${t.light[2]}`,
                }}
              >
                <input
                  type="radio"
                  name="accent"
                  value={id}
                  checked={on}
                  onChange={() => onPick(id)}
                  className="sr-only"
                />
                {on && (
                  <span className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-fg text-[var(--r-bg)]">
                    <Check aria-hidden="true" size={15} weight="bold" />
                  </span>
                )}
                <span className="rounded-full bg-base/75 px-2.5 py-1 text-[1rem] leading-none text-fg">
                  {t.name}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="submit" className={pill("action", "lg", "px-9")}>
          Next
        </button>
        <span className="text-fg-soft">Step 1 of 3 · your birthday is next</span>
      </div>
    </form>
  );
}

/* ── Step 2: Birthday ─────────────────────────────────────────────────────── */

function BirthdayStep({
  title,
  stepLabel,
  onBack,
  onNext,
  onHeld,
}: {
  title?: string;
  stepLabel: string;
  onBack?: () => void;
  onNext: (birthDate: string) => void;
  onHeld: () => void;
}) {
  const [v, setV] = useState({ month: "", day: "", year: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const month = useRef<HTMLSelectElement>(null);
  const day = useRef<HTMLInputElement>(null);
  const year = useRef<HTMLInputElement>(null);

  const check = (): { value?: string; error?: string; focus?: typeof day | typeof month } => {
    if (!v.day) return { error: "Date of birth must include a day", focus: day };
    if (!v.month) return { error: "Date of birth must include a month", focus: month };
    if (!v.year) return { error: "Date of birth must include a year", focus: year };
    const d = Number(v.day);
    const m = Number(v.month);
    const y = Number(v.year);
    if (v.year.length !== 4) return { error: "Year must include 4 numbers", focus: year };
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
      return { error: "Date of birth must be a real date", focus: day };
    }
    if (date.getTime() > Date.now())
      return { error: "Date of birth must be in the past", focus: year };
    return { value: `${v.year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setNotice("");
    const r = check();
    if (r.error || !r.value) {
      setError(r.error ?? "");
      r.focus?.current?.focus();
      return;
    }
    setError("");
    setPending(true);
    try {
      await api("/auth/age-check", { body: { birthDate: r.value } });
      onNext(r.value);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.code === "UNDER_AGE") return onHeld();
      if (err instanceof ApiError && err.code === "BIRTHDATE_INVALID") {
        setError("Enter your real date of birth");
        year.current?.focus();
        return;
      }
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setNotice(`Too many tries from here. ${waitFor(err.retryAfter)} and try again.`);
        return;
      }
      setNotice(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  const invalid = error ? true : undefined;
  return (
    <form noValidate onSubmit={onSubmit}>
      <StepTitle>{title ?? "When's your birthday?"}</StepTitle>
      <p className="mt-5 max-w-[36ch] text-[1.1rem] leading-relaxed text-fg-soft">
        {title ? "First, when's your birthday? " : ""}We use it to keep Realm right for your age.
        It's never shown on your profile.
      </p>
      <FormNotice className="mt-6">{notice}</FormNotice>
      <fieldset className="mt-8" aria-describedby={error ? "dob-error" : undefined}>
        <legend className={labelClass}>Date of birth</legend>
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2.5">
          <SelectField
            label="Month"
            labelClassName="mb-1.5 block text-[0.9rem] text-fg-soft"
            name="bday-month"
            autoComplete="bday-month"
            value={v.month}
            onChange={(e) => setV((x) => ({ ...x, month: e.target.value }))}
            aria-invalid={invalid}
            selectRef={month}
          >
            <option value="" disabled>
              Choose
            </option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </SelectField>
          <div>
            <label htmlFor="bday-day" className="mb-1.5 block text-[0.9rem] text-fg-soft">
              Day
            </label>
            <input
              id="bday-day"
              ref={day}
              name="bday-day"
              autoComplete="bday-day"
              inputMode="numeric"
              value={v.day}
              aria-invalid={invalid}
              onChange={(e) =>
                setV((x) => ({ ...x, day: e.target.value.replace(/\D/g, "").slice(0, 2) }))
              }
              className={dateInput}
            />
          </div>
          <div>
            <label htmlFor="bday-year" className="mb-1.5 block text-[0.9rem] text-fg-soft">
              Year
            </label>
            <input
              id="bday-year"
              ref={year}
              name="bday-year"
              autoComplete="bday-year"
              inputMode="numeric"
              value={v.year}
              aria-invalid={invalid}
              onChange={(e) =>
                setV((x) => ({ ...x, year: e.target.value.replace(/\D/g, "").slice(0, 4) }))
              }
              className={dateInput}
            />
          </div>
        </div>
        <FieldError id="dob-error">{error}</FieldError>
      </fieldset>
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <SubmitButton pending={pending} pendingLabel="Checking" className="px-9">
          Next
        </SubmitButton>
        <span className="text-fg-soft">{stepLabel}</span>
      </div>
      {onBack && (
        <p className="mt-6">
          <button type="button" onClick={onBack} className={textLink}>
            Change your colour
          </button>
        </p>
      )}
    </form>
  );
}

const dateInput =
  "block w-full h-14 rounded-input border-[1.5px] border-line-strong bg-base/70 px-4 text-[1.0625rem] text-fg tabular " +
  "transition-[border-color,box-shadow] duration-150 ease-out hover:border-fg-muted focus-visible:outline-none " +
  "focus-visible:border-accent focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--r-accent)_22%,transparent)] " +
  "aria-[invalid=true]:border-danger-line";

/* ── Step 3: Account ──────────────────────────────────────────────────────── */

type Fields = { displayName: string; username: string; email: string; password: string };
type Errors = Partial<Record<keyof Fields, string>>;

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.displayName.trim()) e.displayName = "Enter the name your friends will see.";
  else if (!DisplayName.safeParse(f.displayName).success) {
    e.displayName = `Keep it to ${Limits.displayName.max} characters or fewer.`;
  }
  const u = Username.safeParse(f.username);
  if (!u.success) e.username = `${u.error.issues[0]?.message ?? "Pick another username"}.`;
  if (!f.email.trim()) e.email = "Enter your email address.";
  else if (!Email.safeParse(f.email).success)
    e.email = "Enter an email address like name@example.com.";
  if (!Password.safeParse(f.password).success) {
    e.password =
      f.password.length > Limits.password.max
        ? `Keep it to ${Limits.password.max} characters or fewer.`
        : `Use at least ${Limits.password.min} characters.`;
  }
  return e;
}

function AccountStep({
  next,
  stepLabel,
  onRegistered,
  accent,
  birthDate,
  onBack,
  onHeld,
  onPreview,
}: {
  next: string;
  stepLabel: string;
  onRegistered?: () => Promise<string>;
  accent: ThemeId;
  birthDate: string;
  onBack: () => void;
  onHeld: () => void;
  onPreview: (p: { name: string; username: string }) => void;
}) {
  const [f, setF] = useState<Fields>({ displayName: "", username: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<ReactNode>("");
  const [pending, setPending] = useState(false);
  const [free, setFree] = useState<{ name: string; result: UsernameAvailability } | null>(null);
  const touched = useRef(false);
  const refs = {
    displayName: useRef<HTMLInputElement>(null),
    username: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  // Whether the username is free, checked once typing pauses.
  useEffect(() => {
    const name = f.username;
    if (!Username.safeParse(name).success) {
      setFree(null);
      return;
    }
    const timer = setTimeout(() => {
      api<UsernameAvailability>(`/auth/username-available?username=${encodeURIComponent(name)}`)
        .then((result) => setFree({ name, result }))
        .catch(() => setFree(null));
    }, 450);
    return () => clearTimeout(timer);
  }, [f.username]);

  useEffect(
    () => onPreview({ name: f.displayName, username: f.username }),
    [f.displayName, f.username, onPreview],
  );

  const set = (key: keyof Fields, value: string) => {
    const nextF = { ...f, [key]: value };
    if (key === "displayName" && !touched.current) nextF.username = suggestUsername(value);
    setF(nextF);
    if (tried) setErrors(validate(nextF));
  };

  const taken =
    free && free.name === f.username && !free.result.available ? free.result.reason : undefined;
  const usernameStatus =
    free && free.name === f.username && free.result.available
      ? `@${f.username} is free`
      : undefined;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setTried(true);
    setNotice("");
    const found = validate(f);
    if (taken === "taken") found.username = `@${f.username} is taken. Try another.`;
    if (taken === "reserved") found.username = "That username isn't available. Try another.";
    setErrors(found);
    const order: [string, (typeof refs)[keyof typeof refs]][] = [
      ["displayName", refs.displayName],
      ["username", refs.username],
      ["email", refs.email],
      ["password", refs.password],
    ];
    if (Object.keys(found).length > 0) return focusFirstError(found, order);

    setPending(true);
    try {
      await api<AuthResult>("/auth/register", {
        body: {
          displayName: f.displayName.trim(),
          username: f.username,
          email: f.email.trim(),
          password: f.password,
          birthDate,
          accent,
        },
      });
      // From an invite: join the Space now (if that fails, its page explains why).
      let destination = next;
      if (onRegistered) destination = await onRegistered().catch(() => next);
      // A full load into the app: nothing cached from before signing in carries over.
      window.location.replace(destination);
    } catch (err) {
      setPending(false);
      if (!(err instanceof ApiError)) {
        setNotice("Something went wrong. Try again.");
        return;
      }
      if (err.code === "UNDER_AGE") return onHeld();
      const fe: Errors = { ...err.fields } as Errors;
      if (err.code === "EMAIL_TAKEN") {
        fe.email = "An account already uses this email.";
        setNotice(
          <>
            An account already uses this email.{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className={textLink}>
              Sign in instead
            </Link>
          </>,
        );
      }
      if (err.code === "USERNAME_TAKEN") fe.username = `@${f.username} is taken. Try another.`;
      if (err.code === "USERNAME_RESERVED")
        fe.username = "That username isn't available. Try another.";
      if (err.code === "PASSWORD_TOO_COMMON" || err.code === "PASSWORD_BREACHED")
        fe.password = err.message;
      if (err.code === "RATE_LIMITED") {
        setNotice(`Too many sign-ups from here. ${waitFor(err.retryAfter)} and try again.`);
      }
      setErrors(fe);
      if (Object.keys(fe).length === 0 && err.code !== "RATE_LIMITED") setNotice(err.message);
      focusFirstError(fe, order);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <StepTitle>Make your account.</StepTitle>
      <FormNotice className="mt-6">{notice}</FormNotice>
      <div className="mt-7 space-y-5">
        <TextField
          label="Display name"
          hint="What your friends see. You can change it any time."
          name="displayName"
          autoComplete="nickname"
          value={f.displayName}
          onChange={(e) => set("displayName", e.target.value)}
          error={errors.displayName}
          inputRef={refs.displayName}
        />
        <TextField
          label="Username"
          hint="Your @handle: letters, numbers, underscores and single dots."
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={f.username}
          onChange={(e) => {
            touched.current = true;
            set("username", e.target.value.toLowerCase());
          }}
          maxLength={Limits.username.max}
          error={
            errors.username ??
            (taken === "taken"
              ? `@${f.username} is taken. Try another.`
              : taken === "reserved"
                ? "That username isn't available. Try another."
                : undefined)
          }
          status={usernameStatus}
          inputRef={refs.username}
        />
        <TextField
          label="Email"
          hint="To sign in and reset your password. Never shown to anyone."
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={f.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors.email}
          inputRef={refs.email}
        />
        <PasswordField
          label="Password"
          hint={`At least ${Limits.password.min} characters. A few unrelated words make a strong one.`}
          name="password"
          autoComplete="new-password"
          value={f.password}
          onChange={(e) => set("password", e.target.value)}
          error={errors.password}
          inputRef={refs.password}
        />
      </div>
      <p className="mt-7 text-[0.95rem] leading-snug text-fg-soft">
        By creating an account you agree to the{" "}
        <Link href="/terms" className={textLink}>
          Terms
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className={textLink}>
          Privacy policy
        </Link>
        .
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <SubmitButton pending={pending} pendingLabel="Creating your account" className="px-9">
          Create account
        </SubmitButton>
        <span className="text-fg-soft">{stepLabel}</span>
      </div>
      <p className="mt-6">
        <button type="button" onClick={onBack} className={textLink}>
          Change your birthday
        </button>
      </p>
    </form>
  );
}

/* ── Under the minimum age ────────────────────────────────────────────────── */

function HeldStep() {
  return (
    <div>
      <StepTitle>We can't make an account for you yet.</StepTitle>
      <p className="mt-5 max-w-[40ch] text-[1.1rem] leading-relaxed text-fg-soft">
        Realm is for people {Limits.minimumAgeYears} and older. If you entered your birthday by
        mistake,{" "}
        <Link href="/help" className={textLink}>
          get in touch
        </Link>
        .
      </p>
    </div>
  );
}

/* ── The preview beside every step ────────────────────────────────────────── */

function ProfilePreview({
  accent,
  name,
  username,
}: {
  accent: ThemeId;
  name: string;
  username: string;
}) {
  const shown = name.trim() || "You";
  return (
    <div aria-hidden="true" className="hidden lg:block">
      <div className="rounded-[1.75rem] bg-surface p-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08),0_60px_120px_-50px_var(--r-shadow)]">
        <div
          className="h-40 rounded-[1.25rem]"
          style={{
            background:
              "radial-gradient(120% 140% at 0% 0%, var(--r-light-1), transparent 58%), radial-gradient(100% 120% at 100% 10%, var(--r-light-2), transparent 55%), radial-gradient(120% 120% at 50% 100%, var(--r-light-3), var(--r-surface) 78%)",
          }}
        />
        <div className="-mt-8 flex items-end gap-4 px-4">
          <span className="grid size-22 place-items-center rounded-[1.6rem] border-[5px] border-surface bg-accent font-display text-[2.2rem] font-extrabold text-on-accent">
            {shown.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 pb-2">
            <span className="block truncate font-display text-[1.7rem] leading-tight font-extrabold tracking-[-0.03em] text-fg">
              {shown}
            </span>
            <span className="block truncate text-[0.92rem] text-fg-soft">
              {username ? `@${username}` : `your profile, in ${THEMES[accent].name}`}
            </span>
          </span>
        </div>
        <div className="flex gap-2 px-4 pt-4 pb-2">
          {["Clips", "Late-night calls", "Ranked"].map((t) => (
            <span
              key={t}
              className="inline-flex h-7 items-center rounded-full bg-base/60 px-3 text-[0.82rem] font-bold text-fg-soft shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-[1.3fr_1fr] gap-2.5 p-1.5 pt-2">
          <div className="rounded-[1.1rem] bg-surface-sunken p-3">
            <span className="text-[0.82rem] font-bold text-fg-soft">Pinned clip</span>
            <div
              className="mt-2 h-24 rounded-[0.8rem]"
              style={{
                background:
                  "radial-gradient(90% 80% at 25% 20%, var(--r-light-1), transparent 60%), radial-gradient(90% 90% at 85% 90%, var(--r-light-2), transparent 65%), var(--r-bg)",
              }}
            />
          </div>
          <div className="flex flex-col rounded-[1.1rem] bg-surface-sunken p-3">
            <span className="text-[0.82rem] font-bold text-fg-soft">Right now</span>
            <span className="mt-2.5 flex items-center gap-2 text-[0.9rem] text-fg">
              <span className="size-2.5 rounded-full bg-presence" />
              Around
            </span>
            <span className={pill("action", "sm", "mt-auto self-start")}>Add friend</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[0.92rem] text-fg-soft">
        A preview. Your real profile is yours to fill in.
      </p>
    </div>
  );
}
