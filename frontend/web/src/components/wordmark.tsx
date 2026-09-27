import { cx } from "@/lib/cx";
import { EclipseMark } from "./brand/eclipse-mark";

/** The Realm mark on its app tile. */
export function RealmLogo({ size = 32, className }: { size?: number; className?: string }) {
  return <EclipseMark variant="tile" size={size} className={className} />;
}

export function Wordmark({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span className={cx("group/wordmark inline-flex items-center gap-2.5", className)}>
      <span
        className="inline-flex transition-transform duration-500 ease-out group-hover/wordmark:rotate-[-18deg]"
        style={{ width: size, height: size }}
      >
        <EclipseMark className="size-full" />
      </span>
      <span className="font-display text-[1.3rem] font-semibold leading-none tracking-[-0.04em] text-ink">
        realm
      </span>
    </span>
  );
}
