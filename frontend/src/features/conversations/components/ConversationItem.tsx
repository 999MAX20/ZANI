import { CheckSquare, MessageSquare, RotateCcw, Square } from "lucide-react";

import type { InboxConversation } from "../../../api/inbox";
import { cn } from "../../../lib/cn";
import type { Translate } from "../conversationTypes";
import { channelLabel, conversationTitle, formatDateTime } from "../conversationUtils";

export function ConversationItem({
  conversation,
  active,
  selectable,
  selectedForBulk,
  onToggleSelected,
  onClick,
  onRetryLastMessage,
  canRetryLastMessage,
  retryPending,
  t,
}: {
  conversation: InboxConversation;
  active: boolean;
  selectable: boolean;
  selectedForBulk: boolean;
  onToggleSelected: () => void;
  onClick: () => void;
  onRetryLastMessage: () => void;
  canRetryLastMessage: boolean;
  retryPending: boolean;
  t: Translate;
}) {
  const preview = conversation.last_message?.text || t("conversations.emptyHistoryPreview");
  const unread = conversation.unread_count || 0;
  const isSlaOverdue = Boolean(conversation.sla_overdue || (conversation.sla_overdue_minutes || 0) > 0);
  const lastMessageFailed = conversation.last_message?.status === "failed";
  const initials = conversationTitle(conversation, t)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      className={cn(
        "group relative w-full border-b border-zani-border px-3 py-2.5 text-left transition hover:bg-surface-hover",
        active ? "bg-brand-50/80 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:bg-brand-600" : "bg-zani-card",
      )}
    >
      <div className="flex items-center gap-2.5">
        {selectable ? (
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-control text-zani-muted hover:bg-zani-card"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelected();
            }}
            aria-label={selectedForBulk ? t("conversations.removeFromSelection") : t("conversations.selectForBulk")}
          >
            {selectedForBulk ? <CheckSquare size={19} /> : <Square size={19} />}
          </button>
        ) : null}
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zani-border bg-zani-card text-xs font-bold text-brand-700 shadow-sm">
          {initials || <MessageSquare size={16} />}
          <span className={cn("absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-zani-card", conversation.channel === "telegram" ? "bg-sky-500" : conversation.channel === "whatsapp" ? "bg-emerald-500" : conversation.channel === "instagram" ? "bg-pink-500" : "bg-zani-muted")} />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-zani-text">{conversationTitle(conversation, t)}</p>
            <span className="shrink-0 text-[11px] font-bold text-zani-muted">{formatDateTime(conversation.last_message_at)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold leading-5 text-zani-muted">{preview}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-zani-muted">{channelLabel(conversation.channel, t)}</span>
            {conversation.handoff_required ? <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{t("conversations.noReply")}</span> : null}
            {isSlaOverdue ? <span className="rounded-full bg-[var(--zani-danger-soft)] px-1.5 py-0.5 text-[10px] font-bold text-zani-danger">{t("conversations.slaOverdue")}</span> : null}
            {lastMessageFailed && canRetryLastMessage ? (
              <button
                type="button"
                className="inline-flex min-h-7 items-center gap-1 rounded-control bg-[var(--zani-danger-soft)] px-2 text-[10px] font-bold text-zani-danger"
                disabled={retryPending}
                onClick={(event) => {
                  event.stopPropagation();
                  onRetryLastMessage();
                }}
                data-testid="conversation-retry-failed"
              >
                <RotateCcw size={12} className={retryPending ? "animate-spin" : undefined} />
                {t("common.retry")}
              </button>
            ) : null}
            {!conversation.handoff_required && !conversation.bot_enabled ? <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">{t("conversations.paused")}</span> : null}
            {conversation.status === "closed" ? <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-zani-muted">{t("status.closed")}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
