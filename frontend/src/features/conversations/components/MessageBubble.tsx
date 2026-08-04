import { Paperclip, Sparkles } from "lucide-react";

import type { InboxMessage } from "../../../api/inbox";
import { cn } from "../../../lib/cn";
import type { Translate } from "../conversationTypes";
import { formatMessageTime } from "../conversationUtils";

export function MessageBubble({ message, t }: { message: InboxMessage; t: Translate }) {
  const system = message.sender_type === "system";
  const inbound = message.direction === "inbound";
  const ai = message.sender_type === "bot" || message.sender_type === "ai";
  const author = ai
    ? t("conversations.senderAssistant")
    : message.sender_type === "manager"
      ? t("conversations.senderManager")
      : t("conversations.senderClient");
  const time = formatMessageTime(message.created_at || message.sent_at);

  if (system) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] rounded-full bg-surface-muted px-3 py-1.5 text-center text-xs font-bold text-zani-muted">
          {message.text || t("conversations.emptyMessage")}
          {time ? <span className="ml-2 text-zani-muted">{time}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex", inbound ? "justify-start" : "justify-end")}
      data-testid="conversation-message"
      data-message-direction={message.direction}
      data-message-sender={message.sender_type}
      data-message-status={message.status}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-card border border-zani-border bg-zani-card px-4 py-3 text-sm leading-6 text-zani-text shadow-sm",
          inbound ? "rounded-tl-md" : "rounded-tr-md",
        )}
        data-testid="conversation-message-bubble"
      >
        <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-zani-text">
          {ai ? <Sparkles size={13} /> : null}
          {author}
        </div>
        <p className="whitespace-pre-wrap">
          {message.text || t("conversations.emptyMessage")}
        </p>
        {message.attachments?.length ? (
          <div className="mt-3 space-y-2 text-zani-text">
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.download_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-control bg-surface-muted px-3 py-2 text-xs font-bold ring-1 ring-zani-border"
              >
                <Paperclip size={14} />
                <span className="min-w-0 flex-1 truncate">
                  {attachment.original_name}
                </span>
              </a>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-end text-[11px] font-bold text-zani-muted">
          {time ? <span>{time}</span> : null}
        </div>
      </div>
    </div>
  );
}
