"use client";

import { CheckCircle, EnvelopeSimple, X } from "@phosphor-icons/react";
import type { SelfUser } from "@realm/contracts";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pill } from "@/components/pill";
import { DevMailNote } from "@/features/auth/auth-shell";
import { CodeForm } from "@/features/auth/code-form";

const LATER_KEY = "realm:verify-later";

/**
 * Until the email is verified: one slim line at the top of the centre panel (never over the bar
 * or the content you're focused on), a request rather than a warning. "Enter code" opens the code
 * box in place; "Later" hides it for this session. Home leaves it out, since its first step is
 * the same request.
 */
export function VerifyBanner({ viewer }: { viewer: SelfUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"line" | "code" | "done" | "hidden">("line");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(LATER_KEY)) setState("hidden");
    } catch {}
  }, []);

  if (state === "hidden" || (viewer.emailVerified && state !== "done")) return null;
  if (pathname === "/home" && state === "line") return null;

  if (state === "done") {
    return (
      <div className="px-4 pt-3 pb-4 md:px-7 md:pt-0">
        <div
          role="status"
          className="flex items-center gap-3 rounded-card bg-success/10 py-2 pr-2 pl-4 shadow-[inset_0_0_0_1px_var(--r-success)]"
        >
          <CheckCircle
            aria-hidden="true"
            size={22}
            weight="fill"
            className="shrink-0 text-success"
          />
          <p className="flex-1 text-fg">Email confirmed. You're all set.</p>
          <button
            type="button"
            onClick={() => setState("hidden")}
            className="inline-flex size-10 items-center justify-center rounded-full text-fg-soft hover:bg-surface-raised hover:text-fg"
          >
            <X aria-hidden="true" size={18} />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 pb-4 md:px-7 md:pt-0">
      <section
        aria-label="Confirm your email"
        className="rounded-card bg-surface-sunken px-4 py-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <EnvelopeSimple aria-hidden="true" size={22} className="shrink-0 text-fg-soft" />
          <p className="min-w-0 flex-1 basis-[16rem] text-fg">
            <strong>Confirm your email</strong>{" "}
            <span className="text-fg-soft">
              so you can always get back in. We sent a code to{" "}
              <span className="text-fg [overflow-wrap:anywhere]">{viewer.email}</span>.
            </span>
          </p>
          {state === "line" && (
            <div className="flex gap-2 max-sm:pl-[2.375rem]">
              <button
                type="button"
                onClick={() => setState("code")}
                className={pill("ghost", "sm")}
              >
                Enter code
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem(LATER_KEY, "1");
                  } catch {}
                  setState("hidden");
                }}
                className={pill("quiet", "sm")}
              >
                Later
              </button>
            </div>
          )}
        </div>
        {state === "code" && (
          <div className="mt-3 pl-[2.375rem]">
            <CodeForm
              compact
              onVerified={() => {
                setState("done");
                router.refresh();
              }}
            />
            <DevMailNote className="mt-2" />
          </div>
        )}
      </section>
    </div>
  );
}
