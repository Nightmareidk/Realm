"use client";

import { X } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { cx } from "@/lib/cx";

/**
 * A modal sheet on the native <dialog>: the browser keeps focus inside, makes the page behind
 * inert, closes on Escape and hands focus back to whatever opened it. On phones it rises from
 * the bottom; on wider screens it sits in the middle.
 */
export function Dialog({
  open,
  onClose,
  title,
  lead,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard closes it with Escape (onCancel).
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the dimmed backdrop (the dialog element itself, outside its content) closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cx(
        "m-auto w-[min(34rem,calc(100vw-1.5rem))] max-w-none rounded-box bg-surface-raised p-0 text-fg",
        "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12),0_40px_100px_-30px_rgb(0_0_0/0.8)]",
        "backdrop:bg-base/70 max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none",
        className,
      )}
    >
      {open && (
        <div className="px-6 pt-6 pb-6 sm:px-7">
          <div className="flex items-start gap-4">
            <h2
              id={titleId}
              className="flex-1 font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em] text-balance"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-fg-soft hover:bg-surface hover:text-fg"
            >
              <X aria-hidden="true" size={20} />
              <span className="sr-only">Close</span>
            </button>
          </div>
          {lead && <div className="mt-2 text-fg-soft">{lead}</div>}
          <div className="mt-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}
