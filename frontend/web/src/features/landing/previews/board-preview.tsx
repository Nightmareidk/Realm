import { ArrowFatUp, Article, ChatCircle } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/avatar";
import { cx } from "@/lib/cx";
import { thread } from "../demo";
import { PreviewFrame } from "./preview-frame";

type Reply = (typeof thread.replies)[number] | (typeof thread.replies)[number]["replies"][number];

function Vote({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
      <ArrowFatUp size={14} />
      <span className="tabular font-semibold text-ink-soft">{count}</span>
    </span>
  );
}

function ReplyItem({ reply, depth }: { reply: Reply; depth: number }) {
  const children = "replies" in reply ? reply.replies : [];
  return (
    <li className={cx("relative", depth > 0 && "mt-3 border-l border-rule pl-4")}>
      <p className="flex items-center gap-2 text-xs">
        <Avatar name={reply.by.name} ink={reply.by.ink} size="xs" />
        <span className="font-semibold text-ink">{reply.by.name.split(" ")[0]}</span>
      </p>
      <p className="mt-1.5 text-sm leading-snug text-ink-soft">{reply.text}</p>
      <p className="mt-1.5 flex items-center gap-4">
        <Vote count={reply.votes} />
        <span className="text-xs text-ink-muted">Reply</span>
      </p>
      {children.length > 0 && (
        <ul>
          {children.map((c) => (
            <ReplyItem key={c.text} reply={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function BoardPreview({ variant = "full" }: { variant?: "full" | "compact" }) {
  const compact = variant === "compact";
  return (
    <PreviewFrame label="A board thread with votes and nested replies" caption={!compact}>
      <div className="flex items-center gap-2 border-b border-rule px-5 py-3 text-sm text-ink-muted">
        <Article size={16} />
        <span className="font-semibold text-ink-soft">{thread.channel}</span>
      </div>
      <article className="px-5 py-4">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1 pt-0.5 text-ink-soft">
            <ArrowFatUp size={18} />
            <span className="tabular text-sm font-bold text-ink">{thread.votes}</span>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs text-ink-muted">
              <Avatar name={thread.by.name} ink={thread.by.ink} size="xs" />
              <span className="font-semibold text-ink-soft">{thread.by.name}</span>
              <span className="tabular">{thread.time}</span>
            </p>
            <h3 className="stretch-semi-expanded mt-2 text-base font-bold leading-snug text-ink">
              {thread.title}
            </h3>
            {!compact && <p className="mt-2 text-sm leading-snug text-ink-soft">{thread.body}</p>}
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <ChatCircle size={15} />
              <span className="tabular">{thread.comments}</span> replies
            </p>
          </div>
        </div>
        <ul className="mt-5 border-t border-rule pt-4">
          {(compact
            ? thread.replies.slice(0, 1).map((r) => ({ ...r, replies: [] }))
            : thread.replies
          ).map((r, i) => (
            <li key={r.text} className={cx(i > 0 && "mt-5")}>
              <ul>
                <ReplyItem reply={r} depth={0} />
              </ul>
            </li>
          ))}
        </ul>
      </article>
    </PreviewFrame>
  );
}
