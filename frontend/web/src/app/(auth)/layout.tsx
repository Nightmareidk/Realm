import Link from "next/link";

/**
 * The account screens, in DESIGN.md's world: the still, lit ground (drawn behind every page by
 * globals.css, in the person's colour), each screen's own header and content, and a quiet footer.
 * No 3D and no moving light on form pages.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-fg"
      >
        Skip to content
      </a>
      {children}
      <footer className="flex flex-wrap justify-center gap-x-6 gap-y-1 px-4 pt-4 pb-6 text-[0.92rem] text-fg-soft">
        <Link href="/terms" className="underline-offset-4 hover:text-fg hover:underline">
          Terms
        </Link>
        <Link href="/privacy" className="underline-offset-4 hover:text-fg hover:underline">
          Privacy
        </Link>
        <Link href="/help" className="underline-offset-4 hover:text-fg hover:underline">
          Help
        </Link>
      </footer>
    </div>
  );
}
