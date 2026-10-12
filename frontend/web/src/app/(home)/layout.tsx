import { HomeFooter, HomeHeader } from "@/features/home/chrome";
import { LightField } from "@/features/home/light-field";

/**
 * The front page's world (2026-10): its own light field, bar and footer. Everything inside reads
 * its colours from the theme on this element, which the profile canvas can change as you scroll.
 */
export default function HomeLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-world="canvas" className="relative isolate min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-full focus:bg-[var(--acc)] focus:px-4 focus:py-2 focus:font-bold focus:text-[var(--on-acc)]"
      >
        Skip to content
      </a>
      <LightField />
      <HomeHeader />
      <main id="main">{children}</main>
      <HomeFooter />
    </div>
  );
}
