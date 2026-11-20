"use client";

import { ArrowRight, ArrowUp, Sparkle } from "@phosphor-icons/react";
import type { HelpAnswer } from "@realm/contracts";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";

/**
 * "Ask Realm": a small help chat for basic questions. TEMPORARY (course project). The answers come
 * from a fixed list on Realm's server (no AI service); questions aren't saved. To take it out,
 * delete this file, `app/(app)/settings/help/`, and the "Help" group in `features/app/nav.ts`.
 */
type Line =
  | { from: "you"; text: string; id: number }
  | { from: "realm"; answer: HelpAnswer; id: number };

const HELLO: HelpAnswer = {
  answer:
    "Hi! I'm Realm's little helper. Ask me how to do something, like changing your theme or turning on notifications.",
  link: null,
  suggestions: [],
};

export function HelpChat() {
  const [lines, setLines] = useState<Line[]>([{ from: "realm", answer: HELLO, id: 0 }]);
  const [starters, setStarters] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const next = useRef(1);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ suggestions: string[] }>("/help/starters")
      .then((r) => setStarters(r.suggestions))
      .catch(() => {});
  }, []);

  // Keep the newest line in view (without a smooth scroll for people who asked for less motion).
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when a line is added.
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    end.current?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [lines.length]);

  const ask = async (question: string) => {
    const q = question.trim().slice(0, 300);
    if (!q || busy) return;
    setProblem("");
    setBusy(true);
    setText("");
    setLines((l) => [...l, { from: "you", text: q, id: next.current++ }]);
    try {
      const answer = await api<HelpAnswer>("/help/ask", { method: "POST", body: { question: q } });
      setLines((l) => [...l, { from: "realm", answer, id: next.current++ }]);
    } catch (err) {
      setProblem(
        err instanceof ApiError && err.status === 429
          ? "That's a lot of questions! Wait a minute, then ask again."
          : "Couldn't get an answer. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(text);
  };

  const last = lines.at(-1);
  const chips =
    last?.from === "realm" && last.answer.suggestions.length > 0
      ? last.answer.suggestions
      : lines.length === 1
        ? starters
        : [];

  return (
    <div className="flex flex-col overflow-hidden rounded-card bg-surface shadow-[inset_0_0_0_1px_var(--r-border)]">
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation with Realm's helper"
        className="flex max-h-[min(32rem,60vh)] min-h-[18rem] flex-col gap-3 overflow-y-auto p-4"
      >
        {lines.map((line) =>
          line.from === "you" ? (
            <p
              key={line.id}
              className="max-w-[80%] self-end rounded-[1.1rem] rounded-br-[0.4rem] bg-accent px-3.5 py-2 text-on-accent"
            >
              <span className="sr-only">You: </span>
              {line.text}
            </p>
          ) : (
            <div key={line.id} className="flex max-w-[88%] items-start gap-2.5 self-start">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-fg/10 text-fg"
              >
                <Sparkle size={16} weight="fill" />
              </span>
              <div className="space-y-2 rounded-[1.1rem] rounded-tl-[0.4rem] bg-surface-raised px-3.5 py-2.5 text-fg">
                <p>
                  <span className="sr-only">Realm: </span>
                  {line.answer.answer}
                </p>
                {line.answer.link && (
                  <Link
                    href={line.answer.link.web}
                    className="inline-flex items-center gap-1.5 rounded font-bold underline underline-offset-[0.22em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {line.answer.link.label}
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                )}
              </div>
            </div>
          ),
        )}
        {busy && (
          <p role="status" className="self-start pl-11 text-[0.9rem] text-fg-soft">
            Thinking…
          </p>
        )}
        <div ref={end} />
      </div>

      {chips.length > 0 && (
        <ul aria-label="Questions you can ask" className="flex flex-wrap gap-2 px-4 pb-3">
          {chips.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => void ask(c)}
                disabled={busy}
                className="rounded-full px-3.5 py-1.5 text-[0.9rem] font-semibold text-fg shadow-[inset_0_0_0_1px_var(--r-border-strong)] transition-colors duration-150 hover:bg-fg/8 disabled:opacity-50"
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}

      {problem && (
        <p role="alert" className="px-4 pb-2 text-[0.92rem] text-danger">
          {problem}
        </p>
      )}

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-line p-3">
        <label htmlFor="help-q" className="sr-only">
          Your question
        </label>
        <input
          id="help-q"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          autoComplete="off"
          placeholder="Ask how to do something"
          className="h-11 min-w-0 flex-1 rounded-full bg-base/70 px-4 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none placeholder:text-fg-muted focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
        />
        <button
          type="submit"
          aria-disabled={!text.trim() || busy || undefined}
          className={cx(
            "grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-opacity duration-150",
            (!text.trim() || busy) && "opacity-50",
          )}
        >
          <ArrowUp aria-hidden="true" size={19} weight="bold" />
          <span className="sr-only">Ask</span>
        </button>
      </form>
    </div>
  );
}
