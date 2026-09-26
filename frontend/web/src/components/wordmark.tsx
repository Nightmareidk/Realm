import Image from "next/image";
import { cx } from "@/lib/cx";

/** The Realm logo tile (user-supplied brand mark). */
export function RealmLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src={size > 48 ? "/brand/realm-icon-192.png" : "/brand/realm-icon-96.png"}
      alt=""
      width={size}
      height={size}
      className={cx("shrink-0", className)}
      priority
    />
  );
}

export function Wordmark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <RealmLogo size={size} />
      <span className="stretch-expanded text-[1.05rem] font-extrabold uppercase tracking-[0.2em] text-ink">
        Realm
      </span>
    </span>
  );
}
