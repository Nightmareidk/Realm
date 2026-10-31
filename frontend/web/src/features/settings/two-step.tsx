"use client";

import { Copy, DownloadSimple, ShieldCheck } from "@phosphor-icons/react";
import type { BackupCodes, TwoStepSetup, TwoStepStatus } from "@realm/contracts";
import qrcode from "qrcode-generator";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FormNotice, PasswordField, SubmitButton, TextField } from "@/components/form";
import { pill } from "@/components/pill";
import { ApiError, api } from "@/lib/api";

const say = (err: unknown) =>
  err instanceof ApiError ? err.message : "Something went wrong. Try again.";

/** The QR code an authenticator app scans, drawn as crisp SVG squares. */
function Qr({ text }: { text: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
  }, [text]);
  return (
    <div
      role="img"
      aria-label="QR code for your authenticator app"
      className="size-48 overflow-hidden rounded-card bg-white p-1 [&_svg]:size-full"
      // The SVG is made here from our own otpauth link; nothing from outside goes in it.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: generated locally from a known string
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Ten single-use codes, shown once, to copy or save. */
function CodesCard({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="space-y-4">
      <FormNotice tone="info">
        Keep these somewhere safe, like a password manager. Each one gets you in once if you lose
        your phone. You won't see them again.
      </FormNotice>
      <ol className="grid max-w-[22rem] grid-cols-2 gap-2 font-mono text-[1rem] text-fg">
        {codes.map((c) => (
          <li key={c} className="rounded-xl bg-surface-raised px-3 py-2 text-center">
            {c}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={pill("ghost", "md")}
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true));
          }}
        >
          <Copy aria-hidden="true" size={18} />
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          className={pill("ghost", "md")}
          download="realm-backup-codes.txt"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Realm backup codes\n\n${text}\n`)}`}
        >
          <DownloadSimple aria-hidden="true" size={18} />
          Save as a file
        </a>
        <button type="button" className={pill("action", "md")} onClick={onDone}>
          I've saved them
        </button>
      </div>
    </div>
  );
}

/** Password, and the app's code: what turning things off asks for. */
function ConfirmFields({
  password,
  setPassword,
  code,
  setCode,
}: {
  password: string;
  setPassword: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
}) {
  return (
    <>
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        label="Code from your app, or a backup code"
        name="code"
        autoComplete="one-time-code"
        inputMode="text"
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
    </>
  );
}

/**
 * Two-step sign-in: after the password, a 6-digit code from an authenticator app (Google
 * Authenticator, Authy, 1Password…). Set up by scanning a QR code; ten backup codes for a lost
 * phone.
 */
export function TwoStepPanel() {
  const [status, setStatus] = useState<TwoStepStatus | null>(null);
  const [setup, setSetup] = useState<TwoStepSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "off" | "new-codes">("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(
    () =>
      api<TwoStepStatus>("/users/@me/two-step")
        .then(setStatus)
        .catch((e) => setNotice(say(e))),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const begin = async () => {
    setNotice("");
    try {
      setSetup(await api<TwoStepSetup>("/users/@me/two-step/setup", { method: "POST" }));
    } catch (e) {
      setNotice(say(e));
    }
  };

  const enable = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || !setup) return;
    setPending(true);
    setNotice("");
    try {
      const r = await api<BackupCodes>("/users/@me/two-step", {
        body: { secret: setup.secret, code: code.trim() },
      });
      setCodes(r.codes);
      setSetup(null);
      setCode("");
      void load();
    } catch (err) {
      setNotice(say(err));
    } finally {
      setPending(false);
    }
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setNotice("");
    try {
      const body = { password, code: code.trim() || undefined };
      if (mode === "off") {
        await api("/users/@me/two-step/disable", { body });
      } else {
        setCodes((await api<BackupCodes>("/users/@me/two-step/backup-codes", { body })).codes);
      }
      setMode("idle");
      setPassword("");
      setCode("");
      void load();
    } catch (err) {
      setNotice(say(err));
    } finally {
      setPending(false);
    }
  };

  if (codes) return <CodesCard codes={codes} onDone={() => setCodes(null)} />;
  if (!status) {
    return (
      <>
        <FormNotice>{notice}</FormNotice>
        <p className="text-fg-soft">Loading…</p>
      </>
    );
  }

  if (setup) {
    return (
      <form noValidate onSubmit={enable} className="max-w-[34rem] space-y-5">
        <FormNotice>{notice}</FormNotice>
        <ol className="list-decimal space-y-2 pl-5 text-fg">
          <li>
            Open an authenticator app on your phone (Google Authenticator, Authy, 1Password…).
          </li>
          <li>Scan this code, or type the key below.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-5">
          <Qr text={setup.uri} />
          <div className="min-w-0 space-y-2">
            <p className="text-[0.92rem] text-fg-soft">Key, to type in by hand</p>
            <p className="font-mono text-[0.95rem] break-all text-fg">
              {setup.secret.match(/.{1,4}/g)?.join(" ")}
            </p>
            <a href={setup.uri} className={pill("quiet", "sm", "-ml-3.5")}>
              Open in an app on this device
            </a>
          </div>
        </div>
        <TextField
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <div className="flex gap-2">
          <SubmitButton pending={pending} pendingLabel="Checking" size="md">
            Turn on
          </SubmitButton>
          <button type="button" className={pill("quiet", "md")} onClick={() => setSetup(null)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (!status.enabled) {
    return (
      <div className="space-y-4">
        <FormNotice>{notice}</FormNotice>
        <p className="max-w-[34rem] text-fg-soft">
          Even if someone learns your password, they can't sign in without your phone.
        </p>
        <button type="button" className={pill("action", "md")} onClick={() => void begin()}>
          <ShieldCheck aria-hidden="true" size={20} />
          Set up two-step sign-in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 font-bold text-fg">
        <ShieldCheck aria-hidden="true" size={22} weight="fill" className="text-success" />
        On. {status.backupCodesLeft} backup {status.backupCodesLeft === 1 ? "code" : "codes"} left.
      </p>
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={pill("ghost", "md")}
            onClick={() => setMode("new-codes")}
          >
            New backup codes
          </button>
          <button type="button" className={pill("quiet", "md")} onClick={() => setMode("off")}>
            Turn off
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={confirm} className="max-w-[28rem] space-y-4">
          <FormNotice>{notice}</FormNotice>
          <ConfirmFields
            password={password}
            setPassword={setPassword}
            code={code}
            setCode={setCode}
          />
          <div className="flex gap-2">
            <SubmitButton
              pending={pending}
              pendingLabel="Checking"
              size="md"
              variant={mode === "off" ? "secondary" : "primary"}
            >
              {mode === "off" ? "Turn off two-step sign-in" : "Make new codes"}
            </SubmitButton>
            <button type="button" className={pill("quiet", "md")} onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export { ConfirmFields };
