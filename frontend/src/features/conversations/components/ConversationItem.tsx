import { CheckSquare, MessageSquare, Square } from "lucide-react";

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
  t,
}: {
  conversation: InboxConversation;
  active: boolean;
  selectable: boolean;
  selectedForBulk: boolean;
  onToggleSelected: () => void;
  onClick: () => void;
  t: Translate;
}) {
  const preview = conversation.last_message?.text || t("conversations.emptyHistoryPreview");
  const unread = conversation.unread_count || 0;
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
        "group relative w-full border-b border-slate-100 px-3 py-2.5 text-left transition hover:bg-slate-50",
        active ? "bg-brand-50/80 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:bg-brand-600" : "bg-white",
      )}
    >
      <div className="flex items-center gap-2.5">
        {selectable ? (
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-white"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelected();
            }}
            aria-label={selectedForBulk ? t("conversations.removeFromSelection") : t("conversations.selectForBulk")}
          >
            {selectedForBulk ? <CheckSquare size={19} /> : <Square size={19} />}
          </button>
        ) : null}
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-xs font-black text-brand-700 shadow-sm">
          {initials || <MessageSquare size={16} />}
          <span className={cn("absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white", conversation.channel === "telegram" ? "bg-blue-500" : conversation.channel === "whatsapp" ? "bg-emerald-500" : conversation.channel === "instagram" ? "bg-pink-500" : "bg-slate-400")} />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-midnight px-1 text-[10px] font-black text-white">
              {unread}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-black text-midnight">{conversationTitle(conversation, t)}</p>
            <span className="shrink-0 text-[11px] font-bold text-slate-400">{formatDateTime(conversation.last_message_at)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold leading-5 text-slate-500">{preview}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">{channelLabel(conversation.channel, t)}</span>
            {conversation.handoff_required ? <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-600">{t("conversations.noReply")}</span> : null}
            {!conversation.handoff_required && !conversation.bot_enabled ? <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-600">{t("conversations.paused")}</span> : null}
            {conversation.status === "closed" ? <span className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] font-black text-slate-500">{t("status.closed")}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
