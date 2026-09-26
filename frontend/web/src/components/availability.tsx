import { cx } from "@/lib/cx";

/**
 * Map-legend symbology for honesty about what exists:
 * a solid road is built ("Available now"), a dashed road is planned ("Coming soon").
 */
export function AvailabilityKey({ className }: { className?: string }) {
  return (
    <p
      className={cx(
        "flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <Road status="now" /> Available now
      </span>
      <span className="inline-flex items-center gap-2">
        <Road status="soon" /> Coming soon
      </span>
    </p>
  );
}

export function Road({ status }: { status: "now" | "soon" }) {
  return (
    <svg viewBox="0 0 24 4" className="h-1 w-6 shrink-0" aria-hidden="true">
      <path
        d="M1 2H23"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={status === "soon" ? "3 4" : undefined}
        className={status === "now" ? "text-ink" : "text-ink-muted"}
      />
    </svg>
  );
}

export function FeatureList({
  items,
  className,
}: {
  items: { label: string; status: "now" | "soon" }[];
  className?: string;
}) {
  return (
    <ul className={cx("grid gap-2.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3 text-[0.95rem]">
          <Road status={item.status} />
          <span className={item.status === "now" ? "text-ink" : "text-ink-muted"}>
            {item.label}
            {item.status === "soon" && <span className="sr-only"> (coming soon)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
