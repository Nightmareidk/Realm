"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { type ReactNode, useEffect, useId, useState } from "react";
import { cx } from "@/lib/cx";

/**
 * `children` sit under the links (for example the Pause motion switch); `panelClassName` lets a
 * page restyle the dropdown panel.
 */
export function MobileMenu({
  items,
  children,
  panelClassName,
}: {
  items: { href: string; label: string }[];
  children?: ReactNode;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-full border border-rule text-ink transition-colors duration-160 ease-out hover:border-rule-strong"
      >
        {open ? <X size={18} /> : <List size={18} />}
      </button>
      <div
        id={id}
        className={cx(
          "surface fixed inset-x-2 top-[4.5rem] px-5 pb-4 pt-2 transition-[opacity,transform] duration-200 ease-out md:inset-x-4",
          open ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
          panelClassName,
        )}
        inert={!open}
      >
        <nav aria-label="Mobile">
          <ul className="grid">
            {[...items, { href: "/login", label: "Sign in" }].map((item) => (
              <li key={item.href} className="border-b border-rule last:border-0">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex h-12 items-center text-base text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {children && <div className="border-t border-rule pt-4">{children}</div>}
      </div>
    </div>
  );
}
