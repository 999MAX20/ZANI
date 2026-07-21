import { Paperclip, RotateCcw, Sparkles } from "lucide-react";

import type { InboxMessage } from "../../../api/inbox";
import { cn } from "../../../lib/cn";
import type { Translate } from "../conversationTypes";
import { formatMessageTime } from "../conversationUtils";

export function MessageBubble({ message, t, onRetry }: { message: InboxMessage; t: Translate; onRetry?: (message: InboxMessage) => void }) {
  const system = message.sender_type === "system";
  const inbound = message.direction === "inbound";
  const ai = message.sender_type === "bot" || message.sender_type === "ai";
  const author = ai ? t("conversations.senderAssistant") : message.sender_type === "manager" ? t("conversations.senderManager") : t("conversations.senderClient");
  const time = formatMessageTime(message.created_at || message.sent_at);
  const messageStatusLabel = message.status === "failed"
    ? t("conversations.messageStatusFailed")
    : message.status === "queued"
      ? t("conversations.messageStatusQueued")
      : message.status === "sent"
        ? t("conversations.messageStatusSent")
        : t("conversations.messageStatusReceived");

  if (system) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] rounded-full bg-slate-100 px-3 py-1.5 text-center text-xs font-bold text-slate-500">
          {message.text || t("conversations.emptyMessage")}
          {time ? <span className="ml-2 text-slate-400">{time}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
          inbound ? "rounded-tl-md border border-slate-100 bg-white text-slate-700" : ai ? "rounded-tr-md bg-ai-50 text-ai-800 ring-1 ring-ai-100" : "rounded-tr-md bg-brand-600 text-white",
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-60">
          {ai ? <Sparkles size={13} /> : null}
          {author}
        </div>
        <p className="whitespace-pre-wrap">{message.text || t("conversations.emptyMessage")}</p>
        {message.attachments?.length ? (
          <div className={cn("mt-3 space-y-2", inbound ? "text-slate-700" : "text-white")}>
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.download_url}
                target="_blank"
                rel="noreferrer"
                className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ring-1", inbound ? "bg-slate-50 ring-slate-200" : "bg-white/15 ring-white/20")}
              >
                <Paperclip size={14} />
                <span className="min-w-0 flex-1 truncate">{attachment.original_name}</span>
              </a>
            ))}
          </div>
        ) : null}
        {message.error_text ? (
          <p className={cn("mt-2 text-xs font-bold", message.status === "failed" ? "text-red-500" : "text-amber-500")}>
            {message.error_text}
          </p>
        ) : null}
        <div className={cn("mt-2 flex flex-wrap items-center justify-end gap-1.5 text-[11px] font-bold", inbound ? "text-slate-400" : "text-white/70")}>
          {!inbound ? (
            <span className={cn("rounded-full px-1.5 py-0.5", message.status === "failed" ? "bg-red-50 text-red-600 ring-1 ring-red-100" : inbound ? "bg-slate-100" : "bg-white/15")}>
              {messageStatusLabel}
            </span>
          ) : null}
          {message.status === "failed" && onRetry ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-red-600 shadow-sm ring-1 ring-red-100 hover:bg-red-50"
              onClick={() => onRetry(message)}
            >
              <RotateCcw size={12} /> {t("common.retry")}
            </button>
          ) : null}
          {time ? <span>{time}</span> : null}
          {!inbound && message.status !== "failed" ? <span>{message.read_at ? "вњ“вњ“" : message.delivered_at || message.status === "sent" ? "вњ“вњ“" : "вњ“"}</span> : null}
        </div>
      </div>
    </div>
  );
}
