import { ArrowFatUp, At } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { cx } from "@/lib/cx";
import { people, thread } from "../demo";

/** Small live moments from Realm, floating off the edges of the app window. Illustrative, inert. */
function Fragment({
  className,
  delay,
  children,
}: {
  className?: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <div
      inert
      className={cx("absolute float-slow", className)}
      style={{ "--float-delay": `${delay}s` } as CSSProperties}
    >
      <div className="rounded-lg border border-rule-strong/50 bg-panel-raised/95 px-3.5 py-3 shadow-[0_18px_40px_-14px_rgb(2_8_18/0.9)]">
        {children}
      </div>
    </div>
  );
}

export function HeroFragments() {
  return (
    <>
      {/* A mention: someone needs you */}
      <Fragment className="-top-[9%] left-[22%] max-lg:hidden" delay={0}>
        <div className="flex items-center gap-3">
          <Avatar name={people.kenji.name} ink={people.kenji.ink} size="md" />
          <div className="leading-tight">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <At size={14} className="text-overprint" /> Kenji mentioned you
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">#lfg in Late Night Lobby</p>
          </div>
        </div>
      </Fragment>

      {/* A board thread climbing */}
      <Fragment className="-bottom-[11%] left-[8%] w-[17rem] max-lg:hidden" delay={0.7}>
        <div className="flex gap-3">
          <div className="flex flex-col items-center text-boards-text">
            <ArrowFatUp size={16} weight="fill" />
            <span className="tabular text-xs font-bold">{thread.votes}</span>
          </div>
          <div className="min-w-0 leading-snug">
            <p className="text-sm font-semibold text-ink">{thread.title}</p>
            <p className="mt-1 text-xs text-ink-muted">in {thread.channel}</p>
          </div>
        </div>
      </Fragment>
    </>
  );
}
