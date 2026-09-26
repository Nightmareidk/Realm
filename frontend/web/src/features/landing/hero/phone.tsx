import {
  BookmarkSimple,
  ChatCircle,
  ChatsCircle,
  Compass,
  Heart,
  House,
  ShareFat,
  SquaresFour,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { Avatar } from "@/components/avatar";
import { cx } from "@/lib/cx";
import { post } from "../demo";

/**
 * A phone showing Realm's Feed on mobile web, with the five mobile tabs from the UX plan.
 * Sized in em against a container-relative font size so it scales with the stage.
 */
export function Phone({ className }: { className?: string }) {
  return (
    <div inert className={cx("@container", className)}>
      <div className="aspect-[9/19] overflow-hidden rounded-[2.2em] border-[0.45em] border-[oklch(0.12_0.04_282)] bg-panel text-[4.6cqw]">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-[1.1em] pt-[0.9em] text-[0.8em] font-semibold text-ink">
            <span className="tabular">9:41</span>
            <span className="h-[1.1em] w-[4.5em] rounded-full bg-[oklch(0.12_0.04_282)]" />
            <span className="tabular">5G</span>
          </div>
          <div className="mt-[0.9em] flex gap-[1.1em] border-b border-rule px-[1.1em] text-[0.9em]">
            <span className="border-b-2 border-ink pb-[0.5em] font-semibold text-ink">
              Following
            </span>
            <span className="pb-[0.5em] text-ink-muted">For you</span>
          </div>
          <article className="flex min-h-0 flex-1 flex-col gap-[0.7em] p-[1em]">
            <header className="flex items-center gap-[0.6em]">
              <Avatar name={post.by.name} ink={post.by.ink} size="xs" />
              <p className="text-[0.85em] leading-tight">
                <span className="font-semibold text-ink">{post.by.name}</span>
                <span className="block text-ink-muted">@{post.by.handle}</span>
              </p>
            </header>
            <p className="text-[0.85em] leading-snug text-ink-soft">{post.text}</p>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[0.7em] bg-land">
              <Image src={post.image} alt="" fill sizes="240px" className="object-cover" />
            </div>
            <footer className="flex items-center gap-[1.2em] text-[0.8em] text-ink-muted">
              <span className="inline-flex items-center gap-[0.3em]">
                <Heart weight="fill" className="size-[1.3em] text-overprint" />
                <span className="tabular">{post.likes}</span>
              </span>
              <span className="inline-flex items-center gap-[0.3em]">
                <ChatCircle className="size-[1.3em]" />
                <span className="tabular">{post.comments}</span>
              </span>
              <ShareFat className="size-[1.3em]" />
              <BookmarkSimple className="ml-auto size-[1.3em]" />
            </footer>
          </article>
          <nav className="grid grid-cols-5 border-t border-rule px-[0.4em] pb-[1em] pt-[0.6em] text-[0.62em] text-ink-muted">
            {[
              [House, "Home"],
              [SquaresFour, "Spaces"],
              [Compass, "Feed"],
              [ChatsCircle, "Messages"],
            ].map(([Icon, label], i) => {
              const I = Icon as typeof House;
              return (
                <span
                  key={label as string}
                  className={cx("flex flex-col items-center gap-[0.3em]", i === 2 && "text-ink")}
                >
                  <I weight={i === 2 ? "fill" : "regular"} className="size-[1.9em]" />
                  {label as string}
                </span>
              );
            })}
            <span className="flex flex-col items-center gap-[0.3em]">
              <Avatar name="You Me" ink="profiles" size="xs" className="scale-90" />
              You
            </span>
          </nav>
        </div>
      </div>
    </div>
  );
}
