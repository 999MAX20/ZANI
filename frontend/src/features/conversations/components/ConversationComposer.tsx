import type { Ref } from "react";
import { Paperclip, Tags } from "lucide-react";

import type { InboxConversation } from "../../../api/inbox";
import { Button } from "../../../components/ui/Button";
import type { Translate } from "../conversationTypes";

type ConversationComposerProps = {
  selected: InboxConversation;
  draft: string;
  composerRef: Ref<HTMLTextAreaElement>;
  sendPending: boolean;
  onDraftChange: (value: string) => void;
  onResizeComposer: () => void;
  onOpenQuickReplies: () => void;
  onSendReply: () => void;
  t: Translate;
};

export function ConversationComposer({
  selected,
  draft,
  composerRef,
  sendPending,
  onDraftChange,
  onResizeComposer,
  onOpenQuickReplies,
  onSendReply,
  t,
}: ConversationComposerProps) {
  return (
    <div className="border-t border-zani-border bg-zani-card p-3">
      {selected.status === "closed" ? (
        <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          {t("conversations.closedReplyNotice")}
        </div>
      ) : null}
      <div className="flex items-end gap-2 rounded-card border border-zani-border bg-zani-card px-3 py-2 shadow-sm">
        <button type="button" className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-control text-zani-muted hover:bg-surface-hover hover:text-zani-text" title={t("conversations.attachFile")}>
          <Paperclip size={16} />
        </button>
        <button
          type="button"
          className="mb-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-xs font-bold text-zani-muted hover:bg-surface-hover hover:text-zani-text disabled:cursor-not-allowed disabled:opacity-50"
          disabled={selected.status === "closed"}
          onClick={onOpenQuickReplies}
          title={t("conversations.quickReplies")}
        >
          <Tags size={15} /> {t("conversations.quickRepliesButton")}
        </button>
        <textarea
          ref={composerRef}
          rows={1}
          className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm text-zani-text outline-none placeholder:text-zani-muted"
          disabled={selected.status === "closed" || sendPending}
          placeholder={t("conversations.replyPlaceholder")}
          value={draft}
          onChange={(event) => {
            onDraftChange(event.target.value);
            window.requestAnimationFrame(onResizeComposer);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) onSendReply();
          }}
        />
        <Button
          variant="ai"
          className="h-10 shrink-0 rounded-control px-4 text-sm"
          disabled={selected.status === "closed" || !draft.trim()}
          isLoading={sendPending}
          onClick={onSendReply}
          title={t("conversations.send")}
        >
          {t("conversations.send")}
        </Button>
      </div>
    </div>
  );
}
