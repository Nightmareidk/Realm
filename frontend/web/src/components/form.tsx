"use client";

import {
  CaretDown,
  CheckCircle,
  CircleNotch,
  Eye,
  EyeSlash,
  Info,
  WarningCircle,
} from "@phosphor-icons/react";
import { type ComponentProps, type ReactNode, type RefObject, useId, useState } from "react";
import { pill } from "@/components/pill";
import { cx } from "@/lib/cx";

/*
 * Form parts for Realm's account and settings screens, in DESIGN.md's world. Every field has a
 * visible label, its hint and its error tied to it (aria-describedby), the right autocomplete,
 * and a 56px target. Fields are rounded rectangles with an edge that holds 3:1 against the
 * ground; focus rings in the theme's colour. Errors name the problem and the fix, under the
 * field, with an icon (never colour alone), and never clear what was typed.
 */

const control =
  "block w-full h-14 rounded-input border-[1.5px] border-line-strong bg-base/70 px-4 " +
  "text-[1.0625rem] text-fg placeholder:text-fg-muted " +
  "transition-[border-color,box-shadow] duration-150 ease-out hover:border-fg-muted " +
  "focus-visible:outline-none focus-visible:border-accent " +
  "focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--r-accent)_22%,transparent)] " +
  "aria-[invalid=true]:border-danger-line";

export const labelClass = "mb-2 block text-[0.95rem] font-bold text-fg";
export const hintClass = "-mt-1 mb-2.5 text-[0.92rem] leading-snug text-fg-soft";

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-[0.95rem] leading-snug text-danger">
      <WarningCircle aria-hidden="true" size={18} weight="fill" className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function describedBy(...ids: (string | false | undefined)[]) {
  const list = ids.filter(Boolean).join(" ");
  return list || undefined;
}

type InputProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** A quiet line under the field that isn't an error (e.g. "@noor_k is free"). */
  status?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Something to place inside the field, on the right (e.g. the show-password switch). */
  trailing?: ReactNode;
};

export function TextField({
  label,
  hint,
  error,
  status,
  inputRef,
  trailing,
  className,
  ...props
}: InputProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className={hintClass}>
          {hint}
        </p>
      )}
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(
            hint ? `${id}-hint` : undefined,
            error && `${id}-error`,
            status ? `${id}-status` : undefined,
          )}
          className={cx(control, trailing ? "pr-24" : undefined)}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
      {!error && status && (
        <p id={`${id}-status`} className="mt-2 text-[0.92rem] text-fg-soft">
          {status}
        </p>
      )}
    </div>
  );
}

/** A password with a switch to show it while typing (easier for dyslexic and mobile typists). */
export function PasswordField(props: Omit<InputProps, "type" | "trailing">) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      {...props}
      type={shown ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      trailing={
        <button
          type="button"
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[0.9rem] font-bold text-fg-soft transition-colors duration-150 ease-out hover:bg-surface-raised hover:text-fg"
        >
          {shown ? <EyeSlash aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
          {shown ? "Hide" : "Show"}
          <span className="sr-only"> password</span>
        </button>
      }
    />
  );
}

export function SelectField({
  label,
  error,
  children,
  selectRef,
  className,
  labelClassName,
  ...props
}: Omit<ComponentProps<"select">, "id"> & {
  label: string;
  error?: string;
  selectRef?: RefObject<HTMLSelectElement | null>;
  labelClassName?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClassName ?? labelClass}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          ref={selectRef}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cx(control, "appearance-none pr-11")}
          {...props}
        >
          {children}
        </select>
        <CaretDown
          aria-hidden="true"
          size={16}
          weight="bold"
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-fg-soft"
        />
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/** The form's own message: what went wrong overall (or went right), announced when it appears. */
export function FormNotice({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success" | "info";
  children?: ReactNode;
  className?: string;
}) {
  const Icon = tone === "error" ? WarningCircle : tone === "success" ? CheckCircle : Info;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("empty:absolute", className)}>
      {children && (
        <div
          className={cx(
            "flex items-start gap-2.5 rounded-card px-4 py-3.5 text-[0.95rem] leading-snug text-fg",
            tone === "error" && "bg-danger-line/12 shadow-[inset_0_0_0_1px_var(--r-danger-line)]",
            tone === "success" && "bg-success/10 shadow-[inset_0_0_0_1px_var(--r-success)]",
            tone === "info" &&
              "bg-surface-raised text-fg-soft shadow-[inset_0_0_0_1px_var(--r-border)]",
          )}
        >
          <Icon
            aria-hidden="true"
            size={20}
            weight="fill"
            className={cx(
              "shrink-0",
              tone === "error" && "text-danger",
              tone === "success" && "text-success",
              tone === "info" && "text-fg-soft",
            )}
          />
          <div className="min-w-0">{children}</div>
        </div>
      )}
    </div>
  );
}

/**
 * The form's one action. While it works it says what it's doing and keeps focus (aria-disabled,
 * not disabled, so keyboard and screen reader users aren't thrown back to the top).
 */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
  variant = "primary",
  size = "lg",
  className,
  ...props
}: ComponentProps<"button"> & {
  pending?: boolean;
  pendingLabel: string;
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
}) {
  return (
    <button
      type="submit"
      aria-disabled={pending || undefined}
      className={pill(variant === "primary" ? "action" : "ghost", size, className)}
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
      {...props}
    >
      {pending ? (
        <>
          <CircleNotch
            aria-hidden="true"
            size={18}
            weight="bold"
            className="motion-safe:animate-spin"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Focuses the first field (in `order`) that has an error, so the reader lands on what to fix. */
export function focusFirstError(
  errors: Record<string, string | undefined>,
  order: [string, RefObject<HTMLElement | null>][],
) {
  for (const [name, ref] of order) {
    if (errors[name]) {
      ref.current?.focus();
      return;
    }
  }
}
