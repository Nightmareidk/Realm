"use client";

import { ChatsCircle, NotePencil } from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { pill } from "@/components/pill";
import { cx } from "@/lib/cx";
import { ConversationView } from "./conversation-view";
import { Inbox } from "./inbox";
import { NewMessageDialog } from "./new-message";

/**
 * Messages: the inbox beside the open conversation (desktop), or one then the other (phones).
 * `?new=1` opens the new-message sheet.
 */
export function MessagesView({ id = null }: { id?: string | null }) {
  const [composing, setComposing] = useState(false);
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("new") === "1") setComposing(true);
  }, [params]);

  return (
    <div className="flex min-h-0 flex-1 md:h-full">
      {/* Side by side from 1024px; below that, the inbox and the conversation take turns. */}
      <aside
        aria-label="Your conversations"
        className={cx(
          "w-full flex-col lg:w-[22rem] lg:shrink-0 lg:border-r lg:border-line xl:w-[23.5rem]",
          id ? "hidden lg:flex" : "flex",
        )}
      >
        <Inbox activeId={id} onNew={() => setComposing(true)} />
      </aside>
      <section
        aria-label="Conversation"
        className={cx("min-w-0 flex-1 flex-col", id ? "flex" : "hidden lg:flex")}
      >
        {id ? (
          <ConversationView key={id} id={id} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-fg/[0.06] text-fg-soft">
              <ChatsCircle aria-hidden="true" size={34} />
            </span>
            <p className="mt-4 font-display text-[1.35rem] font-bold tracking-[-0.02em] text-fg">
              Your messages
            </p>
            <p className="mt-1 max-w-[34ch] text-fg-soft">
              Pick a conversation, or start one with anyone from your Spaces.
            </p>
            <button
              type="button"
              onClick={() => setComposing(true)}
              className={pill("action", "md", "mt-5")}
            >
              <NotePencil aria-hidden="true" size={18} />
              New message
            </button>
          </div>
        )}
      </section>
      <NewMessageDialog open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}
