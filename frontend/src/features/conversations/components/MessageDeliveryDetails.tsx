import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, RefreshCw, Send } from "lucide-react";

import type { InboxMessage } from "../../../api/inbox";
import { Button } from "../../../components/ui/Button";
import type { Translate } from "../conversationTypes";
import { Pill } from "./ConversationPrimitives";

export type DeliveryStatus = "queued" | "sending" | "delivered" | "delayed" | "retrying" | "failed";

export function getDeliveryStatus(message: InboxMessage): DeliveryStatus {
  if (message.status === "delivering") return "sending";
  if (message.status === "retry_scheduled") {
    return message.delivery_next_retry_at ? "delayed" : "retrying";
  }
  if (message.status === "sent") return "delivered";
  if (message.status === "failed") return "failed";
  return "queued";
}

const statusCopy: Record<DeliveryStatus, string> = {
  queued: "conversations.deliveryStatusQueued",
  sending: "conversations.deliveryStatusSending",
  delivered: "conversations.deliveryStatusDelivered",
  delayed: "conversations.deliveryStatusDelayed",
  retrying: "conversations.deliveryStatusRetrying",
  failed: "conversations.deliveryStatusFailed",
};

const statusHelp: Record<DeliveryStatus, string> = {
  queued: "conversations.deliveryHelpQueued",
  sending: "conversations.deliveryHelpSending",
  delivered: "conversations.deliveryHelpDelivered",
  delayed: "conversations.deliveryHelpDelayed",
  retrying: "conversations.deliveryHelpRetrying",
  failed: "conversations.deliveryHelpFailed",
};

function statusIcon(status: DeliveryStatus) {
  if (status === "sending" || status === "retrying") return LoaderCircle;
  if (status === "delivered") return CheckCircle2;
  if (status === "delayed") return Clock3;
  if (status === "failed") return AlertTriangle;
  if (status === "queued") return Send;
  return RefreshCw;
}

function statusClass(status: DeliveryStatus) {
  if (status === "delivered") return "bg-[var(--zani-success-soft)] text-zani-text ring-[rgba(21,128,61,0.18)]";
  if (status === "failed") return "bg-[var(--zani-danger-soft)] text-zani-danger ring-[rgba(185,28,28,0.18)]";
  if (status === "delayed" || status === "retrying") return "bg-zani-warning-soft text-zani-text ring-[rgba(183,121,31,0.22)]";
  return "bg-surface-muted text-zani-muted ring-zani-border";
}

export function MessageDeliveryDetails({
  message,
  canRetry,
  retryPending,
  onRetry,
  t,
}: {
  message: InboxMessage;
  canRetry: boolean;
  retryPending: boolean;
  onRetry: () => void;
  t: Translate;
}) {
  const status = getDeliveryStatus(message);
  const Icon = statusIcon(status);
  const attempts = message.delivery_attempts || 0;
  const maxAttempts = message.delivery_max_attempts || attempts;

  return (
    <section
      data-testid="message-delivery-details"
      className="rounded-card border border-zani-border bg-surface-card p-3 shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zani-muted">
          <Icon aria-hidden="true" className={status === "sending" || status === "retrying" ? "animate-spin motion-reduce:animate-none" : ""} size={15} />
          {t("conversations.deliveryTitle")}
        </p>
        <Pill className={statusClass(status)}>{t(statusCopy[status])}</Pill>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-zani-muted">{t(statusHelp[status])}</p>
      {attempts > 0 ? (
        <p className="mt-2 text-[11px] font-bold text-zani-muted">
          {t("conversations.deliveryAttempts", { attempts, max: maxAttempts })}
        </p>
      ) : null}
      {status === "failed" && canRetry ? (
        <Button
          type="button"
          data-testid="message-delivery-retry"
          className="mt-3 h-9 rounded-control px-3 text-xs"
          variant="secondary"
          onClick={onRetry}
          isLoading={retryPending}
        >
          <RefreshCw size={14} /> {t("conversations.retryDelivery")}
        </Button>
      ) : null}
      {status === "failed" && !canRetry ? (
        <p className="mt-3 text-xs font-semibold text-zani-muted">
          {t("conversations.deliveryRetryNotAllowed")}
        </p>
      ) : null}
    </section>
  );
}
